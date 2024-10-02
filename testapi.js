import wavefile from 'wavefile';
import fs from 'fs';

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
