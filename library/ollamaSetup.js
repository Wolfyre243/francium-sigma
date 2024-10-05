//----------------------------------MARK: Import dependencies--------------------------------------
// Import langchain stuff
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { AIMessage, HumanMessage, BaseMessage, ChatMessage, ToolMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, START, END, Annotation } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts'
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
}).bindTools(tools);

export const ollamaEmbeddings = new OllamaEmbeddings({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    keepAlive: -1
    // TODO: Change the model instead of using default
});

const model = new ChatOllama({
    model: 'llama3.1:8b',
    temperature: 0,
    keepAlive: "30m"
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
        return "tools";
    }
    // Otherwise, we end it here, and reply to the user.
    console.log('No tool call detected - routing back');
    return "gradeLLMResponse";
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
    const lastMessage = messages[messages.length - 1];
    userMessage = lastMessage;

    console.log("---GET PAST CONVERSATIONS---");
    try {
        const pg_basepool = createBasePool("database-atlantis");
        const pgvectorConvoStore = await PGVectorStore.initialize(ollamaEmbeddings, createPGConvoConfig(pg_basepool));
        
        const searchResults = await pgvectorConvoStore.similaritySearchWithScore(
            lastMessage.content,
            5
        );

        // const relevantConversations = searchResults.map(doc => doc.pageContent + '\n');
        // TODO: add how long ago the messages were sent here
        // const today = new Date(Date.now())
        // let relevantConversations = '';
        // for (const [doc, score] of searchResults) {
        //     const timeDiff = Math.floor((today-doc.metadata.date) / 1000 / 60 / 60 / 24)
        //     relevantConversations += `{
        //     [Similarity score: ${score}]\n
        //     Messages sent ${timeDiff ? `${timeDiff} day(s) ago.` : 'today.'}\n
        //     ${doc.pageContent}
        //     },\n\n`;
        // }
        
        console.log("Finished querying message history table!");
        pg_basepool.end();

        const filteredDocs = await gradeDocuments(searchResults, lastMessage.content);

        messages.push(new ToolMessage(`Here are some potentially relevant past conversations from long ago. Use them at your own discretion, and ensure that they are relevant before using this information as context. ${filteredDocs.join('\n\n')}`));

        return { messages: messages };

        // messages.push(new ChatMessage(`Here are some potentially relevant past conversations from long ago; take them with a grain of salt, as they are not necessarily useful. Please ensure that the information provided here is relevant before using them as context:\n\n${relevantConversations}`))
    
    } catch (error) {
        console.log(error);
        return "Error querying message history table.";
    }
}

async function gradeDocuments(documents, question) {
    console.log("---GRADING: DOCUMENT RELEVANCE---");
    console.log(`Question: ${question}`);

    // Create a specialised llm to check relevancy of the documents retrieved
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

    const answerGraderPrompt = ChatPromptTemplate.fromTemplate(
        `You are a grader assessing relevance of a generated response to a user's message.
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
        messages.push(new HumanMessage(`Please regenerate a better response.`))

        return "agent";
    }
}

//-------------------------------------MARK: The Actual Graph-------------------------------------------
// TODO: Use a different model to determine whether or not to call a tool.
// Basically seperate the tool calling from the generative LLM.
// Continue invoking tools where necessary.
const workflow = new StateGraph(MessagesAnnotation)
    .addNode("getPastConvo", getPastConversations)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addNode("gradeLLMResponse", async ({ messages }) => {
        return { messages: messages };
    })
    .addEdge("__start__", "getPastConvo")
    .addEdge("getPastConvo", "agent")
    .addConditionalEdges("agent", shouldContinue, ["tools", "gradeLLMResponse"])
    .addEdge("tools", "agent")
    .addConditionalEdges("gradeLLMResponse", gradeGenerationResult, ["__end__", "agent"]);

export const defaultWorkflow = workflow.compile({
    checkpointer,
});