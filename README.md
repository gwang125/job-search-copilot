# Job Search Copilot

AI-powered job search assistant built with Next.js 15, Supabase, and OpenAI.

## Features

- **Profile** - Store background details and Find Jobs search settings
- **Resumes** - Upload PDF or Word resumes for matching
- **Find Jobs** - Search LinkedIn with saved keywords, filters, and selected resume text
- **Job Analyzer** - Paste or parse a job URL, get match analysis and resume recommendation
- **Cover letters** - Generate and download cover letters without storing an archive
- **Applications** - Track application status
- **Documents** - View and download generated cover letters

## Prerequisites

- Node.js 20+
- [Supabase](https://supabase.com) project
- [OpenAI](https://platform.openai.com) API key

## Setup

### 1. Install dependencies

```bash
cd job-search-copilot
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-openai-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabase database

1. Open your Supabase project, then **SQL Editor**
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/storage.sql` if needed for storage setup
4. In **Authentication > Providers**, enable Email

### 4. Run locally

If styles look unstyled after pulling changes, clear the Next.js cache and restart:

```bash
rm -rf .next
npm run dev
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, add a resume and profile, then use **Find Jobs** or **Job Analyzer**.

## Layout

- `src/app/layout.tsx` - root HTML/body + `globals.css` only
- `src/app/(app)/layout.tsx` - wraps authenticated pages in `AppShell` (one sidebar)
- Auth pages (`/login`, `/signup`) are outside `(app)` and have no sidebar

## Tailwind CSS

This project uses **Tailwind CSS v3** with PostCSS (`tailwindcss` + `autoprefixer`).

`src/app/globals.css` must include:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Utility scanning is configured in `tailwind.config.js`. If styles look broken after pulling changes, clear `.next` and restart the dev server.

## Project structure

```text
src/
  app/              # Next.js App Router pages & API routes
  components/       # UI and feature components
  lib/              # Supabase, OpenAI, PDF, utilities
  types/            # TypeScript types
supabase/           # SQL migrations
```

## API routes

| Route | Description |
|-------|-------------|
| `POST /api/jobs/parse-url` | Scrape job posting from URL |
| `POST /api/jobs/check-duplicate` | Detect similar saved applications |
| `POST /api/jobs/analyze` | AI match analysis + save job/application |
| `POST /api/jobs/generate-cover-letter` | Cover letter text |
| `POST /api/export/pdf` | Cover letter PDF download |

## Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript check
- `npm test` - Run focused unit tests
- `npm run build:verify` - Typecheck, build, and verify generated CSS

## Notes

- Resume uploads support PDF and DOCX files
- Job URL parsing may fail on sites that block scrapers - paste the description manually
- OpenAI model defaults to `gpt-4o-mini` (see `src/lib/openai/client.ts`)
