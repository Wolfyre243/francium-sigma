// This file contains all the routes for "test".

//--------------------------------------------------------MARK: Import necessary tools----------------------------------------------------------------
// Import langchain tools
import { HumanMessage } from '@langchain/core/messages';

// Import pgvector configurations and langchain tools
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'
import { createPGConvoConfig, createPGDocumentConfig, createBasePool } from '../databasing/database.js';
// import { v4 as uuidv4 } from 'uuid';

// Import helper functions
import { formatMessage, formatMessageArr } from '../library/formatter.js';

// Import express stuff and create the router
import express from 'express';
const router = express.Router();

// MARK: Set up Ollama related stuff
import { ollama, ollamaEmbeddings as embeddings, callTools, defaultWorkflow } from '../library/ollamaSetup.js';

// MARK: Create a simple prompt template
// const basePrompt = PromptTemplate.fromTemplate(
//     `Current Chat History: {chat_history}
//     Some additional information; These are not necessary applicable, so please assess their relativity before using them in your resposne.:
//     {documents}
//     user: {message}`
// );

let prev_messages = []; // This stores the previous messages as a string.
let messages = [];

// Generate a uid for the current conversation.
// This will be refreshed every time the server is restarted.
// This helps the server track the current conversation.
// const conversationID = uuidv4();



//------------------------------------------------- MARK: Start defining routes------------------------------------------------------------------------
// TODO: Add better error handling here
router.post('/', async (req, res) => {
    try {
        // Receive incoming data
        const userMessage = req.body.message;
        messages.push(new HumanMessage(userMessage));

        // Set up pg vector database when a request is made
        const pg_basepool = createBasePool("database-atlantis");

        // const pgvectorConvoStore = await PGVectorStore.initialize(embeddings, createPGConvoConfig(pg_basepool));
        const pgvectorDocumentStore = await PGVectorStore.initialize(embeddings, createPGDocumentConfig(pg_basepool));

        // Fetch any relevant data from knowledge base
        // TODO: You should probably do some embedding here
        const filter = { source: 'https://example.com' };
        const documentQueryResults = await pgvectorDocumentStore.similaritySearch(
            userMessage, // this is the mandatory query string
            1, // this is the number of results to return; it is optional.
            filter, // this is the optional filter to use.
            // you may wish to use callbacks here as well, to handle success.
        );
        console.log("document query finished!");

        // Format the results into a readable format
        const documentArr = formatMessageArr(documentQueryResults);
        console.log("Testing: Can documents be fetched?\n", documentArr);

        // Add context here
        messages.push(
            new HumanMessage(`Some additional information; These are not necessary applicable, so please assess their relativity before using them in your resposne.:\n${documentArr.join("\n")}`)
        )

        const result = await ollama.invoke(messages); // returns an AIMessage Class object
        messages.push(result);
        
        // Use the tools
        const toolMessageArr = await callTools(result.tool_calls);
        messages = messages.concat(toolMessageArr);

        // console.log("Messages before final result:\n", messages);

        // Invoke again after using the tools
        const finalResult = await ollama.invoke(messages);

        // console.log(finalResult);

        // Store the entire conversation in the pgvector database
        
        // prev_messages.push(formatMessage('User', userMessage));
        // prev_messages.push(formatMessage('You', result));
        
        // Prepare a conversation document to be stored
        // const current_conversation = {
        //     pageContent: prev_messages.join('\n'),
        //     metadata: {
        //         date: Date.now(),
        //     }
        // }

        // Check if the document already exists in the pgvector database:
        // The first time a new conversation is started, there should be an error...
        // try {
        //     await pgvectorConvoStore.delete({ ids: [conversationID] });
        //     console.log("Conversation deleted successfully...");
        // } catch (e) {
        //     console.log(e, "\nConversation does not exist yet; Creating new one...");
        // }
        // // Add the current conversation if it exists, or create a new one.
        // await pgvectorConvoStore.addDocuments(
        //     [current_conversation],
        //     { ids: [conversationID] }
        // )
        // console.log("Conversation refreshed successfully");

        // console.log(prev_messages);
        console.log("Sending response data...");
        pg_basepool.end(); // Ends the pool

        res.json({
            result: finalResult.content
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'An error occurred.' });
    }
});

router.post('/agent', async (req,res) => {
    const finalResult = await defaultWorkflow.invoke(
        { messages: [new HumanMessage(req.body.message)] },
        { configurable: { thread_id: "42" } },
    );
    console.log(finalResult);

    res.json({
        result: finalResult.messages[finalResult.messages.length - 1].content
    })
})

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