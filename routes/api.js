import francRouter from './francium.js';
import TTSRouter from './texttospeech.js';
import uploadRouter from './upload.js';

import express from 'express';
const router = express.Router();

router.use('/francium', francRouter)
router.use('/texttospeech', TTSRouter)
router.use('/upload', uploadRouter)

export default router; // This will make the router available in the main file.