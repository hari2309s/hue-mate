import sharp from 'sharp';
import { HF_CONFIG } from '../../config';
import { logger } from '../../utils';
import type { SegmentResult } from '../../types/segmentation';

export async function segmentSemantic(imageBuffer: Buffer): Promise<SegmentResult[]> {
  try {
    logger.info('=== SEMANTIC SEGMENTATION START ===');
    logger.info(`Original image buffer size: ${imageBuffer.length} bytes`);
    logger.info(`HF Token present: ${!!HF_CONFIG.TOKEN}`);

    if (!HF_CONFIG.TOKEN) {
      logger.error('CRITICAL: HF_TOKEN is not set!');
      return [];
    }

    logger.info('Calling SegFormer for semantic segmentation...');
    logger.info('Resizing image to 640x640...');

    const resizedBuffer = await sharp(imageBuffer)
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    logger.info(`Resized buffer size: ${resizedBuffer.length} bytes`);
    const requestStart = Date.now();

    const response = await fetch(`${HF_CONFIG.API_URL}/${HF_CONFIG.MODELS.SEGFORMER}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_CONFIG.TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(resizedBuffer),
    });

    const requestDuration = Date.now() - requestStart;
    logger.info(`Request completed in ${requestDuration}ms`);
    logger.info(`Response status: ${response.status}`);
    logger.info(`Response status text: ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Response NOT OK');
      logger.error(`Response body: ${errorText}`);

      if (response.status === 503) {
        logger.warn('Model loading (503 status), waiting 20 seconds...');
        await new Promise((r) => setTimeout(r, HF_CONFIG.RETRY_DELAY_MS));
        logger.info('Retrying after model load wait...');
        return segmentSemantic(imageBuffer);
      }

      if (response.status === 401 || response.status === 403) {
        logger.error('AUTHENTICATION ERROR - Check your HuggingFace API token');
      }

      logger.error(`SegFormer failed with status ${response.status}`);
      logger.info('=== SEMANTIC SEGMENTATION END ===');
      return [];
    }

    logger.info('Response OK, parsing JSON...');
    const responseText = await response.text();
    logger.info(`Raw response text (first 300 chars): ${responseText.substring(0, 300)}`);

    let results: SegmentResult[];
    try {
      results = JSON.parse(responseText) as SegmentResult[];
      logger.success('Successfully parsed JSON response');
      logger.info(`Response type: ${typeof results}`);
      logger.info(`Is array: ${Array.isArray(results)}`);
    } catch (parseError) {
      logger.error('JSON PARSE ERROR');
      logger.error(`Error: ${parseError}`);
      logger.error(`Full response text: ${responseText}`);
      logger.info('=== SEMANTIC SEGMENTATION END ===');
      return [];
    }

    logger.success(`Found ${results.length} semantic regions`);
    if (results.length > 0) {
      logger.info('Region details:');
      results.forEach((r, idx) => {
        logger.info(`  [${idx}] label: "${r.label}", score: ${r.score?.toFixed(3) || 'N/A'}`);
      });
    }
    logger.info('=== SEMANTIC SEGMENTATION END ===');

    return results;
  } catch (error) {
    logger.error('=== SEMANTIC SEGMENTATION - CAUGHT ERROR ===');
    logger.error(`Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    logger.error(`Error message: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      logger.error('NETWORK ERROR - Check internet connection and API URL');
    }

    logger.error(`SegFormer segmentation failed: ${error}`);
    logger.info('=== SEMANTIC SEGMENTATION END ===');
    return [];
  }
}
