//----------------------------------MARK: Import dependencies--------------------------------------
// Import langchain stuff
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { AIMessage, HumanMessage, BaseMessage, ChatMessage, ToolMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, START, END, Annotation } from '@langchain/langgraph';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { StringOutputParser } from  '@langchain/core/output_parsers';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { SearxngSearch } from '@langchain/community/tools/searxng_search';
import { EnsembleRetriever } from "langchain/retrievers/ensemble";

// Hugging Face dependencies
import { pipeline } from '@xenova/transformers';

// Import postgres stuff
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { createPGConvoConfig, createPGDocumentConfig, createBasePool } from '../databasing/database.js';

import { z } from "zod";

import { MemorySaver } from '@langchain/langgraph';
const checkpointer = new MemorySaver();

// Import Tools for the LLM to use
import { calculatorTool } from  '../tools/calculatorTool.js';
import { todoToolkit } from  '../tools/todoTool.js';
import { searchTool, langSearchTool } from   '../tools/searchTools.js';
import { fetchUpcomingEventsTool } from '../tools/notionTools.js';

// Import extra stuff
import envconfig from '../secrets/env-config.json' with { type: "json" };

// Set up the tools
let tools = [calculatorTool, todoToolkit, fetchUpcomingEventsTool];
tools = tools.flat();
const toolNode = new ToolNode(tools);

export const ollama = new ChatOllama({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    model: 'aegis:v0.7',
    keepAlive: -1
});

export const ollamaEmbeddings = new OllamaEmbeddings({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    keepAlive: -1
    // TODO: Change the model instead of using default
});

const model = new ChatOllama({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    model: 'llama3.1:8b',
    temperature: 0,
});

const toolModel = model.bindTools(tools);
const searchModel = model.bindTools([searchTool]);

const vanillaModel = new ChatOllama({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    model: 'llama3.1:8b',
    temperature: 0,
});

// Create a temporary variable to store the user's message.
let userMessage = '';

//--------------------------------MARK: Define Functions for the Nodes--------------------------------
// Determine whether the LLM should continue on or end the conversation and reply to the user.
// This might be depreceated in favor of shouldRetrieve
function shouldContinue({ messages }) {
    console.log("---DETECT TOOL CALLS---");
    const lastMessage = messages[messages.length -1];
    // If LLM made a tool call, we route to the "tools" node.
    if (lastMessage.tool_calls.length != 0) {
        console.log('Tool call detected - routing to tools node');
        return "continue";
    }
    // Otherwise, we end it here, and reply to the user.
    console.log('No tool call detected - routing back');
    return "end";
}

// TODO: add a "decision maker" here to decide whether to retrieve from the local database or search online instead.
// However, I'm not sure whether to make it check if local database is sufficient before searching online.
// I'll need some test documents before trying this out though

async function callModel(state) {
    console.log("---GENERATE---");

    const response = await ollama.invoke(state.messages);
    return { messages: [response] };
}

async function promptRewriter({ messages} ) {
    const rewriterPrompt = ChatPromptTemplate.fromTemplate(
        `You a question re-writer that converts an input question to a better version that is optimized
        for vectorstore retrieval. Look at the initial and formulate an improved question.

        Here is the initial question:

        <question>
        {question}
        </question>

        Respond only with an improved question. Do not include any preamble or explanation.`
    );

    const rewriter = rewriterPrompt.pipe(vanillaModel).pipe(new StringOutputParser());
    const response = await rewriter.invoke({
        question: userMessage
    });
    console.log(response);
    userMessage = response;

    return { messages: messages };
}

async function getPastConversations({ messages }) {
    // Get the user's input
    // const lastMessage = messages[messages.length - 1];
    // userMessage = lastMessage;

    console.log("---GET PAST CONVERSATIONS---");
    try {
        const pg_basepool = createBasePool("database-atlantis");
        const pgvectorConvoStore = await PGVectorStore.initialize(ollamaEmbeddings, createPGConvoConfig(pg_basepool));
        
        const searchResults = await pgvectorConvoStore.similaritySearchWithScore(
            userMessage,
            5
        );
        
        console.log("Finished querying message history table!");
        pg_basepool.end();

        const filteredDocs = await gradeMessages(searchResults, userMessage);

        messages.push(new ToolMessage(`Here are some potentially relevant past conversations from long ago. Use them at your own discretion, and ensure that they are relevant before using this information as context. ${filteredDocs.join('\n\n')}`));

        return { messages: messages };
    
    } catch (error) {
        console.log(error);
        return "Error querying message history table.";
    }
}

async function gradeMessages(documents, question) {
    console.log("---GRADING: DOCUMENT RELEVANCE---");
    console.log(`Question: ${question}`);

    // Create a specialised llm to check relevancy of the documents retrieved

    const model = new ChatOllama({
        baseUrl: `http://${envconfig.endpoint}:11434`,
        model: 'llama3.1:8b',
        temperature: 0,
    });

    const llmWithTool = model.withStructuredOutput(
        z
          .object({
            binaryScore: z
              .enum(["yes", "no"])
              .describe("Relevance score 'yes' or 'no'"),
          })
          .describe(
            "Grade the relevance of the retrieved documents to the question. Either 'yes' or 'no'."
          ),
        {
            name: "grade",
        }
    );

    const prompt = ChatPromptTemplate.fromTemplate(
        `You are a grader assessing relevance of a retrieved document to a user question.
        Do consider the similarity score of the document when grading.
        Here is the retrieved document:
        
        {context}
        
        Here is the user question: {question}

        If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant.
        Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.`
    );

    const chain = prompt.pipe(llmWithTool);

    const filteredDocs = [];
    for await (const [doc, score] of documents) {
        const grade = await chain.invoke({
            context: `[Similarity Score: ${score}] ${doc.pageContent}`,
            question: question,
        });
        if (grade.binaryScore === "yes") {
            console.log("---GRADE: RELEVANT DOCUMENT---");
            const today = new Date(Date.now());
            const timeDiff = Math.floor((today-doc.metadata.date) / 1000 / 60 / 60 / 24);
            filteredDocs.push(`{
                [Similarity score: ${score}]\n
                Messages sent ${timeDiff ? `${timeDiff} day(s) ago.` : 'today.'}\n
                ${doc.pageContent}
                },\n\n`
            );
        } else {
            console.log("---GRADE: DOCUMENT NOT RELEVANT---");
        }
    }

    return filteredDocs;

}

async function gradeGenerationResult({ messages }) {
    console.log(`---GRADING: GENERATION RESULT---`);

    const lastMessage = messages[messages.length-1];
    console.log(`Message: ${lastMessage.content}`);

    const model = new ChatOllama({
        baseUrl: `http://${envconfig.endpoint}:11434`,
        model: 'llama3.1:8b',
        temperature: 0,
    });

    const llmWithTool = model.withStructuredOutput(
        z
          .object({
            binaryScore: z
              .enum(["yes", "no"])
              .describe("Relevance score 'yes' or 'no'"),
          })
          .describe(
            "Grade the relevance of the generated response to the question. Either 'yes' or 'no'."
          ),
        {
            name: "grade",
        }
    );

    const answerGraderPrompt = ChatPromptTemplate.fromTemplate(
        `You are a grader assessing relevance of a generated response to a user's message.
        Try to be more lenient and only grade completely irrelevant documents as 'no'.
        Here is the generated response:
        
        {generation}
        
        Here is the user's message: {question}
        
        If the document contains keyword(s) or semantic meaning related to the user message, grade it as relevant.
        Give a binary score 'yes' or 'no' score to indicate whether the response is relevant to the user's message.`
    );

    const chain = answerGraderPrompt.pipe(llmWithTool);
    // Invoke the chain and deconstruct binaryScore from the result.
    const { binaryScore } = await chain.invoke({
        generation: lastMessage.content,
        question: userMessage,
    });

    if (binaryScore === "yes") {
        console.log('Text generated is relevant; Ending...');
        return "__end__";
    } else {
        // If irrelevant, wipe previous data and regenerate.
        console.log('Irrelevant response; Regenerating...');
        messages.push(new ToolMessage(`Generated response was irrelevant. Try again.`))

        return "generate";
    }
}

async function shouldRetrievePastConvo({ messages }) {
    // const members = ['web_search', 'internal_database', 'no_retrieval'];
    console.log("---SHOULD RETRIEVE PAST CONVO---");

    const model = new ChatOllama({
        baseUrl: `http://${envconfig.endpoint}:11434`,
        model: 'llama3.1:8b',
        temperature: 0,
    });

    const prompt = ChatPromptTemplate.fromTemplate(
        `You are a grader assessing the need to retrieve past memories from a long time ago.
        Determine whether the conversation requires a memory, based on the user's message,
        and respond with either 'yes' or 'no', to indicate whether past memories need to be retrieved.

        Here is the user's message:
        {message}
        
        If the messages implies something that happened some time ago, indicate that a memory retrieval is needed.
        Give a binary score 'yes' or 'no' score to indicate whether past memories need to be retrieved.`
    );

    const llmWithTool = model.withStructuredOutput(
        z
            .object({
            binaryScore: z
                .enum(["yes", "no"])
                .describe("Need for past memory retrieval 'yes' or 'no'"),
            })
            .describe(
            "Grade the need to retrieve past memories from a database. Either 'yes' or 'no'."
            ),
        {
            name: "grade",
        }
    );

    const supervisorChain = prompt.pipe(llmWithTool);

    const supervisorChoice = await supervisorChain.invoke({
        message: userMessage,
    });
    console.log(supervisorChoice.binaryScore);
    
    if (supervisorChoice.binaryScore === "yes") {
        return "continue";
    } else {
        return "end"
    }
}

// This model will help decide whether or not to call a tool
async function callToolModel({ messages }) {
    console.log("---DETERMINING WHETHER TO CALL TOOLS---")

    const response = await toolModel.invoke(messages);
    console.log(response);
    return { messages: [response] };
}

// This function will help to fetch web search results, and parse them.
async function webSearch() {
    const webSearchPrompt = ChatPromptTemplate.fromTemplate(
        `You are a researcher that is capable of surfing the internet for external background information.
        Based on the user's message, generate a clean and simple search query to be used in the 
        search engine. 
        
        Here is the user's message:

        <message>
        {message}
        </message>

        Respond only with an improved search query. Do not include any preamble or explanation.
        `
    )

    const searchChain = webSearchPrompt.pipe(vanillaModel).pipe(new StringOutputParser());
    const query = await searchChain.invoke({
        message: userMessage
    })
    console.log(query);

    const responseArr = await langSearchTool.invoke({
        input: query,
    });
    console.log(responseArr);

    // TODO: Add web document parsing here
    return responseArr;
}

async function shouldSearchWeb({ messages }) {
    console.log("---SHOULD DO WEB SEARCH---")
    const prompt = ChatPromptTemplate.fromTemplate(
        `You are a grader assessing the need to retrieve information from the internet, based on the user's message.
        Determine whether the conversation requires external information from the web, based on the user's message,
        and respond with either 'yes' or 'no', to indicate whether a web search is required.

        Here is the user's message:
        {message}
        
        If the message is asking for external information, indicate that a web search is needed.
        Give a binary score 'yes' or 'no' score to indicate whether a web search is required.`
    );

    const llmWithTool = vanillaModel.withStructuredOutput(
        z
            .object({
            binaryScore: z
                .enum(["yes", "no"])
                .describe("Need for a web search, 'yes' or 'no'."),
            })
            .describe(
            "Grade the need to retrieve external information from the web. Either 'yes' or 'no'."
            ),
        {
            name: "grade",
        }
    );

    const searchChain = prompt.pipe(llmWithTool);

    const searchChoice = await searchChain.invoke({
        message: userMessage
    });
    
    if (searchChoice.binaryScore === "yes") {
        console.log("---WEB SEARCH---");
        const responses = await webSearch();
        messages.push(new ToolMessage(`Here are some results from a web search: ${responses}`));
        return { messages: messages };
    } else {
        console.log("---NO WEB SEARCH---");
        return { messages: messages };
    }
}

async function gradeDocuments(documents, question) {
    console.log("---GRADING: DOCUMENT RELEVANCE---");
    console.log(`Question: ${question}`);

    // Create a specialised llm to check relevancy of the documents retrieved

    const model = new ChatOllama({
        baseUrl: `http://${envconfig.endpoint}:11434`,
        model: 'llama3.1:8b',
        temperature: 0,
    });

    const llmWithTool = model.withStructuredOutput(
        z
          .object({
            binaryScore: z
              .enum(["yes", "no"])
              .describe("Relevance score 'yes' or 'no'"),
          })
          .describe(
            "Grade the relevance of the retrieved documents to the question. Either 'yes' or 'no'."
          ),
        {
            name: "grade",
        }
    );

    const prompt = ChatPromptTemplate.fromTemplate(
        `You are a grader assessing relevance of a retrieved document to a user question.
        Here is the retrieved document:
        
        {context}
        
        Here is the user question: {question}

        If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant.
        Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.`
    );

    const chain = prompt.pipe(llmWithTool);

    const filteredDocs = [];
    for await (const doc of documents) {
        const grade = await chain.invoke({
            context: `${doc.pageContent}`,
            question: question,
        });
        if (grade.binaryScore === "yes") {
            console.log("---GRADE: RELEVANT DOCUMENT---");
            filteredDocs.push(`{
                Source: ${doc.metadata.source}
                ${doc.pageContent}
                },\n\n`
            );
        } else {
            console.log("---GRADE: DOCUMENT NOT RELEVANT---");
        }
    }

    return filteredDocs;

}

async function retrieveDocuments({ messages }) {
    console.log("---SHOULD RETRIEVE DOCUMENTS---");

    // Decide whether to retrieve info
    const prompt = ChatPromptTemplate.fromTemplate(
        `You are a researcher assessing the need to retrieve information from a local knowledge base, based on the user's message.
        Determine whether the conversation requires external information from the knowledge base, based on the user's message,
        and respond with either 'yes' or 'no', to indicate whether retrieval is required.

        Here is the user's message:
        {message}
        
        If the message implies that external knowledge is needed as context, indicate that document retrieval is needed.
        Give a binary score 'yes' or 'no' score to indicate whether a web search is required.`
    );

    const llmWithTool = vanillaModel.withStructuredOutput(
        z
            .object({
            binaryScore: z
                .enum(["yes", "no"])
                .describe("Need for document retrieval, 'yes' or 'no'."),
            })
            .describe(
            "Grade the need to retrieve external information from the local knowledge base. Either 'yes' or 'no'."
            ),
        {
            name: "grade",
        }
    );

    const searchChain = prompt.pipe(llmWithTool);

    const searchChoice = await searchChain.invoke({
        message: userMessage
    });
    
    if (searchChoice.binaryScore === "yes") {
        // Create a new query from user's message
        const queryPrompt = ChatPromptTemplate.fromTemplate(
            `You are a researcher that is capable of searching databases efficiently for external background information.
            Based on the user's message, generate a clean and simple search query to be used in the 
            knowledge base. 
            
            Here is the user's message:

            <message>
            {message}
            </message>

            Respond only with an improved search query. Do not include any preamble or explanation.
            `
        )

        const queryChain = queryPrompt.pipe(vanillaModel).pipe(new StringOutputParser());
        const query = await queryChain.invoke({
            message: userMessage
        })

        console.log("---RETRIEVING DOCUMENTS---");
        console.log(`Query: ${query}`);

        try {
            const pg_basepool = createBasePool("database-atlantis");
            const pgvectorNotesStore = await PGVectorStore.initialize(ollamaEmbeddings, createPGDocumentConfig(pg_basepool, "notes"));
            const notesRetriever = pgvectorNotesStore.asRetriever({
                searchType: 'similarity',
                k: 5,
            });

            // TODO: Maybe let AI decide which tables + their respective weights
            const mainRetriever = new EnsembleRetriever({
                retrievers: [notesRetriever],
                weights: [1]
            });

            const retrievedDocs = await mainRetriever.invoke(query);
            console.log("Finished querying relevant documents!");
            console.log(retrievedDocs);
            pg_basepool.end();

            const filteredDocs = await gradeDocuments(retrievedDocs, query);
            console.log(filteredDocs);

            messages.push(new ToolMessage(`Here are some potentially relevant documents pertaining the user's question. Please further evaluate their relevance before using them as context. ${filteredDocs.join('\n\n')}`));
            return { messages: messages };
        
        } catch (error) {
            console.log(error);
            return "Error retrieving documents from database.";
        }

    } else {
        console.log("---NO DOCUMENT RETRIEVAL---");
        return { messages: messages };
    }
}

//-------------------------------------MARK: The Actual Graph-------------------------------------------

// Basically seperate the tool calling from the generative LLM.
// Continue invoking tools where necessary.
const workflow = new StateGraph(MessagesAnnotation) // TODO: To use GraphState, implement TS first.
    .addNode("getInitialUserMessage", async ({ messages }) => {
        userMessage = messages[messages.length - 1].content;
        console.log(userMessage);
        return { messages: messages };
    })
    // .addNode("rewriter", promptRewriter)
    .addNode("getPastConvo", getPastConversations)
    .addNode("generate", callModel)
    .addNode("retrieveDocs", retrieveDocuments)
    .addNode("searchTool", shouldSearchWeb)
    .addNode("toolAgent", callToolModel)
    .addNode("tools", toolNode)
    .addNode("removeExcess", async ({ messages }) => {
        messages.pop();
        return { messages: messages };
    })
    // Add Edges to the graph.
    .addEdge("__start__", "getInitialUserMessage")
    // TODO: Create "memories" instead of storing the entire convo
    .addConditionalEdges("getInitialUserMessage", shouldRetrievePastConvo, { continue: "getPastConvo", end: "searchTool"})
    // Fetch local information before going to the web
    .addEdge("getPastConvo", "searchTool")
    // Retrieve info from local knowledge base
    .addEdge("searchTool", "retrieveDocs")
    .addEdge("retrieveDocs", "toolAgent")
    .addConditionalEdges("toolAgent", shouldContinue, { continue: "tools", end: "removeExcess"})
    .addEdge("tools", "toolAgent")
    .addEdge("removeExcess", "generate")
    // Temporarily disabled self-reflection
    // .addConditionalEdges("generate", gradeGenerationResult, ["__end__", "generate"]);
    .addEdge("generate", "__end__")

export const defaultWorkflow = workflow.compile({
    checkpointer,
});