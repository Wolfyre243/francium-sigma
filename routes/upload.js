// This file contains all the routes for "test".

//--------------------------------------------------------MARK: Import necessary tools----------------------------------------------------------------
// Import langchain tools
import { HumanMessage } from '@langchain/core/messages';

// Import pgvector configurations and langchain tools
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { createPGDocumentConfig, createBasePool } from '../databasing/database.js';
import { v4 as uuidv4 } from 'uuid';

// Import file rreading tools
import fs from 'fs';
import path from 'path';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
// import { PPTXLoader } from "@langchain/community/document_loaders/fs/pptx";
// import pdfjs from 'pdfjs-dist/legacy/build/pdf.js'
const __dirname = import.meta.dirname;

// Import express stuff and create the router
import express from 'express';
const router = express.Router();

// MARK: Set up Ollama related stuff
import { ollamaEmbeddings as embeddings, defaultWorkflow } from '../library/ollamaSetup.js';
import { splitText } from '../library/textSplitter.js';

function createIDs(amount) {
    const ids = [];
    for (let i = 0; i < amount; i++) {
        ids.push(uuidv4());
    }
    return ids;
}

router.post('/notes', async (req, res) => {
    // TODO: In the future, create a simple front-end to upload documents, temporarily.
    // For now, we will be passing in the file path instead.

    // TODO: Ensure no dupe documents are uploaded.
    const fileName = req.body.filename;

    const pdfLoader = new PDFLoader(path.join('./ServerStorage', fileName), {
        parsedItemSeparator: ''
    });
    const docs = await pdfLoader.load();
    const chunkedDocs = await splitText(docs);

    // Assign additional metadata
    for (const doc of chunkedDocs) {
        doc.metadata.date_uploaded = req.body.metadata.date_uploaded
        doc.metadata.tags = req.body.metadata.tags;
        doc.metadata.filename = req.body.filename;
    }

    // Store documents into the database.
    const pg_basepool = createBasePool("database-atlantis");
    const pgvectorDocumentStore = await PGVectorStore.initialize(embeddings, createPGDocumentConfig(pg_basepool, "notes"));

    const documentIDs = createIDs(chunkedDocs.length);

    await pgvectorDocumentStore.addDocuments(chunkedDocs, {
        ids: documentIDs
    })

    pg_basepool.end();

    res.json({
        result: chunkedDocs
    });
})

export default router;