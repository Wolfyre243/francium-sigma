//----------------------------------Import dependencies--------------------------------------
// Import langchain stuff
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, START, END, Annotation } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ToolNode } from '@langchain/langgraph/prebuilt';

import { z } from "zod";

import { pull } from 'langchain/hub'

import { MemorySaver } from '@langchain/langgraph';
const checkpointer = new MemorySaver();

// Import Tools for the LLM to use
import { calculatorTool } from  '../tools/calculatorTool.js';
import { todoToolkit } from  '../tools/todoTool.js';

// Import extra stuff
import envconfig from '../secrets/env-config.json' with { type: "json" };

// Set up the tools
let tools = [calculatorTool, todoToolkit];
tools = tools.flat();
// console.log(tools);
const toolNode = new ToolNode(tools);
// const toolList = {
//     calculator: calculatorTool, // The key should match the "name" property of the tool.
//     todotool: todoTool
// }

export const ollama = new ChatOllama({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    model: 'Wolfyre/aegis:v0.5',
    keepAlive: -1
}).bindTools(tools);

export const ollamaEmbeddings = new OllamaEmbeddings({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    keepAlive: -1
});

// Define some functions
// Determine whether the LLM should continue on or end the conversation and reply to the user.
// This might be depreceated in favor of shouldRetrieve
// Nevermind whatever that was it was confusing af
function shouldContinue({ messages }) {
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

async function gradeDocuments(state) {
    console.log("---GET RELEVANCE---");

    const { messages } = state;
    const tool = {
        name: "give_relevance_score",
        description: "Give a relevance score to the retrieved documents.",
        schema: z.object({
            binaryScore: z.string().describe("Relevance score 'yes' or 'no'"),
        })
    }

    const prompt = ChatPromptTemplate.fromTemplate(
        `You are a grader assessing relevance of retrieved docs to a user question.
        Here are the retrieved docs:
        \n ------- \n
        {context} 
        \n ------- \n
        Here is the user question: {question}
        If the content of the docs are relevant to the users question, score them as relevant.
        Give a binary score 'yes' or 'no' score to indicate whether the docs are relevant to the question.
        Yes: The docs are relevant to the question.
        No: The docs are not relevant to the question.`,
    );

    const model = new ChatOllama({
        model: "llama3.2:3b",
        temperature: 0,
    }).bindTools([tool]);

    const chain = prompt.pipe(model);

    const lastMessage = messages[messages.length - 1];

    const score = await chain.invoke({
        question: messages[0].content,
        context: lastMessage.content
    });

    return {
        messages: [score]
    };
}
  

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
    console.log("-----CALL MODEL-----");
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

// Define a new graph.
const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addEdge("__start__", "agent")
    .addNode("tools", toolNode)
    .addEdge("tools", "agent")
    .addConditionalEdges("agent", shouldContinue)

export const defaultWorkflow = workflow.compile({
    checkpointer,
});