// This file contains all the routes for "test".

//--------------------------------------------------------MARK: Import necessary tools----------------------------------------------------------------
// Import langchain tools
import { HumanMessage } from '@langchain/core/messages';

// Import pgvector configurations and langchain tools
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { createPGConvoConfig, createPGDocumentConfig, createBasePool } from '../databasing/database.js';
import { v4 as uuidv4 } from 'uuid';

// Import express stuff and create the router
import express from 'express';
const router = express.Router();

// MARK: Set up Ollama related stuff
import { ChatOllama } from '@langchain/ollama';
import { ollamaEmbeddings as embeddings, defaultWorkflow } from '../library/ollamaSetup.ts';

import envconfig from '../secrets/env-config.json' with { type: "json" };

let prev_messages = []; // This stores the previous messages as a string.

const conversationId = uuidv4();
let messageSerialNo = 0;

//------------------------------------------------- MARK: Start defining routes------------------------------------------------------------------------
// router.post('/', async (req, res) => {
//     try {
//         // Receive incoming data
//         const userMessage = req.body.message;
//         messages.push(new HumanMessage(userMessage));

//         // Set up pg vector database when a request is made
//         const pg_basepool = createBasePool("database-atlantis");

//         // const pgvectorConvoStore = await PGVectorStore.initialize(embeddings, createPGConvoConfig(pg_basepool));
//         const pgvectorDocumentStore = await PGVectorStore.initialize(embeddings, createPGDocumentConfig(pg_basepool));

//         // Fetch any relevant data from knowledge base
//         // TODO: You should probably do some embedding here
//         const filter = { source: 'https://example.com' };
//         const documentQueryResults = await pgvectorDocumentStore.similaritySearch(
//             userMessage, // this is the mandatory query string
//             1, // this is the number of results to return; it is optional.
//             filter, // this is the optional filter to use.
//             // you may wish to use callbacks here as well, to handle success.
//         );
//         console.log("document query finished!");

//         // Format the results into a readable format
//         const documentArr = formatMessageArr(documentQueryResults);
//         console.log("Testing: Can documents be fetched?\n", documentArr);

//         // Add context here
//         messages.push(
//             new HumanMessage(`Some additional information; These are not necessary applicable, so please assess their relativity before using them in your resposne.:\n${documentArr.join("\n")}`)
//         )

//         const result = await ollama.invoke(messages); // returns an AIMessage Class object
//         messages.push(result);
        
//         // Use the tools
//         const toolMessageArr = await callTools(result.tool_calls);
//         messages = messages.concat(toolMessageArr);

//         // console.log("Messages before final result:\n", messages);

//         // Invoke again after using the tools
//         const finalResult = await ollama.invoke(messages);

//         // console.log(finalResult);

//         // Store the entire conversation in the pgvector database
        
//         // prev_messages.push(formatMessage('User', userMessage));
//         // prev_messages.push(formatMessage('You', result));
        
//         // Prepare a conversation document to be stored
//         // const current_conversation = {
//         //     pageContent: prev_messages.join('\n'),
//         //     metadata: {
//         //         date: Date.now(),
//         //     }
//         // }

//         // Check if the document already exists in the pgvector database:
//         // The first time a new conversation is started, there should be an error...
//         // try {
//         //     await pgvectorConvoStore.delete({ ids: [conversationID] });
//         //     console.log("Conversation deleted successfully...");
//         // } catch (e) {
//         //     console.log(e, "\nConversation does not exist yet; Creating new one...");
//         // }
//         // // Add the current conversation if it exists, or create a new one.
//         // await pgvectorConvoStore.addDocuments(
//         //     [current_conversation],
//         //     { ids: [conversationID] }
//         // )
//         // console.log("Conversation refreshed successfully");

//         // console.log(prev_messages);
//         console.log("Sending response data...");
//         pg_basepool.end(); // Ends the pool

//         res.json({
//             result: finalResult.content
//         });

//     } catch (err) {
//         console.log(err);
//         res.status(500).json({ error: 'An error occurred.' });
//     }
// });

router.post('/', async (req,res) => {
    const finalResult = await defaultWorkflow.invoke(
        { messages: [new HumanMessage({ content: `${req.body.name ? req.body.name : "Wolfyre" }: ${req.body.message}`, name: req.body.name })], },
        { configurable: { thread_id: "42" } },
    );
    // console.log(finalResult);
    try {
        const pg_basepool = createBasePool("database-atlantis");
        const pgvectorConvoStore = await PGVectorStore.initialize(embeddings, createPGConvoConfig(pg_basepool));
        
        // Prepare the interaction to be stored into the database
        const today = new Date(Date.now());
        const chatInteraction = {
            pageContent: `${req.body.message}\nAlyssa:${finalResult.messages[finalResult.messages.length - 1].content}`,
            metadata: {
                conversationId: conversationId,
                serialNo: messageSerialNo,
                date: today.toISOString(),
            }
        }

        await pgvectorConvoStore.addDocuments(
            [chatInteraction],
            { ids: [uuidv4()] }
        )

        pg_basepool.end(); // Ends the pool

    } catch (error) {
        console.log(error);
    }
    
    res.json({
        result: finalResult.messages[finalResult.messages.length - 1].content
    });
});

// router.post('/greeting', async (res, req) => {
//     const ollama = new ChatOllama({
//         baseUrl: `http://${envconfig.endpoint}:11434`,
//         model: 'aegis:v0.7',
//         keepAlive: -1
//     });

//     const response = await ollama.invoke(req.body.message);
//     res.json({
//         result: response
//     })
// })

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
});

export default router; // This will make the router available in the main app.js file.