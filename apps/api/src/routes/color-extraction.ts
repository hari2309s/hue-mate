import { Router, Request, Response } from "express";
import multer from "multer";
import { extractColorsWithML } from "../lib/ml-color-extraction";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  lab: [number, number, number];
  name?: string;
  confidence?: number;
}

interface ColorExtractionResponse {
  colors: ExtractedColor[];
  paletteName?: string;
  quality: string;
  timestamp: string;
  processingTimeMs: number;
}

/**
 * POST /api/colors/extract
 * Extract colors from uploaded image using advanced ML
 */
router.post(
  "/extract",
  upload.single("image"),
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json({
          colors: [],
          quality: "error",
          timestamp: new Date().toISOString(),
          processingTimeMs: 0,
        });
      }

      const quality = (req.query.quality as string) || "balanced";
      const k = parseInt(req.query.k as string) || 5;

      // Extract colors using ML pipeline
      const colors = await extractColorsWithML(req.file.buffer, {
        k,
        quality: quality as "fast" | "balanced" | "accurate",
        colorSpace: "lab",
        minDistance: 30,
      });

      const processingTimeMs = Date.now() - startTime;

      res.json({
        colors,
        paletteName: `Palette from ${req.file.originalname}`,
        quality,
        timestamp: new Date().toISOString(),
        processingTimeMs,
      } as ColorExtractionResponse);
    } catch (error) {
      console.error("Color extraction error:", error);
      res.status(500).json({
        colors: [],
        quality: "error",
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
      });
    }
  },
);

export { router as colorExtractionRouter };
