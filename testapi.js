import wavefile from 'wavefile';
import fs from 'fs';

import readline from 'readline-sync';
import envconfig from './secrets/env-config.json' with { type: "json" };

while (true) {

    const input = readline.question("You\n>> ");

    const data = await fetch(`http://${envconfig.endpoint}:3030/francium/agent`, {
        method: "POST",
        body: JSON.stringify({
            message: input,
            context: "bababa"
        }),
        headers: {
            "Content-Type": "application/json"
        }
    })
    
    const dataJSON = await data.json();
    
    console.log("\n", dataJSON.result, "\n");
}

// const data = await fetch("http://localhost:3030/texttospeech", {
//     method: "POST",
//     body: JSON.stringify({
//         message: "Hello! I am Alyssa, and this is a test output file.",
//     }),
//     headers: {
//         "Content-Type": "application/json"
//     }
// });

// const dataJSON = await data.json();

// console.log(dataJSON);

// const output = await fetch(`http://localhost:3030/texttospeech`, {
//     method: "POST",
//     body: JSON.stringify({
//         message: "Hello! I am Alyssa, and this is a test output file.",
//     }),
//     headers: {
//         "Content-Type": "application/json"
//     }
// })

// const outputJSON = await output.json();
// console.log(outputJSON);

// const wav = new wavefile.WaveFile();
// wav.fromScratch(1, outputJSON.sampling_rate, '32f', outputJSON.audio);
// fs.writeFileSync('output.wav', wav.toBuffer());
