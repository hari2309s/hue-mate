# hue-und-you

ML-driven perceptual color extraction → 11-step OKLCH scales, Tailwind config, Figma variables, and CSS/SCSS custom properties. Built for designers who ship.

## Features
- Foreground/background + semantic segmentation with Hugging Face models and robust luminance fallback
- Weighted K-means clustering in OKLab with saturation bias for vibrant yet distinct colors
- Deduplication and hue diversity enforcement to avoid near-duplicate swatches
- Heuristic color naming with palette-aware uniqueness and Pantone approximation
- Accessibility info (WCAG contrast on white/black and APCA-like metric) with suggested text color
- Tints and shades generation and classic harmonies (complementary, analogous, triadic, split)
- One-click export: CSS variables (11 steps), SCSS variables, Tailwind `extend.colors`, Figma variables

## Monorepo Structure
- `apps/api` — Express + tRPC service that runs the extraction pipeline
- `apps/web` — Next.js 16 app (App Router) that uploads an image and visualizes results
- `packages/api-schema` — Shared tRPC router helpers and Zod schemas
- `packages/types` — Shared TypeScript types for colors, exports, metadata, statuses
- `packages/ui` — Reusable UI primitives
- `packages/db` — Drizzle ORM schema for images/palettes/jobs (not yet wired to API)
- `packages/config` — Shared config (e.g., Tailwind)

## Requirements
- Node.js 18+ (recommended 20+)
- `pnpm` (corepack enabled) and typical native deps for `sharp`

## Setup
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy environment template and set values:
   ```bash
   cp .env.example .env
   ```
   - `HUGGINGFACE_API_KEY` is required for segmentation; the pipeline falls back to luminance if unavailable
   - `NEXT_PUBLIC_API_URL` should point to the API (default `http://localhost:3001`)

## Development
- Start everything via Turbo:
  ```bash
  pnpm dev
  ```
- Or run targets individually:
  ```bash
  pnpm --filter @hue-und-you/api dev    # API on :3001
  pnpm --filter @hue-und-you/web dev    # Web on :3000
  ```

Common tasks:
```bash
pnpm build        # build all
pnpm lint         # ESLint across packages/apps
pnpm type-check   # tsc in each workspace
pnpm format       # Prettier write
```

## Environment
See `.env.example` for variables. The API logs an environment check on startup (`apps/api/src/index.ts:132-137`). Default API port is `3001`.

## API Overview
The API exposes both tRPC procedures and a streaming endpoint.

- Health check: `GET /health`
- tRPC (HTTP JSON):
  - `uploadImage` → returns `imageId` for subsequent processing (`packages/api-schema/src/index.ts:4-8`)
  - `processImage` → kicks off async extraction (`packages/api-schema/src/index.ts:10-19`)
  - `getProcessingStatus` → status/progress (`packages/api-schema/src/index.ts:21-23`)
  - `getResult` → final `ColorPaletteResult`
- Streaming: `GET /stream/:imageId` with optional `numColors`, `includeBackground`, `generateHarmonies` query params (`apps/api/src/index.ts:145-194`)

Data flow (`apps/api/src/index.ts:28-124`):
- Upload → image stored in-memory; job status initialized
- Process → status updates: segmenting → extracting → complete
- Result polling via web: `getProcessingStatus` then `getResult`

## Extraction Pipeline
Entry point: `apps/api/src/services/colorExtraction.ts:479-738`

- Segmentation (`apps/api/src/services/segmentation.ts:167-276`, `283-386`)
  - Foreground/background: Mask2Former (COCO panoptic) with label classification
  - Semantic segmentation: SegFormer (ADE) with detailed debug logs
  - Fallback luminance split when masks are missing or low-confidence
- Pixel sampling (`apps/api/src/services/segmentation.ts:392-441`) via `sharp`
- Clustering (`apps/api/src/services/clustering.ts:87-189`)
  - Weighted K-means in OKLab; aggressive saturation bias (`apps/api/src/services/clustering.ts:45-81`)
- Post-processing
  - Deduplicate and enforce hue diversity (`apps/api/src/services/colorExtraction.ts:247-477`)
- Naming and metadata
  - Heuristic naming with palette tracking and optional descriptors (`apps/api/src/services/colorNaming.ts:484-510`)
  - Pantone approximation (`apps/api/src/services/colorNaming.ts:52-70`)
  - Accessibility (WCAG + APCA-like) (`apps/api/src/services/accessibility.ts:56-81`)
  - Tints/shades and harmonies (`apps/api/src/services/colorHarmony.ts:21-140`, `147-175`)
- Export generation (`apps/api/src/services/exportFormats.ts:244-257`)
  - CSS variables (11-step scale), SCSS, Tailwind

Types are centralized in `packages/types/src/index.ts` (e.g., `ColorPaletteResult`, `ExportFormats`).

## Frontend
Next.js app in `apps/web` renders the full workflow:
- `useImageUpload` orchestrates upload/process/poll (`apps/web/src/hooks/useImageUpload.tsx:36-203`)
- `FileUploader` handles drag-drop, preview, progress (`apps/web/src/components/FileUploader.tsx:24-316`)
- `ImagePreview` displays the uploaded image (`apps/web/src/components/ImagePreview.tsx:11-57`)
- `ColorPaletteDisplay` shows swatches, formats, tints/shades, exports (`apps/web/src/components/ColorPaletteDisplay.tsx:176-327`)
- `ExtractionMetadata` summarizes timing, confidence, diversity (`apps/web/src/components/ExtractionMetadata.tsx:57-199`)

## Database (optional)
Drizzle schemas live in `packages/db/src/schema.ts:1-71` for images, palettes, processing jobs, and users. The current API uses in-memory stores and will be adapted to persist these records.

## Deployment
Render configuration for the API is at `apps/api/render.yaml`. It builds only the API service, sets `PORT=10000`, and expects `HUGGINGFACE_API_KEY`.

## Troubleshooting
- Segmentation returns empty: ensure `HUGGINGFACE_API_KEY` is set; otherwise the luminance fallback is used
- `sharp` errors: verify local libvips installation and image formats
- Low diversity or near-duplicates: adjust `numColors` or disable background inclusion when appropriate

## License
ISC
