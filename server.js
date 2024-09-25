import express from 'express';
import francRouter from './routes/francium.js'

const app = express();

app.get('/', (req, res) => {
    res.send('Hello World!');
})

// All requests to "test" will be routed here
app.use(express.json());
app.use('/francium', francRouter)

app.listen(3030);

console.log('hello');
