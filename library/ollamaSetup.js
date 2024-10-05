//----------------------------------Import dependencies--------------------------------------
// Import langchain stuff
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { AIMessage, HumanMessage, BaseMessage, ChatMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, START, END, Annotation } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ToolNode } from '@langchain/langgraph/prebuilt';

// Hugging Face dependencies
import { pipeline } from '@xenova/transformers';

// Import postgres stuff
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { createPGConvoConfig, createPGDocumentConfig, createBasePool } from '../databasing/database.js';

import { z } from "zod";

import { pull } from 'langchain/hub'

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
// console.log(tools);
const toolNode = new ToolNode(tools);
// const toolList = {
//     calculator: calculatorTool, // The key should match the "name" property of the tool.
//     todotool: todoTool
// }

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

const GraphState = Annotation.Root({
    question: '',
    generation: '',
    documents: []
})

// Define some functions
// Determine whether the LLM should continue on or end the conversation and reply to the user.
// This might be depreceated in favor of shouldRetrieve
function shouldContinue({ messages }) {
    console.log("---DETECT TOOL CALLS---");
    const lastMessage = messages[messages.length -1];
    // console.log(lastMessage);
    // If LLM made a tool call, we route to the "tools" node.
    if (lastMessage.tool_calls.length != 0) {
        console.log('Tool call detected - routing to tools node');
        return "tools";
    }
    // Otherwise, we end it here, and reply to the user.
    console.log('No tool call detected - routing back');
    return "__end__";
}

// Determine whether or not to retrieve 
function shouldRetrieve(state) {
    const { messages } = state;
    console.log("-----DECIDE TO RETRIEVE-----");
    const lastMessage = messages[messages.length -1];

    if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length) {
        console.log("-----DECISION: RETRIEVE-----");
        return "retrieve";
    }
    // If there are no tools calls we will finish here.
    return END;
}

// async function gradeDocuments(state) {
//     console.log("---GET RELEVANCE---");

//     const { messages } = state;
//     const tool = {
//         name: "give_relevance_score",
//         description: "Give a relevance score to the retrieved documents.",
//         schema: z.object({
//             binaryScore: z.string().describe("Relevance score 'yes' or 'no'"),
//         })
//     }

//     const prompt = ChatPromptTemplate.fromTemplate(
//         `You are a grader assessing relevance of retrieved docs to a user question.
//         Here are the retrieved docs:
//         \n ------- \n
//         {context} 
//         \n ------- \n
//         Here is the user question: {question}
//         If the content of the docs are relevant to the users question, score them as relevant.
//         Give a binary score 'yes' or 'no' score to indicate whether the docs are relevant to the question.
//         Yes: The docs are relevant to the question.
//         No: The docs are not relevant to the question.`,
//     );

//     const model = new ChatOllama({
//         model: "llama3.2:3b",
//         temperature: 0,
//     }).bindTools([tool]);

//     const chain = prompt.pipe(model);

//     const lastMessage = messages[messages.length - 1];

//     const score = await chain.invoke({
//         question: messages[0].content,
//         context: lastMessage.content
//     });

//     return {
//         messages: [score]
//     };
// }
  

function checkRelevance(state) {
    console.log("-----CHECK RELEVANCE-----");

    const { messages } = state;
    const lastMessage = messages[messages.length -1];
    if (!("tool_calls" in lastMessage)) {
        throw new Error("The 'checkRelevance' node requires the most recent message to contain tool calls.")
    }
    const toolCalls = (lastMessage).tool_calls;
    if (!toolCalls || !toolCalls.length) {
        throw new Error("Last message was not a function message");
    }

    if (toolCalls[0].args.binaryScore === "yes") {
        console.log("---DECISION: DOCS RELEVANT---");
        return "yes";
    }
    console.log("---DECISION: DOCS NOT RELEVANT---");
    return "no";
}

async function callModel(state) {
    console.log("---GENERATE---");
    // const filteredMessages = messages.filter((message) => {
    //     if ("tool_calls" in message && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    //         return message.tool_calls[0].name !== "give_relevance_score";
    //     }
    //     return true;
    // });

    const response = await ollama.invoke(state.messages);
    return { messages: [response] };
}

async function rewrite(state) {
    console.log("---TRANSFORM QUERY---");
  
    const { messages } = state;
    const question = messages[0].content;
    const prompt = ChatPromptTemplate.fromTemplate(
        `Look at the input and try to reason about the underlying semantic intent / meaning. \n 
        Here is the initial question:
        \n ------- \n
        {question} 
        \n ------- \n
        Formulate an improved question:`,
    );
  
    // Grader
    const model = new ChatOllama({
      model: "llama3.2:3b",
      temperature: 0,
      streaming: true,
    });

    const response = await prompt.pipe(model).invoke({ question });

    return { messages: [response] };
  }

async function generate(state) {
    console.log("-----GENERATE-----");
    
    const { messages } = state;
    const question = messages[0].content;

    // Extract the most recent ToolMessage
    const lastToolMessage = messages.slice().reverse().find((msg) => msg._getType() === "tool");
    if (!lastToolMessage) {
        throw new Error("No tool message found in the conversation history");
    }
  
    const docs = lastToolMessage.content;
  
    const prompt = await pull("rlm/rag-prompt");
  
    // const llm = new ChatOllama({
    //     model: "Wolfyre/aegis:v0.5",
    //     temperature: 0,
    //     streaming: true,
    // });
  
    const ragChain = prompt.pipe(ollama);
  
    const response = await ragChain.invoke({
        context: docs,
        question,
    });
  
    return { messages: [response] };
};

async function getPastConversations({ messages }) {
    const lastMessage = messages[messages.length - 1];
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

        messages.push(new ChatMessage(filteredDocs.join('\n\n')));

        return { messages: messages };

        // messages.push(new ChatMessage(`Here are some potentially relevant past conversations from long ago; take them with a grain of salt, as they are not necessarily useful. Please ensure that the information provided here is relevant before using them as context:\n\n${relevantConversations}`))
    
    } catch (error) {
        console.log(error);
        return "Error querying message history table.";
    }
}

async function gradeDocuments(documents, question) {
    console.log("---CHECK RELEVANCY---");
    console.log(`Question: ${question}`);

    const model = new ChatOllama({
        model: 'llama3.1:8b',
        temperature: 0,
    });

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
            context: doc.pageContent,
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

async function checkRelevantConvoHistory(state) {
    console.log("---CHECKING CONVO HISTORY---");
    const filteredDocs = await gradeDocuments(state.pastMessages, state.question);

    return {
        messages: [new ChatMessage(filteredDocs.join('\n\n'))],
    }
}

// Define a new graph.
// TODO: Use a different model to determine whether or not to call a tool.
// Basically seperate the tool calling from the generative LLM.
// Continue invoking tools where necessary.
const workflow = new StateGraph(MessagesAnnotation)
    .addNode("getPastConvo", getPastConversations)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "getPastConvo")
    .addEdge("getPastConvo", "agent")
    .addConditionalEdges("agent", shouldContinue, ["tools", "__end__"])
    .addEdge("tools", "agent");

export const defaultWorkflow = workflow.compile({
    checkpointer,
});