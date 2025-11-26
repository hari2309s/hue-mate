# hue-und-you

<div align="left">

[![pnpm](https://img.shields.io/badge/pnpm-Workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TurboRepo](https://img.shields.io/badge/TurboRepo-Monorepo-000000?logo=turborepo&logoColor=white)](https://turbo.build/repo)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-API-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![tRPC](https://img.shields.io/badge/tRPC-API-398CCB?logo=trpc&logoColor=white)](https://trpc.io/)
[![Zod](https://img.shields.io/badge/Zod-Schema-3E67B1?logo=zod&logoColor=white)](https://zod.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Framer Motion](https://img.shields.io/badge/Framer%20Motion-Animations-0055FF?logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Vercel](https://img.shields.io/badge/Vercel-Hosting-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Sharp](https://img.shields.io/badge/Sharp-Image-00C853?logo=sharp&logoColor=white)](https://sharp.pixelplumbing.com/)
[![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Models-FFCA00?logo=huggingface&logoColor=black)](https://huggingface.co/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-2FB344?logo=drizzle&logoColor=white)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Render](https://img.shields.io/badge/Render-Deploy-46E3B7?logo=render&logoColor=white)](https://render.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-lightgrey.svg)](https://opensource.org/licenses/ISC)

</div>

ML-driven perceptual color extraction from images. Extract 11-step OKLCH scales, Tailwind configs, Figma variables, CSS/SCSS custom properties, and more—built for designers who ship.

## ✨ Features

- **Intelligent Segmentation**: Foreground/background separation using Hugging Face's Mask2Former (COCO panoptic) with semantic SegFormer (ADE) fallback and luminance-based emergency fallback
- **Perceptual Color Clustering**: Weighted K-means in OKLab color space with aggressive saturation bias to favor vibrant, distinct colors
- **Quality Assurance**: Automatic deduplication, hue diversity enforcement, and confidence scoring to prevent near-duplicate swatches
- **Smart Color Naming**: Heuristic palette-aware naming with tone bucketing (dark/medium/light), Pantone approximation, and CSS variable generation
- **Accessibility First**: WCAG AA/AAA contrast ratios on white/black, APCA-like metrics, and suggested text colors for every extracted color
- **Rich Exports**: 11-step tints/shades, classic harmonies (complementary, analogous, triadic, split), temperature classification, and one-click export to CSS variables, SCSS, Tailwind, Figma tokens, Swift, Kotlin, and JSON
- **Animated UI**: Smooth transitions and real-time progress feedback with Framer Motion
- **Streaming Support**: Real-time partial color results via `/stream` endpoint during processing
- **Type-Safe Pipeline**: End-to-end TypeScript with Zod validation and shared types across monorepo

## 📦 Monorepo Structure
```
hue-und-you/
├── apps/
│   ├── api/              # Express + tRPC color extraction service
│   └── web/              # Next.js 16 frontend with real-time UI
├── packages/
│   ├── api-schema/       # Shared tRPC router & Zod schemas
│   ├── types/            # Centralized TypeScript types
│   ├── ui/               # Reusable React UI primitives
│   ├── db/               # Drizzle ORM schemas (PostgreSQL)
│   └── config/           # Shared configs (Tailwind, TypeScript, ESLint)
└── scripts/              # Build & cleanup utilities
```

## 🎯 Key Technologies

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Framer Motion, Tailwind CSS v4 |
| **Backend** | Express 5, tRPC 11, Node.js 18+ |
| **Color Processing** | OKLab/OKLCH conversion, K-means clustering, saturation bias |
| **ML Models** | Hugging Face (Mask2Former, SegFormer) with fallbacks |
| **Image I/O** | Sharp for efficient pixel sampling & mask processing |
| **Database** | PostgreSQL + Drizzle ORM (schemas prepared, API uses in-memory for now) |
| **Build & Deploy** | Turbo, tsc, pnpm, Render, Vercel |

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (recommended 20+)
- **pnpm** (via corepack: `corepack enable`)
- Typical build tools for `sharp` native deps (Python, C++ compiler)

### Installation

1. **Clone & install**:
```bash
   git clone <repo-url>
   cd hue-und-you
   pnpm install
```

2. **Set up environment**:
```bash
   cp .env.example .env
```
   Fill in:
   - `HUGGINGFACE_API_KEY` — Required for ML segmentation; fallback to luminance if missing
   - `NEXT_PUBLIC_API_URL` — Frontend API endpoint (default: `http://localhost:3001`)
   - `DATABASE_URL` — PostgreSQL connection (optional, not yet wired to API)

3. **Start development**:
```bash
   pnpm dev
```
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API: [http://localhost:3001](http://localhost:3001)

## 📝 Common Tasks
```bash
# Build all packages and apps
pnpm build

# Type-check across workspace
pnpm type-check

# Lint with ESLint
pnpm lint

# Format code with Prettier
pnpm format

# Clean build artifacts
pnpm clean

# Run API only
pnpm --filter @hue-und-you/api dev

# Run web only
pnpm --filter @hue-und-you/web dev
```

## 🔌 API Overview

### Health Check
```
GET /health
```
Simple status endpoint.

### tRPC Procedures (JSON-RPC)
All endpoints: `POST /trpc/<procedure-name>`

| Procedure | Input | Output | Notes |
|-----------|-------|--------|-------|
| `uploadImage` | `{ filename, contentType, base64Data }` | `{ success, imageId, message }` | Stores image in-memory |
| `processImage` | `{ imageId, options? }` | `{ success, status, message }` | Kicks off async extraction |
| `getProcessingStatus` | `{ imageId }` | `{ status, progress, message }` | Poll for job status |
| `getResult` | `{ imageId }` | `ColorPaletteResult \| null` | Final palette when complete |

**Status Values**: `idle` → `uploading` → `processing` → `segmenting` → `extracting` → `complete` (or `error`)

### Streaming Endpoint
```
GET /stream/:imageId?numColors=10&includeBackground=true&generateHarmonies=true
```
Returns newline-delimited JSON with partial results and final palette. Useful for progressive UI updates.

## 🎨 Color Extraction Pipeline

### Entry Point
`apps/api/src/services/colorExtraction.ts` (stage-based architecture)

### Stage 1: Segmentation
- **Foreground/Background**: Mask2Former (COCO panoptic) → label classification
- **Semantic Segmentation**: SegFormer (ADE) for scene understanding
- **Fallback**: Luminance-based split if ML models unavailable
- **Output**: Binary mask + confidence score

### Stage 2: Pixel Extraction
- Sample up to `MAX_SAMPLES` (5000) pixels from image via Sharp
- Filter out very dark/bright noise
- Apply mask to label foreground vs. background

### Stage 3: Clustering
- **Bias**: Apply saturation boost (1–20x) to favor vibrant colors
- **K-means++**: Run in OKLab with adaptive k (based on FG/BG ratio)
- **Deduplication**: Remove near-duplicates (perceptual distance < 0.35)
- **Hue Diversity**: Enforce min 35° hue separation (adaptive for neutrals)
- **Cleanup**: Final merge pass to hit target color count

### Stage 4: Color Formatting & Naming
- Generate all formats: HEX, RGB, OKLCH, HSL, HSB, CMYK, LAB, LCH
- Intelligent naming with palette-aware tone bucketing
- Pantone approximation via euclidean RGB distance
- Accessibility scores (WCAG AA/AAA, APCA-like)

### Stage 5: Harmonies & Exports
- Generate 11-step tints/shades (OKLab lightness manipulation)
- Classic color harmonies (complementary, analogous, triadic, split)
- Export to CSS variables, SCSS, Tailwind config, Figma tokens, Swift, Kotlin, JSON

## 🎯 Frontend Workflow

### Components
- **FileUploader** (`apps/web/src/components/FileUploader.tsx`): Drag-drop, validation, progress bar
- **ImagePreview** (`apps/web/src/components/ImagePreview.tsx`): Live image display
- **ColorPaletteDisplay** (`apps/web/src/components/ColorPaletteDisplay.tsx`): Swatches, copy buttons, export panels
- **ExtractionMetadata** (`apps/web/src/components/ExtractionMetadata.tsx`): Processing stats, confidence, warnings

### Hook
- **useImageUpload** (`apps/web/src/hooks/useImageUpload.tsx`): Orchestrates upload → process → poll → result lifecycle with auto-toast notifications

### Flow
1. User drags/selects image
2. Hook converts to base64 and POST `/trpc/uploadImage`
3. Receives `imageId` and immediately calls `/trpc/processImage`
4. Polls `/trpc/getProcessingStatus` every 1s
5. On completion, fetches `/trpc/getResult`
6. Results render in palette grid with export options

## 🗄️ Database (Optional)

Drizzle schemas are defined in `packages/db/src/schema.ts`:
- **images**: Uploaded image metadata & status
- **palettes**: Extracted color palette records
- **processingJobs**: Job tracking & progress
- **users**: User accounts (future)

The current API uses in-memory stores (`ImageStorageService`, `JobQueueService`). To wire PostgreSQL, pass Drizzle client to tRPC routes.

## 🔒 Environment Variables
```env
# Required
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxx

# API
PORT=3001
NODE_ENV=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001

# Database (optional)
DATABASE_URL=postgresql://user:password@localhost:5432/hue_und_you
```

## 📊 Metadata & Confidence

Every result includes `ExtractionMetadata`:
- **processingTimeMs**: Total time end-to-end
- **algorithm**: `weighted-kmeans`
- **colorDiversity**: Entropy-based (0–1)
- **averageSaturation**: % across palette
- **dominantTemperature**: `warm` | `cool` | `neutral`
- **segmentationQuality**: `{ method, confidence, foregroundDetected, usedFallback }`
- **extractionConfidence**: `{ overall, colorSeparation, namingQuality }` (0–1 each)

## 🚢 Deployment

### API (Render)
Configuration: `apps/api/render.yaml`
- Build: `pnpm install && pnpm build --filter=@hue-und-you/api`
- Start: `cd apps/api && node dist/index.js`
- Port: `10000`
- Health check: `/health`

### Frontend (Vercel)
- Framework: Next.js 16
- Build: Automatic
- Environment: Set `NEXT_PUBLIC_API_URL` to production API

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty segmentation results | Ensure `HUGGINGFACE_API_KEY` is set; fallback to luminance |
| `sharp` build errors | Install system deps: `libvips`, `python3`, C++ compiler |
| Low color diversity | Reduce `numColors` or adjust saturation bias thresholds |
| Slow uploads | Compress images before sending; max 10 MB by default |
| ML model timeouts | HF inference may queue; set longer client timeout |

## 📚 Architecture Highlights

### Color Spaces
- **OKLab**: Perceptually uniform distance metric for clustering
- **OKLCH**: Cylindrical version (lightness, chroma, hue) for intuitive manipulation
- **HSL**: For palette naming tone bucketing

### Clustering Strategy
- K-means++ initialization for better convergence
- Saturation bias (1–20x boost) to favor vibrant swatches
- Post-processing deduplication & hue diversity enforcement

### Naming
- 10 hue families (Crimson, Copper, Solar, Lime, etc.)
- 3 tone levels (dark, medium, light) per family
- Palette-aware tracking to avoid duplicates
- Optional intensity descriptors (Vivid, Muted, Deep, etc.)

### Export Quality
- 11-step Tailwind scales (50–950)
- WCAG contrast ratios for accessibility
- Figma token format for design systems
- Multi-language support (Swift, Kotlin)

## 📄 License

ISC

---

**Built for designers who ship.** hue-und-you combines cutting-edge ML segmentation, perceptual color science, and export flexibility—from concept to production in seconds.
