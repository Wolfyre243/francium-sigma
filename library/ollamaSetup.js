//----------------------------------Import dependencies--------------------------------------
// Import langchain stuff
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

import { MemorySaver } from '@langchain/langgraph';
const checkpointer = new MemorySaver();

// Import Tools for the LLM to use
import { calculatorTool } from  '../tools/calculatorTool.js';
import { todoTool } from  '../tools/todoTool.js';

// Import extra stuff
import envconfig from '../secrets/env-config.json' with { type: "json" };
import { Tool } from '@langchain/core/tools';

// Set up the tools
const tools = [calculatorTool, todoTool];
const toolNode = new ToolNode(tools);
const toolList = {
    calculator: calculatorTool, // The key should match the "name" property of the tool.
    todotool: todoTool
}

export const ollama = new ChatOllama({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    model: 'Wolfyre/aegis:v0.5',
    keepAlive: -1
}).bindTools(tools);

export const ollamaEmbeddings = new OllamaEmbeddings({
    baseUrl: `http://${envconfig.endpoint}:11434`,
    keepAlive: -1
});

export const callTools = async (toolCallArr) => {
    const toolMessageArr = [];
    for (const toolCall of toolCallArr) {
        try {
            console.log('Calling tool:\n', toolCall); // verbose to see what the AI is trying to do with the tools
            const selectedTool = toolList[toolCall.name];
            const toolMessage = await selectedTool.invoke(toolCall);
            toolMessageArr.push(toolMessage);
        } catch (error) {
            console.log(`Error invoking tool - ${error}`);
        }
    };
    return toolMessageArr;
};

// Define some functions
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

async function callModel(state) {
    const response = await ollama.invoke(state.messages);

    // Return a list, as this will be added to the existing list.
    console.log('Calling model - returning response');
    return { messages: [response] };
}

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