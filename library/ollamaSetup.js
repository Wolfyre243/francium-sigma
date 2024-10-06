//----------------------------------MARK: Import dependencies--------------------------------------
// Import langchain stuff
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { AIMessage, HumanMessage, BaseMessage, ChatMessage, ToolMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, START, END, Annotation } from '@langchain/langgraph';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { ToolNode } from '@langchain/langgraph/prebuilt';

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
import { searchTool } from   '../tools/searchTools.js';

// Import extra stuff
import envconfig from '../secrets/env-config.json' with { type: "json" };

// Set up the tools
let tools = [calculatorTool, todoToolkit, searchTool];
tools = tools.flat();
const toolNode = new ToolNode(tools);

export const ollama = new ChatOllama({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    model: 'aegis:v0.6',
    keepAlive: -1
});

export const ollamaEmbeddings = new OllamaEmbeddings({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    keepAlive: -1
    // TODO: Change the model instead of using default
});

const model = new ChatOllama({
    model: 'llama3.1:8b',
    temperature: 0,
});

const toolModel = model.bindTools(tools);

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
        return "tools";
    }
    // Otherwise, we end it here, and reply to the user.
    console.log('No tool call detected - routing back');
    return "removeExcess";
}

// TODO: add a "decision maker" here to decide whether to retrieve from the local database or search online instead.
// However, I'm not sure whether to make it check if local database is sufficient before searching online.
// I'll need some test documents before trying this out though

async function callModel(state) {
    console.log("---GENERATE---");

    const response = await ollama.invoke(state.messages);
    return { messages: [response] };
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

        const filteredDocs = await gradeDocuments(searchResults, userMessage);

        messages.push(new ToolMessage(`Here are some potentially relevant past conversations from long ago. Use them at your own discretion, and ensure that they are relevant before using this information as context. ${filteredDocs.join('\n\n')}`));

        return { messages: messages };
    
    } catch (error) {
        console.log(error);
        return "Error querying message history table.";
    }
}

async function gradeDocuments(documents, question) {
    console.log("---GRADING: DOCUMENT RELEVANCE---");
    console.log(`Question: ${question}`);

    // Create a specialised llm to check relevancy of the documents retrieved

    const model = new ChatOllama({
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

        return "agent";
    }
}

async function shouldRetrievePastConvo({ messages }) {
    // const members = ['web_search', 'internal_database', 'no_retrieval'];
    console.log("---SHOULD RETRIEVE PAST CONVO---");

    const model = new ChatOllama({
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
        return "getPastConvo";
    } else {
        return "toolAgent"
    }
}

// TODO: Use a different model to determine whether or not to call a tool.
// This model will help decide whether or not to call a tool
async function callToolModel({ messages }) {
    console.log("---DETERMINING WHETHER TO CALL TOOLS---")

    const response = await toolModel.invoke(messages);
    return { messages: [response] };
}

//-------------------------------------MARK: The Actual Graph-------------------------------------------

// Basically seperate the tool calling from the generative LLM.
// Continue invoking tools where necessary.
const workflow = new StateGraph(MessagesAnnotation) // TODO: To use GraphState, implement TS first.
    // TODO: Add a supervisor to determine next course of action
    .addNode("getInitialUserMessage", async ({ messages }) => {
        userMessage = messages[messages.length - 1].content;
        console.log(userMessage);
        return { messages: messages };
    })
    .addNode("getPastConvo", getPastConversations)
    .addNode("generate", callModel)
    .addNode("toolAgent", callToolModel)
    .addNode("tools", toolNode)
    .addNode("removeExcess", async ({ messages }) => {
        messages.pop();
        return { messages: messages };
    })
    // Add Edges to the graph.
    .addEdge("__start__", "getInitialUserMessage")
    .addConditionalEdges("getInitialUserMessage", shouldRetrievePastConvo, ["getPastConvo", "toolAgent"])
    .addEdge("getPastConvo", "toolAgent")
    .addConditionalEdges("toolAgent", shouldContinue, ["tools", "removeExcess"])
    .addEdge("tools", "toolAgent")
    .addEdge("removeExcess", "generate")
    .addConditionalEdges("generate", gradeGenerationResult, ["__end__", "generate"]);

export const defaultWorkflow = workflow.compile({
    checkpointer,
});