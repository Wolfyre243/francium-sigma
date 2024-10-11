/**
 * @swagger
 * /api/francium:
 *   post:
 *     summary: Generates an AI response based on the given user message.
 *     description: Invokes the Ollama chain and returns the response. Will call any tools the AI deems relevant.
 *     responses:
 *       200:
 *         description: Successful response with LLM response.
 */


import francRouter from './francium.js';
import TTSRouter from './texttospeech.js';
import uploadRouter from './upload.js';

import express from 'express';
const router = express.Router();

router.use('/francium', francRouter)
router.use('/texttospeech', TTSRouter)
router.use('/upload', uploadRouter)

export default router; // This will make the router available in the main file.