// This file contains all the routes for "test".

// Import langchain tools
import { Ollama, OllamaEmbeddings } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { HttpResponseOutputParser } from 'langchain/output_parsers';

import express from 'express';
const router = express.Router();

// Create a simple prompt template
const basePrompt = PromptTemplate.fromTemplate("Chat History: {chat_history}\nuser: {message}");

const ollama = new Ollama({
    baseUrl: 'http://host.docker.internal:11434',
    model: 'aegis:v0.3',
    keepAlive: '30m'
});

// A helper function to format messages
const formatMessage = (role, messageContent) => {
    return `${role}: ${messageContent}`;
};

let prev_messages = '';

router.post('/', async (req, res) => {
    try {
        const userMessage = req.body.message;

        const chain = basePrompt.pipe(ollama);
        const result = await chain.invoke({
            chat_history: prev_messages,
            message: userMessage
        });
        
        prev_messages = prev_messages.concat(formatMessage('User', userMessage), "\n");
        prev_messages = prev_messages.concat(formatMessage('You', result), "\n");

        console.log(prev_messages);

        res.json({
            result: result
        });

    } catch (err) {
        console.log(err);
    }
});

// TODO: consider implementing streaming here next time

router.get('/extra', (req, res) => {
    res.send("Hello world! You found me!")
})

export default router; // This will make the router available in the main app.js file.