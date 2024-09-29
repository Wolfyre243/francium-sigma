// This is a multi-purpose tool to create, delete or fetch tasks.
// Import langchain dependencies
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { tool } from '@langchain/core/tools';
// Import PG configs
import { createPGTodoConfig, createBasePool } from '../databasing/database.js';

import { ollamaEmbeddings as embeddings } from '../library/ollamaSetup.js';

// Misc
import { v4 as uuidv4 } from 'uuid';
import { z } from "zod";

const todoToolSchema = z.object({
    todo_name: z.string().describe("The name or title of the To-Do item."),
    todo_description: z.string().describe("A brief description of the To-Do item."),
    operation: z
      .enum(["create", "delete", "query"])
      .describe("The operation to perform with the given parameters. You may create a new To-Do item, delete an existing one, or query the database to check if the specified To-Do item exists."),
});

const initialiseTodoDatabase = async () => {
    const basepool = createBasePool("database-atlantis");
    return await PGVectorStore.initialize(embeddings, createPGTodoConfig(basepool))
}

export const todoTool = tool(
    async ({ todo_name, todo_description, operation }) => {
        switch (operation) {
            case 'create':
                console.log("Creating todo...");
                try {
                    const todoItem = {
                        pageContent: todo_name,
                        metadata: {
                            description: todo_description,
                            date_created: Date.now().toLocaleString('en-GB', { timeZone: 'GMT+8:00' }),
                        }
                    }
                    // Initialise a database and add the todo item.
                    const pgvectorTodoStore = await initialiseTodoDatabase();
                    await pgvectorTodoStore.addDocuments(
                        [todoItem],
                        { ids: [uuidv4()] }
                    )
                    console.log("Todo item created!");
                    return `Todo created:\nName: ${todo_name}\nDesc: ${todo_description}`
                } catch (error) {
                    console.log(error);
                    throw new Error("Error creating todo item");
                }
                
            case 'delete':
                // This part should be implemented according to your actual database logic
                console.log(`Todo deleted with name: ${todo_name}`);
                return `Todo deleted with name: ${todo_name}`
            case 'query':
                console.log(`Todo queried with name: ${todo_name}`);
                return `Todo found with name: ${todo_name}`
        }
    },
    {
        name: 'todotool',
        description: 'A tool to create a new To-Do item, delete an existing item, or query the database to check if a To-Do already exists. This todo tool is a tool for you to help me keep track of tasks that I EXPLICITLY tell you to create a To-Do for. DO NOT unecessarily create a to-do unless I explicitly tell you to.',
        schema: todoToolSchema,
    }
);