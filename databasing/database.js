import pg from "pg";
import db_config from "../secrets/db-config.json" with { type: "json" };

// Create a new database connection
export const pg_basepool = new pg.Pool({
    host: "127.0.0.1", // use 127.0.0.1 if in dev environment, 172.23.0.1 before running docker build
    port: 5432,
    user: "francium-admin",
    password: db_config.db_password,
    database: "database-atlantis",
})

// For communicating with the Documents table.
export const pgDocumentsConfig = {
    pool: pg_basepool,
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
};

// For communicating with the Conversation History table.
export const pgConversationConfig = {
    pool: pg_basepool,
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
};