// This is a tool to interact with Notion, in order to fetch my upcoming events, etc.
// Import langchain dependencies
import { tool } from '@langchain/core/tools';

// Misc
import { v4 as uuidv4 } from 'uuid';
import { z } from "zod";

// Notion dependencies
import { Client } from '@notionhq/client';

// Get API Key
import envconfig from "../secrets/env-config.json" with { type: "json" };
const notionAPIKey = envconfig.notionAPIKey;
const notionHomepageId = envconfig.notionHomepageID;
const notionTodoDatabaseId = envconfig.notionTodoDatabaseID;

// Define the Client
const notionClient = new Client({ auth: notionAPIKey });
const notionHomepage = await notionClient.pages.retrieve({ page_id: notionHomepageId });

// Define premade filters here
const thisWeekFilter = {
    and: [
        {
            property: "Status",
            status: {
                equals: "Not started"
            },
        }, {
            property: "Plan to do at",
            date: {
                this_week: {}
            },
        }
    ]
}

const nextWeekFilter = {
    and: [
        {
            property: "Status",
            status: {
                equals: "Not started"
            },
        }, {
            property: "Plan to do at",
            date: {
                next_week: {}
            },
        }
    ]
}

// Define querying functions for the databases
// Query the Todo Database
async function queryTodoDatabase(databaseId, filter) {
    console.log(`Querying Notion database ${databaseId}`);

    const resultPages = await notionClient.databases.query({
        database_id: databaseId,
        filter: filter
    })

    return resultPages;
}

async function parsePageContent(page) {
    let pageContent = '';

    // Obtain page metadata first
    const pageTitle = page.properties.Name.title[0].plain_text;
    const pageTags = page.properties.Tags.multi_select.reduce(
        (acc, curr) => acc + curr.name + ' ',
        ''
    );

    pageContent += `${pageTitle}\nTags: ${pageTags}\nContent:\n`;

    // Fetch page blocks
    const pageBlocks = await notionClient.blocks.children.list({
        block_id: page.id,
    });
    for await (const block of pageBlocks.results) {
        const blockType = block.type;
        const blockContent = block[blockType].rich_text.reduce(
            (acc, curr) => acc + ' ' + curr.text.content,
            ''
        );
        pageContent += blockContent + '\n';
    }

    return pageContent;
}

const fetchEventsSchema = z.object({
    timescope: z
        .enum(["this_week", "next_week"]) // TODO: Add today and tomorrow next time
        .describe("The time frame to fetch events from. Fetch events from either this week or next week.")
})

export const fetchUpcomingEventsTool = tool(
    async ({ timescope }) => {
        // Fetch pages from the database
        let resultPages;
        if (timescope === "this_week") {
            resultPages = await queryTodoDatabase(notionTodoDatabaseId, thisWeekFilter);
        } else if (timescope === "next_week") {
            resultPages = await queryTodoDatabase(notionTodoDatabaseId, nextWeekFilter);
        }
        // Parse the content of each page
        let totalContent = '';
        let count = 1;
        for (const page of resultPages.results) {
            const content = await parsePageContent(page);
            totalContent += count++ + content;
        }
        return `Upcoming events ${ timescope === "this_week" ? 'this week' : 'next week' }:\n\n${totalContent}`
    }, {
        name: "Fetch Events Tool",
        description: "A tool to fetch upcoming events occurring either this week or next week",
        schema: fetchEventsSchema,
    }
);