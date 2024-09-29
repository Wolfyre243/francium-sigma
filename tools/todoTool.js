// This is a multi-purpose tool to create, delete or fetch tasks.
// Import langchain dependencies
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { tool, BaseToolkit } from '@langchain/core/tools';
// Import PG configs
import { createPGTodoConfig, createBasePool } from '../databasing/database.js';

import { ollamaEmbeddings as embeddings } from '../library/ollamaSetup.js';

// Misc
import { v4 as uuidv4 } from 'uuid';
import { z } from "zod";

// Define schemas
const createTodoSchema = z.object({
    todo_name: z.string().describe("The name or title of the To-Do item."),
    todo_description: z.string().describe("A brief description of the To-Do item.")
});

const deleteTodoSchema = z.object({
    todo_name: z.string().describe("The name or title of the To-Do item."),
    todo_description: z.string().describe("A brief description of the To-Do item.")
});

const findTodoSchema = z.object({
    todo_name: z.string().describe("The name or title of the To-Do item."),
    todo_description: z.string().describe("A brief description of the To-Do item.")
});

const initialiseTodoDatabase = async () => {
    const basepool = createBasePool("database-atlantis");
    return await PGVectorStore.initialize(embeddings, createPGTodoConfig(basepool))
};

// export const todoTool = tool(
//     async ({ todo_name, todo_description, operation }) => {
//         switch (operation) {
//             case 'create':
//                 console.log("Creating todo...");
//                 try {
//                     const todoItem = {
//                         pageContent: todo_name,
//                         metadata: {
//                             description: todo_description,
//                             date_created: Date.now().toLocaleString('en-GB', { timeZone: 'GMT+8:00' }),
//                         }
//                     }
//                     // Initialise a database and add the todo item.
//                     const pgvectorTodoStore = await initialiseTodoDatabase();
//                     await pgvectorTodoStore.addDocuments(
//                         [todoItem],
//                         { ids: [uuidv4()] }
//                     )
//                     console.log("Todo item created!");
//                     return `Todo created:\nName: ${todo_name}\nDesc: ${todo_description}`
//                 } catch (error) {
//                     console.log(error);
//                     throw new Error("Error creating todo item");
//                 }
                
//             case 'delete':
//                 // This part should be implemented according to your actual database logic
//                 console.log(`Todo deleted with name: ${todo_name}`);
//                 // Search the database and get the ID of the task to delete.
//                 // Delete the task using the ID.
//                 return `Todo deleted with name: ${todo_name}`
//             case 'query':
//                 console.log(`Todo queried with name: ${todo_name}`);
//                 // Return a formatted list of To-dos.
//                 return `Todo found with name: ${todo_name}`
//         }
//     },
//     {
//         name: 'todotool',
//         description: 'A tool to create a new To-Do item, delete an existing item, or query the database to check if a To-Do already exists. This todo tool is a tool for you to help me keep track of tasks that I EXPLICITLY tell you to create a To-Do for.',
//         schema: todoToolSchema,
//     }
// );

// TODO: I don't think we should let the LLM create tools...
const createTodoTool = tool(
    async ({ todo_name, todo_description }) => {
        console.log("Creating todo...");
        try {
            const todoItem = {
                pageContent: todo_name,
                metadata: {
                    description: todo_description,
                    date_created: Date.now().toLocaleString('en-GB'),
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
    },
    {
        name: 'createTodoTool',
        description: 'A tool to create a new task item. This tool creates new tasks and stores them in the database.',
        schema: createTodoSchema,
    }
);

const deleteTodoTool = tool(
    async ({ todo_name, todo_description }) => {
        // This part should be implemented according to your actual database logic
        console.log(`Todo deleted with name: ${todo_name}`);
        // Search the database and get the ID of the task to delete.
        // Delete the task using the ID.
        return `Todo deleted with name: ${todo_name}`
    },
    {
        name: 'deleteTodoTool',
        description: 'A tool to delete an existing To-Do item. This tool is a tool for you to delete any existing tasks when I tell you to.',
        schema: deleteTodoSchema,
    }
);

// TODO: This tool needs a big rework. Let the LLM decide whether to list a few relevant To-dos, or instead list ALL todos.
// Better yet, let the LLM generate an SQL prompt to query the database. This is however, risky.
const queryTodoTool = tool(
    async ({ todo_name, todo_description }) => {
        console.log(`Todo queried with name: ${todo_name}`);
        // Return a formatted list of To-dos.
        return `Todo found with name: ${todo_name}`
    },
    {
        name: 'deleteTodoTool',
        description: 'A tool to query the To-do database to search for a specific to-do. It returns a list of potentially relevant To-dos for you to show me.',
        schema: findTodoSchema,
    }
);

export const todoToolkit = [createTodoTool, deleteTodoTool, queryTodoTool];