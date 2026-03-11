// AI API Client
// Sends structured prompts for code analysis and parses JSON responses

import { RepoData } from './github';

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

function buildBatchedPrompt(repos: RepoData[], targetRole: string, username: string, totalRepos: number): string {
    const reposContext = repos.map((repo, idx) => {
        const fileTreeSample = repo.fileTree.slice(0, 60).join('\n');
        const commitMessages = repo.recentCommits
            .slice(0, 10)
            .map((c) => `- ${c.commit.message.split('\n')[0]} (${c.commit.author.date.split('T')[0]})`)
            .join('\n');
        const codeFilesContent = repo.sampleFiles
            .map((f) => `--- FILE: ${f.path} ---\n${f.content.substring(0, 3000)}`)
            .join('\n\n');
        const languagesStr = Object.entries(repo.languages)
            .map(([lang, bytes]) => `${lang}: ${bytes} bytes`)
            .join(', ');

        return `
========================================
REPOSITORY ${idx + 1}: ${repo.repo.name}
========================================
- Description: ${repo.repo.description || 'No description'}
- Primary Language: ${repo.repo.language || 'Unknown'} (Languages: ${languagesStr})
- Stars: ${repo.repo.stargazers_count}
- Open Issues: ${repo.repo.open_issues_count}
- Created: ${repo.repo.created_at} / Last Pushed: ${repo.repo.pushed_at}

FILE TREE (first 60 files):
${fileTreeSample}

RECENT COMMITS:
${commitMessages || 'No commits available'}

README HIGHLIGHTS:
${repo.readme?.substring(0, 1500) || 'No README found'}

SAMPLE CODE FILES:
${codeFilesContent || 'No code files sampled'}
`;
    }).join('\n\n');

    return `You are an expert career intelligence AI evaluating a GitHub portfolio for user "${username}" applying for the role of "${targetRole}". They have ${totalRepos} public repos, but we are analyzing their top ${repos.length} most active repositories.

${reposContext}

EVALUATION INSTRUCTIONS:
First, analyze EACH repository across 5 dimensions. For each dimension, provide a score (0-20), 2 specific findings (cite files), and 1 actionable suggestion.
DIMENSIONS:
1. CODE QUALITY (0-20): readability, naming, DRY/SOLID, security, modern language features
2. PROJECT COMPLEXITY (0-20): architecture, APIs, DBs, Docker, testing
3. DOCUMENTATION (0-20): README, inline comments, API docs
4. CONSISTENCY & ACTIVITY (0-20): commit frequency, styling, branch strategy
5. TECH RELEVANCE (0-20): alignment with "${targetRole}" tech stack

Second, provide a PORTFOLIO-LEVEL summary including:
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
        const response = await fetch(
            `${LLM_API_BASE}/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are an expert software engineer and career intelligence AI. Respond ONLY with valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    response_format: { type: 'json_object' }
                }),
            }
        );

        if (response.status === 429 || response.status >= 500) {
            if (attempt < maxRetries) {
                const waitTime = Math.min(4000 * Math.pow(2, attempt), 15000);
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

export async function analyzePortfolio(
    repos: RepoData[],
    targetRole: string,
    username: string,
    totalRepos: number,
    apiKey: string,
    onProgress?: (current: number, total: number, repoName: string) => void
): Promise<PortfolioAnalysis> {
    // We can evaluate up to 10 repos in a single batched prompt
    const reposToAnalyze = repos.slice(0, 10);
    if (onProgress) onProgress(1, 1, 'Batched Portfolio Analysis');

    const prompt = buildBatchedPrompt(reposToAnalyze, targetRole, username, totalRepos);
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
            recommendations: { priority: number; title: string; description: string; impact: string; dimension: string; }[];
            strengths: string[];
            concerns: string[];
            profileSummary: string;
        };
    }>(responseText);

    const clamp = (d: DimensionScore): DimensionScore => ({
        ...d,
        score: Math.max(0, Math.min(20, d.score)),
        maxScore: 20,
    });

    const repoAnalyses: RepoAnalysis[] = parsed.repoAnalyses.map(parsedRepo => {
        // Find corresponding original repo data to attach URL, stars, etc.
        const originalRepo = reposToAnalyze.find(r => r.repo.name.toLowerCase() === parsedRepo.repoName.toLowerCase()) || reposToAnalyze[0];

        const cQ = clamp(parsedRepo.codeQuality);
        const pC = clamp(parsedRepo.projectComplexity);
        const doc = clamp(parsedRepo.documentation);
        const con = clamp(parsedRepo.consistency);
        const tR = clamp(parsedRepo.techRelevance);

        const repoScore = cQ.score + pC.score + doc.score + con.score + tR.score;

        return {
            repoName: parsedRepo.repoName,
            repoUrl: originalRepo.repo.html_url,
            language: originalRepo.repo.language,
            stars: originalRepo.repo.stargazers_count,
            codeQuality: cQ,
            projectComplexity: pC,
            documentation: doc,
            consistency: con,
            techRelevance: tR,
            overallRepoScore: Math.max(0, Math.min(100, repoScore)),
            summary: parsedRepo.summary,
        };
    });

    // Calculate weighted overall scores (more recent/active repos weigh more)
    const weights = repoAnalyses.map((_, i) => Math.max(1, repoAnalyses.length - i));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const weightedAvg = (getter: (r: RepoAnalysis) => number) =>
        Math.round(
            repoAnalyses.reduce((sum, r, i) => sum + getter(r) * weights[i], 0) / totalWeight
        );

    const dimensions = {
        codeQuality: {
            score: weightedAvg((r) => r.codeQuality.score),
            maxScore: 20,
            findings: repoAnalyses.flatMap((r) => r.codeQuality.findings).slice(0, 5),
            suggestions: repoAnalyses.flatMap((r) => r.codeQuality.suggestions).slice(0, 3),
        },
        projectComplexity: {
            score: weightedAvg((r) => r.projectComplexity.score),
            maxScore: 20,
            findings: repoAnalyses.flatMap((r) => r.projectComplexity.findings).slice(0, 5),
            suggestions: repoAnalyses.flatMap((r) => r.projectComplexity.suggestions).slice(0, 3),
        },
        documentation: {
            score: weightedAvg((r) => r.documentation.score),
            maxScore: 20,
            findings: repoAnalyses.flatMap((r) => r.documentation.findings).slice(0, 5),
            suggestions: repoAnalyses.flatMap((r) => r.documentation.suggestions).slice(0, 3),
        },
        consistency: {
            score: weightedAvg((r) => r.consistency.score),
            maxScore: 20,
            findings: repoAnalyses.flatMap((r) => r.consistency.findings).slice(0, 5),
            suggestions: repoAnalyses.flatMap((r) => r.consistency.suggestions).slice(0, 3),
        },
        techRelevance: {
            score: weightedAvg((r) => r.techRelevance.score),
            maxScore: 20,
            findings: repoAnalyses.flatMap((r) => r.techRelevance.findings).slice(0, 5),
            suggestions: repoAnalyses.flatMap((r) => r.techRelevance.suggestions).slice(0, 3),
        },
    };

    const overallScore =
        dimensions.codeQuality.score +
        dimensions.projectComplexity.score +
        dimensions.documentation.score +
        dimensions.consistency.score +
        dimensions.techRelevance.score;

    const scoreBand =
        overallScore >= 85 ? 'Exceptional' : overallScore >= 70 ? 'Strong' : overallScore >= 50 ? 'Developing' : overallScore >= 30 ? 'Emerging' : 'Needs Work';

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
