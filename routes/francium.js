// This file contains all the routes for "test".

//--------------------------------------------------------MARK: Import necessary tools----------------------------------------------------------------
// Import langchain tools
import { Ollama, OllamaEmbeddings } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { HttpResponseOutputParser } from 'langchain/output_parsers';

// Import pgvector configurations and langchain tools
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'
import { pgDocumentsConfig } from '../databasing/database.js';

// Import express stuff and create the router
import express from 'express';
const router = express.Router();

// MARK: Set up Ollama related stuff
const ollama = new Ollama({
    baseUrl: 'http://host.docker.internal:11434',
    model: 'aegis:v0.3',
    keepAlive: '-1'
});

// Use an embedding LLM to create embeds
const embeddings = new OllamaEmbeddings({
    baseUrl: "http://host.docker.internal:11434"
})

// Create a simple prompt template
const basePrompt = PromptTemplate.fromTemplate("Chat History: {chat_history}\nuser: {message}");

// MARK: Set up PG Vector Database
const pgvectorStore = await PGVectorStore.initialize(embeddings, pgDocumentsConfig);

// Define helper functions

// A helper function to format messages
const formatMessage = (role, messageContent) => {
    return `${role}: ${messageContent}`;
};

let prev_messages = ''; // This stores the previous messages as a string.

//------------------------------------------------- MARK: Start defining routes------------------------------------------------------------------------
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

router.get('/pgvector', async (req, res) => {
    try {
        const filter = { source: 'https://example.com' };

        const similaritySearchResults = await pgvectorStore.similaritySearch(
            "cat", // this is the mandatory query string
            2, // this is the number of results to return; it is optional.
            filter, // this is the optional filter to use.
            // you may wish to use callbacks here as well, to handle success.
        );

        res.json(similaritySearchResults);

    } catch (e) {
        console.log(e);
    };
})

export default router; // This will make the router available in the main app.js file.