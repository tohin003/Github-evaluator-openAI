# Code Portfolio Evaluator — AI-Powered GitHub Analysis

An agentic AI system that evaluates a candidate's GitHub portfolio and generates a comprehensive **Portfolio Score (0-100)** with dimensional breakdowns, per-repository insights, strengths, concerns, and an actionable improvement roadmap.

Built as the **Part B prototype** for the JSO Internship Assignment.

---

## Features

- **GitHub Username + Target Role Input** — Enter any public GitHub username and specify the role they're applying for (e.g. "Senior Full Stack Developer")
- **Batched Multi-Repo Analysis** — Evaluates up to 10 repositories in a single LLM call for speed and reliability
- **5-Dimensional Scoring** — Code Quality, Project Complexity, Documentation, Consistency & Activity, Tech Relevance (each 0-20)
- **Expandable Repository Insights** — Click any repo to reveal its individual score breakdown, key positives, and suggested improvements
- **AI-Generated Improvement Roadmap** — Prioritized recommendations with estimated score impact
- **Strengths & Concerns Summary** — Quick overview for HR consultants and recruiters

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| LLM Engine | OpenAI `gpt-4o-mini` |
| Data Source | GitHub REST API |
| Language | TypeScript |

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd portfolio-evaluator
npm install
```

### 2. Configure Environment

Create a `.env.local` file:

```env
GITHUB_TOKEN=ghp_your_github_personal_access_token
OPENAI_API_KEY=sk-your_openai_api_key
```

- **GITHUB_TOKEN** — A GitHub Personal Access Token (classic) with `public_repo` scope. Increases the API rate limit from 60 to 5000 requests/hour.
- **OPENAI_API_KEY** — An OpenAI API key.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
Input: GitHub Username + Target Role
        │
        ▼
┌─────────────────────────────────┐
│  GitHub REST API (Data Fetch)   │
│  • Profile, Repos, File Trees   │
│  • Commits, README, Code Files  │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  OpenAI gpt-4o-mini (Analysis)  │
│  • Batched multi-repo prompt    │
│  • 5-dimensional scoring        │
│  • Portfolio-level summary      │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Next.js Dashboard (Display)    │
│  • Score card + profile summary │
│  • Dimensional breakdown cards  │
│  • Expandable repo insights     │
│  • Strengths, concerns, roadmap │
└─────────────────────────────────┘
```

---

## Provider Note

> This repository is the OpenAI deployment copy of the project. It runs on `gpt-4o-mini` and is intended for Vercel deployment with `OPENAI_API_KEY` and `GITHUB_TOKEN` configured as environment variables.

## Deploying to Vercel

1. Import the repository into Vercel.
2. Add `OPENAI_API_KEY` and `GITHUB_TOKEN` in Project Settings > Environment Variables.
3. Deploy with the default Next.js build settings.

The original `portfolio-evaluator` directory in this workspace remains the Gemini-based variant.

---

## Project Structure

```
portfolio-evaluator/
├── app/
│   ├── page.tsx              # Main dashboard UI
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Tailwind v4 styles
│   └── api/
│       └── analyze/
│           └── route.ts      # POST /api/analyze endpoint
├── lib/
│   ├── gemini.ts             # LLM client (batched prompt + parsing)
│   └── github.ts             # GitHub API data fetching
├── .env.local                # API keys (not committed)
└── package.json
```

## License

MIT
