//--------------------------------------------------------MARK: Import necessary tools----------------------------------------------------------------
// Import the pipeline transformer from HuggingFace
import { pipeline } from "@xenova/transformers";

// Import WAV tools
import wavefile from 'wavefile';
import fs from 'fs';

// Import and define a simple Express.js router
import express from 'express';
const router = express.Router();

// Create a pipeline
const synthesizer = await pipeline('text-to-speech', 'Xenova/speecht5_tts', { quantized: false });
const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';

// Define a GET route for '/' that returns 'Hello World!' as a response
router.post('/', async (req, res) => {
    const messageToSpeak = req.body.message.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').replace(/\s+/g, ' ').trim();

    console.log(`Synthesizing: ${messageToSpeak}`);

    const output = await synthesizer(messageToSpeak, { speaker_embeddings });

    // TODO: Organise the wav file by storing it somewhere else
    // Create the .wav file
    const wav = new wavefile.WaveFile();
    wav.fromScratch(1, output.sampling_rate, '32f', output.audio);
    fs.writeFileSync('output.wav', wav.toBuffer());

    const thewavefile = fs.readFileSync('output.wav').toString('base64')
    res.json({
        base64String: thewavefile,
    });
});

// Export the router to use in other parts of your application
export default router;
