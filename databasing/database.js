import pg from "pg";
import db_config from "../secrets/db-config.json" with { type: "json" };

// Create a new database connection
export const createBasePool = (database) => {
    return new pg.Pool({
        host: "127.0.0.1", // use 127.0.0.1 if in dev environment, 172.23.0.1 before running docker build
        port: 5432,
        user: "francium-admin",
        password: db_config.db_password,
        database: database,
    });
}

// For communicating with the Documents table.
export const createPGDocumentConfig = (pool) => {
    return {
        pool: pool,
        tableName: "simpleDocuments", // This is a table that stores documents, all configured below in the "columns" object.
        collectionName: "documents_collection",
        collectionTableName: "collections", // This is a table that stores the collection objects
        columns: {
            idColumnName: "id",
            vectorColumnName: "vector",
            contentColumnName: "content",
            metadataColumnName: "metadata",
        },
        // distanceStrategy: 'cosine'
    }
}

export const createPGConvoConfig = (pool) => {
    return {
        pool: pool,
        tableName: "convohistory", // This is a table that stores documents, all configured below in the "columns" object.
        collectionName: "convohistory_collection",
        collectionTableName: "collections", // This is a table that stores the collection objects
        columns: {
            idColumnName: "id",
            vectorColumnName: "vector",
            contentColumnName: "content",
            metadataColumnName: "metadata",
        },
        // distanceStrategy: 'cosine'
    }
}

export const createPGTodoConfig = (pool) => {
    return {
        pool: pool,
        tableName: "todos",
        collectionName: "todos_collection",
        collectionTableName: "collections",
        columns: {
            idColumnName: "id",
            vectorColumnName: "vector",
            contentColumnName: "content",
            metadataColumnName: "metadata",
        }
    }
}