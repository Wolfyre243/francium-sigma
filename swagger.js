// This is a configuration file for the swagger UI interface.

import swaggerJSDoc from 'swagger-jsdoc';

// Import version
import packageJSON from "./package.json" with { type: "json" };
const version = packageJSON.version;

const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Francium API',
            version: version,
            description: 'API Documentation for Project Francium',
        },
    },
    apis: ['./routes/*.js'], // Path to API routes
});

export default swaggerSpec;