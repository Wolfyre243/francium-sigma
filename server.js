import express from 'express';
import francRouter from './routes/francium.js';
import TTSRouter from './routes/texttospeech.js';
import uploadRouter from './routes/upload.js';

import fs from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;

const app = express();

app.get('/', (req, res) => {
    res.send('Hello World!');
})

// All requests to "test" will be routed here
app.use(express.json());
app.use('/francium', francRouter)
app.use('/texttospeech', TTSRouter)
app.use('/upload', uploadRouter)

app.listen(3030);

console.log('hello');
// console.log(fs.readFileSync(path.join(__dirname, './ServerStorage/text.txt'), { encoding: 'utf8' }));
