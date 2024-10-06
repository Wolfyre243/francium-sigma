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
    description: "A tool that allows you to access the internet and fetch results from all over the web.",
    name: "searchTool",
    schema: langSearchTool.schema,
})