//----------------------------------Import dependencies--------------------------------------
// Import langchain stuff
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';

// Import Tools for the LLM to use
import { calculatorTool } from  '../tools/calculatorTool.js';
import { todoTool } from  '../tools/todoTool.js';

// Import extra stuff
import envconfig from '../secrets/env-config.json' with { type: "json" };

// Set up the tools
const tools = [calculatorTool, todoTool];
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