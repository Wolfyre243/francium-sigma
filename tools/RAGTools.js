// This is a multi-purpose tool to create, delete or fetch tasks.
// Import langchain dependencies
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { tool, BaseToolkit } from '@langchain/core/tools';
// Import PG configs
import { createPGTodoConfig, createPGConvoConfig, createBasePool } from '../databasing/database.js';

import { ollamaEmbeddings as embeddings } from '../library/ollamaSetup.js';

// Misc
// import { v4 as uuidv4 } from 'uuid';
import { z } from "zod";

// Define tool schema
const messageRAGschema = z.object({
    query: z.string().describe("A query to be passed into the vector database to look for information you desire."),
});

export const messageRAGTool = tool(
    async ({ query }) => {
        console.log('Querying message history table...');
        try {
            const pg_basepool = createBasePool("database-atlantis");
            const pgvectorConvoStore = await PGVectorStore.initialize(embeddings, createPGConvoConfig(pg_basepool));
            
            const searchResults = await pgvectorConvoStore.similaritySearch(
                query,
                5
            );

            const relevantConversations = searchResults.map(doc => doc.pageContent + '\n');
            console.log("Finished querying message history table!");

            // TODO: add reranking here


            return `Here are some potentially relevant past conversations; take them with a grain of salt, as they are not necessarily useful. Please ensure that the information provided here is relevant before using them as context:\n\n${relevantConversations}`;
        
        } catch (error) {
            console.log(error);
            throw new Error('Error querying message history table.');
        }
    },
    {
        name: 'messageRAGTool',
        description: 'A tool that allows you to query a vector database for similar conversations made in the past.',
        schema: messageRAGschema,
    }
)