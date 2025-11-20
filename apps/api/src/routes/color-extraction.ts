import { Router, Request, Response } from "express";
import multer from "multer";
import { extractColorsHF } from "../lib/hf-color-extraction";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  name?: string;
}

interface ColorExtractionResponse {
  colors: ExtractedColor[];
  paletteName?: string;
  timestamp: string;
}

/**
 * POST /api/colors/extract
 * Extract colors from uploaded image using Hugging Face ML
 */
router.post(
  "/extract",
  upload.single("image"),
  async (req: Request, res: Response<ColorExtractionResponse>) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          colors: [],
          timestamp: new Date().toISOString(),
        } as any);
      }

      // Convert buffer to base64
      const base64Image = req.file.buffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      // Extract colors using Hugging Face
      const colors = await extractColorsHF(dataUrl);

      res.json({
        colors,
        paletteName: `Palette from ${req.file.originalname}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Color extraction error:", error);
      res.status(500).json({
        colors: [],
        timestamp: new Date().toISOString(),
      } as any);
    }
  },
);

export { router as colorExtractionRouter };
