// AI API Client
// Sends structured prompts for code analysis and parses JSON responses

import { PortfolioRepoSummary, RepoData } from './github';

export interface DimensionScore {
  score: number;
  maxScore: number;
  findings: string[];
  suggestions: string[];
}

export interface RepoAnalysis {
  repoName: string;
  repoUrl: string;
  language: string | null;
  stars: number;
  codeQuality: DimensionScore;
  projectComplexity: DimensionScore;
  documentation: DimensionScore;
  consistency: DimensionScore;
  techRelevance: DimensionScore;
  overallRepoScore: number;
  summary: string;
}

export interface PortfolioAnalysis {
  overallScore: number;
  scoreBand: string;
  dimensions: {
    codeQuality: DimensionScore;
    projectComplexity: DimensionScore;
    documentation: DimensionScore;
    consistency: DimensionScore;
    techRelevance: DimensionScore;
  };
  repoAnalyses: RepoAnalysis[];
  recommendations: {
    priority: number;
    title: string;
    description: string;
    impact: string;
    dimension: string;
  }[];
  profileSummary: string;
  strengths: string[];
  concerns: string[];
}

const LLM_API_BASE = 'https://api.openai.com/v1';
const MAX_PORTFOLIO_CATALOG_ITEMS = 50;

function buildPortfolioCatalogContext(portfolioCatalog: PortfolioRepoSummary[]): string {
  return portfolioCatalog
    .slice(0, MAX_PORTFOLIO_CATALOG_ITEMS)
    .map((repo, index) => {
      const topics = repo.topics.length ? repo.topics.join(', ') : 'none';
      return `${index + 1}. ${repo.name} | ${repo.language || 'Unknown'} | ${repo.stars} stars | ${repo.forks} forks | updated ${repo.pushedAt.split('T')[0]} | topics: ${topics} | ${repo.description || 'No description'}`;
    })
    .join('\n');
}

function buildBatchedPrompt(
  repos: RepoData[],
  targetRole: string,
  username: string,
  totalRepos: number,
  portfolioCatalog: PortfolioRepoSummary[]
): string {
  const portfolioCatalogContext = buildPortfolioCatalogContext(portfolioCatalog);
  const reposContext = repos
    .map((repo, index) => {
      const fileTreeSample = repo.fileTree.slice(0, 60).join('\n');
      const commitMessages = repo.recentCommits
        .slice(0, 10)
        .map(
          (commit) =>
            `- ${commit.commit.message.split('\n')[0]} (${commit.commit.author.date.split('T')[0]})`
        )
        .join('\n');
      const codeFilesContent = repo.sampleFiles
        .map((file) => `--- FILE: ${file.path} ---\n${file.content.substring(0, 3000)}`)
        .join('\n\n');
      const languagesStr = Object.entries(repo.languages)
        .map(([language, bytes]) => `${language}: ${bytes} bytes`)
        .join(', ');

      return `
========================================
REPOSITORY ${index + 1}: ${repo.repo.name}
========================================
- Description: ${repo.repo.description || 'No description'}
- Primary Language: ${repo.repo.language || 'Unknown'} (Languages: ${languagesStr || 'No language breakdown'})
- Stars: ${repo.repo.stargazers_count}
- Open Issues: ${repo.repo.open_issues_count}
- Created: ${repo.repo.created_at} / Last Pushed: ${repo.repo.pushed_at}

FILE TREE (first 60 files):
${fileTreeSample || 'No file tree available'}

RECENT COMMITS:
${commitMessages || 'No commits available'}

README HIGHLIGHTS:
${repo.readme?.substring(0, 1500) || 'No README found'}

SAMPLE CODE FILES:
${codeFilesContent || 'No code files sampled'}
`;
    })
    .join('\n\n');

  return `You are an expert career intelligence AI evaluating a GitHub portfolio for user "${username}" applying for the role of "${targetRole}". They have ${totalRepos} public repositories.

You have two context layers:
1. FULL PORTFOLIO CATALOG: metadata across the user's non-fork, non-archived repositories. Use this for portfolio-level fairness so you do not over-index on recency alone.
2. REPRESENTATIVE REPOSITORY SET: ${repos.length} repositories selected for deep technical review using recency, substance, popularity, and relevance to "${targetRole}".

FULL PORTFOLIO CATALOG (up to ${MAX_PORTFOLIO_CATALOG_ITEMS} repositories):
${portfolioCatalogContext || 'No portfolio catalog available'}

${reposContext}

EVALUATION INSTRUCTIONS:
1. Produce EXACTLY ${repos.length} repoAnalyses entries, one for each representative repository above, in the same order. Never omit, merge, or rename repositories.
2. For each representative repository, analyze 5 dimensions. For each dimension, provide a score (0-20), 2 specific findings, and 1 actionable suggestion.
3. Use the FULL PORTFOLIO CATALOG when writing portfolioSummary strengths, concerns, and recommendations so older but stronger repositories can still influence the overall judgment.
4. If a repository has weak documentation or limited context, still return a best-effort entry instead of skipping it.

DIMENSIONS:
1. CODE QUALITY (0-20): readability, naming, DRY/SOLID, security, modern language features
2. PROJECT COMPLEXITY (0-20): architecture, APIs, DBs, Docker, testing
3. DOCUMENTATION (0-20): README, inline comments, API docs
4. CONSISTENCY & ACTIVITY (0-20): commit frequency, styling, maintenance habits
5. TECH RELEVANCE (0-20): alignment with "${targetRole}" tech stack

Provide a PORTFOLIO-LEVEL summary including:
1. Top 3-5 prioritized recommendations overall (each with title, description, estimated score impact +X pts, and affected dimension)
2. 3 key strengths
3. 2-3 areas of concern
4. A 2-sentence profile summary

Respond ONLY with valid JSON in this exact format (no markdown fences):
{
  "repoAnalyses": [
    {
      "repoName": "<repo name>",
      "codeQuality": { "score": <0-20>, "findings": ["...", "..."], "suggestions": ["..."] },
      "projectComplexity": { "score": <0-20>, "findings": ["...", "..."], "suggestions": ["..."] },
      "documentation": { "score": <0-20>, "findings": ["...", "..."], "suggestions": ["..."] },
      "consistency": { "score": <0-20>, "findings": ["...", "..."], "suggestions": ["..."] },
      "techRelevance": { "score": <0-20>, "findings": ["...", "..."], "suggestions": ["..."] },
      "summary": "<Brief 1-sentence summary of this repo>"
    }
  ],
  "portfolioSummary": {
    "recommendations": [
      { "priority": 1, "title": "...", "description": "...", "impact": "+X-Y pts", "dimension": "codeQuality|projectComplexity|documentation|consistency|techRelevance" }
    ],
    "strengths": ["...", "...", "..."],
    "concerns": ["...", "..."],
    "profileSummary": "..."
  }
}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLlm(prompt: string, apiKey: string, maxRetries = 2): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert software engineer and career intelligence AI. Respond ONLY with valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const waitTime = Math.min(4000 * 2 ** attempt, 15000);
        await delay(waitTime);
        continue;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} — ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('No response from API');
    }

    return text;
  }

  throw new Error('API: max retries exceeded');
}

function parseJSON<T>(text: string): T {
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(cleaned);
}

function normalizeRepoName(repoName: string): string {
  return repoName.trim().toLowerCase();
}

function buildFallbackDimensionScore(dimension: string): DimensionScore {
  return {
    score: 10,
    maxScore: 20,
    findings: [`The model did not return a structured ${dimension} review for this repository.`],
    suggestions: [`Re-run the analysis or inspect this repository manually for a detailed ${dimension} assessment.`],
  };
}

function buildFallbackRepoAnalysis(repo: RepoData): RepoAnalysis {
  const codeQuality = buildFallbackDimensionScore('code quality');
  const projectComplexity = buildFallbackDimensionScore('complexity');
  const documentation = buildFallbackDimensionScore('documentation');
  const consistency = buildFallbackDimensionScore('consistency');
  const techRelevance = buildFallbackDimensionScore('tech relevance');

  return {
    repoName: repo.repo.name,
    repoUrl: repo.repo.html_url,
    language: repo.repo.language,
    stars: repo.repo.stargazers_count,
    codeQuality,
    projectComplexity,
    documentation,
    consistency,
    techRelevance,
    overallRepoScore:
      codeQuality.score +
      projectComplexity.score +
      documentation.score +
      consistency.score +
      techRelevance.score,
    summary:
      repo.repo.description ||
      'Repository included in the representative sample, but the model did not return a structured breakdown.',
  };
}

export async function analyzePortfolio(
  repos: RepoData[],
  targetRole: string,
  username: string,
  totalRepos: number,
  apiKey: string,
  portfolioCatalog: PortfolioRepoSummary[],
  onProgress?: (current: number, total: number, repoName: string) => void
): Promise<PortfolioAnalysis> {
  const reposToAnalyze = repos;

  if (onProgress) {
    onProgress(1, 1, 'Representative Portfolio Analysis');
  }

  const prompt = buildBatchedPrompt(
    reposToAnalyze,
    targetRole,
    username,
    totalRepos,
    portfolioCatalog
  );
  const responseText = await callLlm(prompt, apiKey);

  const parsed = parseJSON<{
    repoAnalyses: {
      repoName: string;
      codeQuality: DimensionScore;
      projectComplexity: DimensionScore;
      documentation: DimensionScore;
      consistency: DimensionScore;
      techRelevance: DimensionScore;
      summary: string;
    }[];
    portfolioSummary: {
      recommendations: {
        priority: number;
        title: string;
        description: string;
        impact: string;
        dimension: string;
      }[];
      strengths: string[];
      concerns: string[];
      profileSummary: string;
    };
  }>(responseText);

  const clamp = (dimension: DimensionScore): DimensionScore => ({
    ...dimension,
    score: Math.max(0, Math.min(20, dimension.score)),
    maxScore: 20,
  });

  const parsedByName = new Map(
    parsed.repoAnalyses.map((repoAnalysis) => [
      normalizeRepoName(repoAnalysis.repoName),
      repoAnalysis,
    ])
  );

  const repoAnalyses: RepoAnalysis[] = reposToAnalyze.map((repo) => {
    const parsedRepo = parsedByName.get(normalizeRepoName(repo.repo.name));

    if (!parsedRepo) {
      return buildFallbackRepoAnalysis(repo);
    }

    const codeQuality = clamp(parsedRepo.codeQuality);
    const projectComplexity = clamp(parsedRepo.projectComplexity);
    const documentation = clamp(parsedRepo.documentation);
    const consistency = clamp(parsedRepo.consistency);
    const techRelevance = clamp(parsedRepo.techRelevance);

    const repoScore =
      codeQuality.score +
      projectComplexity.score +
      documentation.score +
      consistency.score +
      techRelevance.score;

    return {
      repoName: repo.repo.name,
      repoUrl: repo.repo.html_url,
      language: repo.repo.language,
      stars: repo.repo.stargazers_count,
      codeQuality,
      projectComplexity,
      documentation,
      consistency,
      techRelevance,
      overallRepoScore: Math.max(0, Math.min(100, repoScore)),
      summary: parsedRepo.summary || repo.repo.description || 'Analysis complete.',
    };
  });

  const average = (getter: (repo: RepoAnalysis) => number) =>
    Math.round(
      repoAnalyses.reduce((sum, repo) => sum + getter(repo), 0) /
        Math.max(repoAnalyses.length, 1)
    );

  const dimensions = {
    codeQuality: {
      score: average((repo) => repo.codeQuality.score),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.codeQuality.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.codeQuality.suggestions).slice(0, 3),
    },
    projectComplexity: {
      score: average((repo) => repo.projectComplexity.score),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.projectComplexity.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.projectComplexity.suggestions).slice(0, 3),
    },
    documentation: {
      score: average((repo) => repo.documentation.score),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.documentation.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.documentation.suggestions).slice(0, 3),
    },
    consistency: {
      score: average((repo) => repo.consistency.score),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.consistency.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.consistency.suggestions).slice(0, 3),
    },
    techRelevance: {
      score: average((repo) => repo.techRelevance.score),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.techRelevance.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.techRelevance.suggestions).slice(0, 3),
    },
  };

  const overallScore =
    dimensions.codeQuality.score +
    dimensions.projectComplexity.score +
    dimensions.documentation.score +
    dimensions.consistency.score +
    dimensions.techRelevance.score;

  const scoreBand =
    overallScore >= 85
      ? 'Exceptional'
      : overallScore >= 70
        ? 'Strong'
        : overallScore >= 50
          ? 'Developing'
          : overallScore >= 30
            ? 'Emerging'
            : 'Needs Work';

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    scoreBand,
    dimensions,
    repoAnalyses,
    recommendations: parsed.portfolioSummary.recommendations || [],
    profileSummary: parsed.portfolioSummary.profileSummary || 'Analysis complete.',
    strengths: parsed.portfolioSummary.strengths || [],
    concerns: parsed.portfolioSummary.concerns || [],
  };
}
