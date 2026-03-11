# GitHub Portfolio Evaluator (OpenAI)

An evidence-grounded GitHub portfolio review agent built for hiring-style evaluation. It inspects repository structure, sampled code, configuration and infrastructure files, and deterministic repo signals before asking `gpt-4o` to produce a portfolio score, repository breakdowns, and a prioritized improvement roadmap.

## What it does

- Reviews a public GitHub profile against a target role.
- Builds a full portfolio catalog so older strong repos still influence the result.
- Selects a representative deep-review set using recency, substance, popularity, and role relevance.
- Samples code, manifests, workflows, infra files, schemas, and test/config assets from each selected repo.
- Runs deterministic checks for tests, API usage, Docker or containerization, CI/CD, database usage, and AI or LLM integration.
- Forces every finding to cite file paths or explicitly say `insufficient evidence`.

## Analysis pipeline

1. Fetch all non-fork, non-archived repositories for the profile.
2. Build a portfolio catalog used for fairness at the portfolio-summary level.
3. Rank repositories with a role-aware selector and choose up to 6 for deep analysis.
4. Load README content, repo trees, recent commits, sampled code files, and evidence files.
5. Extract deterministic repo signals before calling the LLM.
6. Send grounded repository context to OpenAI `gpt-4o`.
7. Normalize and guardrail the model output so unsupported claims are replaced with evidence-backed findings or `insufficient evidence`.

## Tech stack

| Component | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| LLM engine | OpenAI `gpt-4o` |
| Data source | GitHub REST API |

## Local setup

```bash
git clone <repo-url>
cd portfolio-evaluator-openai
npm install
cp .env.example .env.local
```

Set the required variables in `.env.local`:

```env
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
```

- `OPENAI_API_KEY` is required for analysis.
- `GITHUB_TOKEN` is strongly recommended to avoid low unauthenticated rate limits.

Run the app:

```bash
npm run dev
```

Validation commands:

```bash
npm run lint
npm run build
```

## Vercel deployment

1. Import the `Github-evaluator-openAI` repository into Vercel.
2. Add `OPENAI_API_KEY` and `GITHUB_TOKEN` in Project Settings > Environment Variables.
3. Deploy with the default Next.js settings.

The app will deploy without those variables, but live analysis will fail until `OPENAI_API_KEY` is set.

## Project structure

```text
portfolio-evaluator-openai/
├── app/
│   ├── api/analyze/route.ts   # Analysis endpoint
│   ├── globals.css            # Global styling
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Dashboard UI
├── lib/
│   ├── gemini.ts              # OpenAI analysis client and output guardrails
│   └── github.ts              # GitHub fetcher, repo sampler, deterministic signals
├── .env.example
└── package.json
```

## Notes

- The file name `lib/gemini.ts` is kept for parity with the Gemini variant; in this repository it calls the OpenAI API.
- The UI is shared with the Gemini repo, but this repository is the Vercel-ready OpenAI deployment target.

## License

MIT
