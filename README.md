# 🎨 Hue & You

ML-driven perceptual color extraction → 11-step OKLCH scales, Tailwind config, Figma variables, and CSS custom properties. Built for designers who ship.

## ✨ Features

- 📸 **Upload & Extract** - Drop any image and get perfect color palettes
- 🎨 **Smart Color Analysis** - ML-powered extraction using Hugging Face
- 📦 **Export Anywhere** - Tailwind configs, Figma variables, CSS custom properties
- 🎯 **Shade Generator** - Automatic 50-950 shade scales
- 💾 **Save Collections** - Store and organize your palettes
- 🔗 **Shareable Links** - Share palettes with your team
- 🆓 **10 Free/Day** - $9/mo for unlimited

## 🚀 Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 14, React 18, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, tRPC
- **Database**: PostgreSQL + Drizzle ORM
- **ML**: Hugging Face inference API
- **Deployment**: Vercel-ready

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm 9.0.0+

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd hue-und-you

# Update environment variables
# Edit .env.local with your database credentials and Hugging Face API key

# Push database schema
pnpm db:push

# Start development
pnpm dev
```

### Environment Variables

Create `.env.local` in the root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/hue_und_you
NEXT_PUBLIC_API_URL=http://localhost:3001
PORT=3001
HUGGINGFACE_API_KEY=hf_your_key_here
NODE_ENV=development
```

Get your Hugging Face API key from: https://huggingface.co/settings/tokens

## 📦 Available Commands

```bash
pnpm dev         # Start all apps in development mode
pnpm build       # Build all packages for production
pnpm lint        # Lint all packages
pnpm typecheck   # Type check all packages
pnpm format      # Format code with Prettier
pnpm clean       # Clean all build artifacts
pnpm db:push     # Push database schema
pnpm db:generate # Generate Drizzle migrations
```

## 🏗️ Development

### Frontend (Next.js)
```bash
cd apps/web
pnpm dev        # Runs on http://localhost:3000
```

### Backend (Express + tRPC)
```bash
cd apps/api
pnpm dev        # Runs on http://localhost:3001
```

### Database
```bash
cd packages/db
pnpm db:studio  # Open Drizzle Studio
```

## 🎯 Color Extraction Algorithm

Our color extraction uses a hybrid approach:

1. **K-Means++ Clustering** - Optimal centroid initialization
2. **Perceptual Color Space** - RGB → HSL conversion for accurate grouping
3. **ML Enhancement** - Hugging Face CLIP for semantic understanding
4. **Luminance Sorting** - Designer-friendly color ordering
5. **Shade Generation** - Automatic 50-950 Tailwind scales

No external color libraries - pure algorithmic implementation for maximum control.

## 📊 Database Schema

### Tables

- `users` - User accounts
- `palettes` - Saved color palettes
- `api_keys` - API key management & usage tracking

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Environment Variables for Production

```env
DATABASE_URL=postgresql://...  # Your production database
HUGGINGFACE_API_KEY=hf_...    # Your HF API key
NODE_ENV=production
```

## 📝 API Endpoints

### REST Endpoints

```
POST   /api/colors/extract     - Extract colors from image
POST   /api/palettes           - Create palette
GET    /api/palettes/:id       - Get palette by ID
GET    /api/palettes/user/:id  - Get user's palettes
```

### tRPC Routes

```typescript
palette.create      - Create palette
palette.getById     - Get palette by ID
palette.listByUser  - List user palettes
```

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Hugging Face for ML infrastructure
- Tailwind CSS for design system
- shadcn/ui for component library
- Vercel for hosting platform

---

Built with 🧡 for designers
