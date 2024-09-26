// This file contains all the routes for "test".

//--------------------------------------------------------MARK: Import necessary tools----------------------------------------------------------------
// Import langchain tools
import { Ollama, OllamaEmbeddings } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { HttpResponseOutputParser } from 'langchain/output_parsers';

// Import pgvector configurations and langchain tools
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'
import { pgDocumentsConfig, pgConversationConfig } from '../databasing/database.js';
import { v4 as uuidv4 } from 'uuid';

// Import express stuff and create the router
import express from 'express';
const router = express.Router();

// MARK: Set up Ollama related stuff
const ollama = new Ollama({
    baseUrl: 'http://host.docker.internal:11434',
    model: 'aegis:v0.3',
    keepAlive: '30m'
});

// Use an embedding LLM to create embeds
const embeddings = new OllamaEmbeddings({
    baseUrl: "http://host.docker.internal:11434",
})

// MARK: Create a simple prompt template
const basePrompt = PromptTemplate.fromTemplate(
    `Current Chat History: {chat_history}
    Some additional information; These are not necessary applicable, so please assess their relativity before using them in your resposne.:
    {documents}
    user: {message}`
);

// Define helper functions

// A helper function to format messages
const formatMessage = (role, messageContent) => {
    return `${role}: ${messageContent}\n`;
};

let prev_messages = []; // This stores the previous messages as a string.

// Generate a uid for the current conversation.
// This will be refreshed every time the server is restarted.
// This helps the server track the current conversation.
const conversationID = uuidv4();

//------------------------------------------------- MARK: Start defining routes------------------------------------------------------------------------
// TODO: Add better error handling here
router.post('/', async (req, res) => {
    try {
        // Receive incoming data
        const userMessage = req.body.message;

        // Set up pg vector database when a request is made
        const pgvectorConvoStore = await PGVectorStore.initialize(embeddings, pgConversationConfig);
        const pgvectorDocumentStore = await PGVectorStore.initialize(embeddings, pgDocumentsConfig);

        // Fetch old relevant conversation history
        // const convohistQueryResults = await pgvectorConvoStore.similaritySearch(
        //     userMessage,
        //     5
        // );

        // Fetch any relevant data from knowledge base
        // TODO: You should probably do some embedding here
        const filter = { source: 'https://example.com' };
        const documentQueryResults = await pgvectorDocumentStore.similaritySearch(
            userMessage, // this is the mandatory query string
            1, // this is the number of results to return; it is optional.
            filter, // this is the optional filter to use.
            // you may wish to use callbacks here as well, to handle success.
        );
        console.log("document query finished!")

        //TODO: turn this into a function in a seperate file
        // Format the results into a readable format
        const documentArr = [];
        for await (const document of documentQueryResults) {
            documentArr.push(document.pageContent);
        };
        // Format the results into a readable format
        // const convohistArr = [];
        // for await (const item of convohistQueryResults) {
        //     convohistArr.push(item.pageContent);
        // };

        // console.log(documentQueryResults);

        const chain = basePrompt.pipe(ollama);
        const result = await chain.invoke({
            chat_history: prev_messages.join('\n'),
            documents: documentArr.join("\n"),
            // past_conversations: convohistArr.join("\n"),
            message: userMessage
        });

        // Store the entire conversation in the pgvector database
        
        prev_messages.push(formatMessage('User', userMessage));
        prev_messages.push(formatMessage('You', result));
        
        // Prepare a conversation document to be stored
        const current_conversation = {
            pageContent: prev_messages.join('\n'),
            metadata: {
                date: Date.now(),
            }
        }

        // Check if the document already exists in the pgvector database:
        // The first time a new conversation is started, there should be an error...
        try {
            await pgvectorConvoStore.delete({ ids: [conversationID] });
            console.log("Conversation deleted successfully...");
        } catch (e) {
            console.log(e, "\nConversation does not exist yet; Creating new one...");
        }
        // Add the current conversation if it exists, or create a new one.
        await pgvectorConvoStore.addDocuments(
            [current_conversation],
            { ids: [conversationID] }
        )
        console.log("Conversation refreshed successfully");

        // console.log(prev_messages);

        res.json({
            result: result
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'An error occurred.' });
    }
});

// TODO: consider implementing streaming here next time

// POST request for discord.js to inialize a conversation with provided context
router.put('/discord-init', async (req, res) => {
    // If context is given, override server's saved context.
    // So, when initiating a conversation, pass in the context
    if (req.body.context) {
        prev_messages = req.body.context;
    }

    console.log("Discord initialized:\n", prev_messages);

    res.json(prev_messages);
})

// TODO: add querying api for pgvector here
router.get('/pgvector', async (req, res) => {
    try {
        // Initialise a document store instance
        const pgvectorDocumentStore = await PGVectorStore.initialize(embeddings, pgDocumentsConfig);

        const filter = { source: 'https://example.com' };

        const similaritySearchResults = await pgvectorDocumentStore.similaritySearch(
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