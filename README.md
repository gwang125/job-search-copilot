# Job Search Copilot

AI-powered job search assistant built with Next.js 15, Supabase, and OpenAI.

## Features

- **Profile** — Store skills, experience, education, and job preferences
- **Resumes** — Upload resume text (.txt) for AI tailoring
- **Job Analyzer** — Paste or parse a job URL, get match analysis, tailored resume, cover letter, and PDF export
- **Applications** — Track application status
- **Documents** — View and download generated materials

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

1. Open your Supabase project → **SQL Editor**
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/storage.sql` (optional, for future file uploads)
4. In **Authentication → Providers**, enable Email

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

Open [http://localhost:3000](http://localhost:3000), sign up, add a resume and profile, then use **Job Analyzer**.

## Layout

- `src/app/layout.tsx` — root HTML/body + `globals.css` only
- `src/app/(app)/layout.tsx` — wraps authenticated pages in `AppShell` (one sidebar)
- Auth pages (`/login`, `/signup`) are outside `(app)` and have no sidebar

## Tailwind CSS

This project uses **Tailwind CSS v4** with PostCSS (`@tailwindcss/postcss`).

`src/app/globals.css` must include:

```css
@import "tailwindcss";
@source "../**/*.{js,ts,jsx,tsx,mdx}";
```

Without `@source`, utility classes are not generated and the UI will look broken (duplicate sidebars, no layout).

## Project structure

```
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
| `POST /api/jobs/generate-resume` | Tailored resume JSON |
| `POST /api/jobs/generate-cover-letter` | Cover letter text |
| `POST /api/export/pdf` | PDF download |

## Scripts

- `npm run dev` — Development server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — ESLint

## Notes

- Resume uploads support `.txt` paste/upload; PDF parsing is not included in the MVP
- Job URL parsing may fail on sites that block scrapers — paste the description manually
- OpenAI model defaults to `gpt-4o-mini` (see `src/lib/openai/client.ts`)
