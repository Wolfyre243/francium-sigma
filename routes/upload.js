// This file contains all the routes for "test".

//--------------------------------------------------------MARK: Import necessary tools----------------------------------------------------------------
// Import langchain tools
import { HumanMessage } from '@langchain/core/messages';

// Import pgvector configurations and langchain tools
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { createPGDocumentConfig, createBasePool } from '../databasing/database.js';
import { v4 as uuidv4 } from 'uuid';

// Import file rreading tools
import fs from 'node:fs';
import path from 'node:path';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
// import { PPTXLoader } from "@langchain/community/document_loaders/fs/pptx";
// import pdfjs from 'pdfjs-dist/legacy/build/pdf.js'
import multer from 'multer';

const __dirname = import.meta.dirname;

// Import express stuff and create the router
import express from 'express';
const router = express.Router();

// MARK: Set up Ollama related stuff
import { ollamaEmbeddings as embeddings, defaultWorkflow } from '../library/ollamaSetup.js';
import { splitText } from '../library/textSplitter.js';

// Define multer stuff here
const serverStorageDocuments = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './ServerStorage/documents');
    },
    filename: function(req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const uploadDocs = multer({ storage: serverStorageDocuments });

// Helper functions
function createIDs(amount) {
    const ids = [];
    for (let i = 0; i < amount; i++) {
        ids.push(uuidv4());
    }
    return ids;
}

// 'files' has to be the same name as the name of the input field in the form
// Max 10 files at a time
router.post('/notes', uploadDocs.array('files', 10), async (req, res) => {
    // Redirect the user first
    res.redirect("/dashboard/upload");

    // Initialise database
    const pg_basepool = createBasePool("database-atlantis");
    const pgvectorDocumentStore = await PGVectorStore.initialize(embeddings, createPGDocumentConfig(pg_basepool, "notes"));
    
    // TODO: Add file extension detection here

    // DEV
    const startTime = Date.now();

    const promiseList = [];
    const docsToUpload = [];

    // For each file sent to the server, parse them as PDFs
    for await (const file of req.files) {
        // TODO: Ensure no dupe documents are uploaded.
        const filePath = file.path;

        // Parse PDF files
        const pdfLoader = new PDFLoader(filePath, {
            parsedItemSeparator: ''
        });
        const docs = await pdfLoader.load();
        promiseList.push(
            splitText(docs)
                .then(async (chunkedDocs) => {
                    // Create a uuid for the parent document
                    const parentID = uuidv4();

                    // Assign additional metadata
                    for (const doc of chunkedDocs) {
                        doc.metadata.date_uploaded = (new Date(Date.now())).toISOString();
                        doc.metadata.filename = file.originalname;
                        doc.metadata.parentID = parentID;
                    };

                    // Store documents into the database.
                    console.log('Uploading docs...');
                    await pgvectorDocumentStore.addDocuments(chunkedDocs, {
                        ids: createIDs(chunkedDocs.length)
                    });

                    return chunkedDocs;
                })
        );
    };

    console.log(promiseList);

    Promise.all(promiseList).then(() => {
        // DEV
        console.log('Time taken to upload: ', Date.now() - startTime + 'ms');
        pg_basepool.end();
    });

    
});

router.post('/test', uploadDocs.array('files', 10), async (req, res) => {
    console.log(req.files);
    res.redirect("/dashboard/upload");
})

export default router;