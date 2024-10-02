import wavefile from 'wavefile';
import fs from 'fs';

import { SearxngService } from 'searxng';

import readline from 'readline-sync';
import envconfig from './secrets/env-config.json' with { type: "json" };

while (true) {

    const input = readline.question("You\n>> ");

    const data = await fetch(`http://${envconfig.endpoint}:3030/francium`, {
        method: "POST",
        body: JSON.stringify({
            message: input,
            context: "bababa"
        }),
        headers: {
            "Content-Type": "application/json"
        }
    });
    
    const dataJSON = await data.json();
    
    console.log("\n", dataJSON.result, "\n");
}

// const searchConfig = {
//     baseURL: 'http://localhost:4040',
//     defaultSearchParams: {
//         format: 'json',
//         lang: 'auto',
//     },
//     defaultRequestHeaders: {
//         'Content-Type': 'application/json'
//     },
// };
// const searxngEngine = new SearxngService(searchConfig);

// async function searchEngine(query) {
//     try {
//         const data = await searxngEngine.search(query);
//         console.log(data);
//     } catch (error) {
//         console.log("There was an error querying the engine!\n", error);
//     }
// }

// searchEngine('why is the sky blue?')
