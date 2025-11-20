import { Router, Request, Response } from "express";
import { db, palettes, users } from "@hue-und-you/db";
import { eq } from "drizzle-orm";

const router = Router();

interface CreatePaletteBody {
  userId: number;
  name: string;
  colors: Array<{
    hex: string;
    rgb: [number, number, number];
    hsl: [number, number, number];
    name?: string;
  }>;
  imageUrl?: string;
}

/**
 * POST /api/palettes
 * Create new palette
 */
router.post(
  "/",
  async (req: Request<{}, {}, CreatePaletteBody>, res: Response) => {
    try {
      const { userId, name, colors, imageUrl } = req.body;

      const result = await db
        .insert(palettes)
        .values({
          userId,
          name,
          colors: colors as any,
          imageUrl,
        })
        .returning();

      res.json(result[0]);
    } catch (error) {
      console.error("Create palette error:", error);
      res.status(500).json({ error: "Failed to create palette" });
    }
  },
);

/**
 * GET /api/palettes/:id
 * Get palette by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const palette = await db.query.palettes.findFirst({
      where: eq(palettes.id, parseInt(id)),
    });

    if (!palette) {
      return res.status(404).json({ error: "Palette not found" });
    }

    res.json(palette);
  } catch (error) {
    console.error("Get palette error:", error);
    res.status(500).json({ error: "Failed to fetch palette" });
  }
});

/**
 * GET /api/palettes/user/:userId
 * Get all palettes for user
 */
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userPalettes = await db.query.palettes.findMany({
      where: eq(palettes.userId, parseInt(userId)),
    });

    res.json(userPalettes);
  } catch (error) {
    console.error("Get user palettes error:", error);
    res.status(500).json({ error: "Failed to fetch palettes" });
  }
});

export { router as paletteRouter };
