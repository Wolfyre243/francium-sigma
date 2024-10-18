import { createRequestHandler } from "@remix-run/express";
import express from 'express';

// Import routes
import francRouter from './routes/francium.js';
import TTSRouter from './routes/texttospeech.js';
import uploadRouter from './routes/upload.js';
import APIRouter from './routes/api.js';

// Import Swagger Docs
import swaggerUI from 'swagger-ui-express';
import swaggerSpec from "./swagger.js";

const __dirname = import.meta.dirname;

// Configure for dev
const viteDevServer =
    process.env.NODE_ENV === "production" ? 
    null : await import("vite").then((vite) =>
    vite.createServer({
        server: { middlewareMode: true },
    })
);

const app = express();

// app.get('/', (req, res) => {
//     res.send('Hello World!');
// })

// All requests to "test" will be routed here
app.use(express.json());
app.use(
    viteDevServer
      ? viteDevServer.middlewares
      : express.static("build/client")
);
const build = viteDevServer ? 
    () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : await import("./build/server/index.js");

// app.use('/francium', francRouter)
// app.use('/texttospeech', TTSRouter)
// app.use('/upload', uploadRouter)
app.use('/api', APIRouter)
app.use('/docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));
app.all("*", createRequestHandler({ build }));

app.listen(3030, () => {
    console.log('App listening on http://localhost:3030');
});
// console.log(fs.readFileSync(path.join(__dirname, './ServerStorage/text.txt'), { encoding: 'utf8' }));
