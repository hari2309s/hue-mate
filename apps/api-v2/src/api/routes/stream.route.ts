import { Router } from 'express';
import { imageStorage } from '../../services';
import { extractColorsFromImage } from '../../core/extraction/pipeline';

const router = Router();

router.get('/:imageId', async (req, res) => {
  const image = imageStorage.get(req.params.imageId);
  if (!image) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const parsedNumColors =
    typeof req.query.numColors === 'string' ? Number(req.query.numColors) : undefined;
  const includeBackground =
    typeof req.query.includeBackground === 'string'
      ? req.query.includeBackground !== 'false'
      : true;
  const generateHarmonies =
    typeof req.query.generateHarmonies === 'string'
      ? req.query.generateHarmonies !== 'false'
      : true;

  try {
    const result = await extractColorsFromImage(
      image.buffer,
      image.filename,
      {
        numColors: Number.isFinite(parsedNumColors) ? parsedNumColors : undefined,
        includeBackground,
        generateHarmonies,
      },
      {
        onPartial: (colors) => {
          res.write(`${JSON.stringify({ status: 'partial', colors })}\n`);
        },
      }
    );

    res.write(`${JSON.stringify({ status: 'complete', result })}\n`);
    res.end();
  } catch (error) {
    res.write(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Processing failed',
      }) + '\n'
    );
    res.end();
  }
});

export default router;
