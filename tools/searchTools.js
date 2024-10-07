// import { tool } from '@langchain/core/tools';
import { SearxngSearch } from '@langchain/community/tools/searxng_search';
// import { z } from "zod";

import envconfig from '../secrets/env-config.json' with { type: "json" };

// TODO: Implement better webpage parsing and summarisation

const langSearchTool = new SearxngSearch({
    apiBase: `http://${envconfig.endpoint}:4040`,
    params: {
        format: "json",
        engines: "google",
    },
    headers: {},
})

export const searchTool = langSearchTool.asTool({
    description: "Use to surf the web, fetch current information, check the weather, and retrieve other information.",
    name: "searchTool",
    schema: langSearchTool.schema,
})