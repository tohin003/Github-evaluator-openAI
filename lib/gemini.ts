// AI API Client
// Produces grounded repository reviews using deterministic repo signals plus LLM synthesis.

import { PortfolioRepoSummary, RepoData, RepoSignals } from './github';

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

type RawDimensionScore = Omit<DimensionScore, 'maxScore'>;

const LLM_API_BASE = 'https://api.openai.com/v1';
const MAX_PORTFOLIO_CATALOG_ITEMS = 50;
const MAX_FILE_TREE_ENTRIES_IN_PROMPT = 90;
const MAX_SAMPLE_FILE_CHARS_IN_PROMPT = 2600;
const MAX_EVIDENCE_FILE_CHARS_IN_PROMPT = 1600;
const ALL_EVIDENCE_CITATIONS_PATTERN = /\(\s*evidence:\s*([^)]+)\)/gi;

const STRING_ARRAY_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
} as const;

const DIMENSION_SCORE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'number' },
    findings: STRING_ARRAY_SCHEMA,
    suggestions: STRING_ARRAY_SCHEMA,
  },
  required: ['score', 'findings', 'suggestions'],
} as const;

const ANALYSIS_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'portfolio_analysis',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        repoAnalyses: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              repoName: { type: 'string' },
              codeQuality: DIMENSION_SCORE_SCHEMA,
              projectComplexity: DIMENSION_SCORE_SCHEMA,
              documentation: DIMENSION_SCORE_SCHEMA,
              consistency: DIMENSION_SCORE_SCHEMA,
              techRelevance: DIMENSION_SCORE_SCHEMA,
              summary: { type: 'string' },
            },
            required: [
              'repoName',
              'codeQuality',
              'projectComplexity',
              'documentation',
              'consistency',
              'techRelevance',
              'summary',
            ],
          },
        },
        portfolioSummary: {
          type: 'object',
          additionalProperties: false,
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  priority: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  impact: { type: 'string' },
                  dimension: { type: 'string' },
                },
                required: ['priority', 'title', 'description', 'impact', 'dimension'],
              },
            },
            strengths: STRING_ARRAY_SCHEMA,
            concerns: STRING_ARRAY_SCHEMA,
            profileSummary: { type: 'string' },
          },
          required: ['recommendations', 'strengths', 'concerns', 'profileSummary'],
        },
      },
      required: ['repoAnalyses', 'portfolioSummary'],
    },
  },
} as const;

function buildPortfolioCatalogContext(portfolioCatalog: PortfolioRepoSummary[]): string {
  return portfolioCatalog
    .slice(0, MAX_PORTFOLIO_CATALOG_ITEMS)
    .map((repo, index) => {
      const topics = repo.topics.length ? repo.topics.join(', ') : 'none';
      return `${index + 1}. ${repo.name} | ${repo.language || 'Unknown'} | ${repo.stars} stars | ${repo.forks} forks | updated ${repo.pushedAt.split('T')[0]} | topics: ${topics} | ${repo.description || 'No description'}`;
    })
    .join('\n');
}

function buildSignalContext(label: string, signal: { summary: string; evidencePaths: string[] }): string {
  if (!signal.evidencePaths.length) {
    return `- ${label}: ${signal.summary} (evidence: insufficient evidence)`;
  }

  return `- ${label}: ${signal.summary} (evidence: ${signal.evidencePaths.join(', ')})`;
}

function buildSignalsContext(signals: RepoSignals): string {
  return [
    buildSignalContext('Tests', signals.tests),
    buildSignalContext('API usage', signals.apiUsage),
    buildSignalContext('Docker or containerization', signals.docker),
    buildSignalContext('CI/CD automation', signals.ci),
    buildSignalContext('Database usage', signals.database),
    buildSignalContext('AI or LLM integration', signals.ai),
    `- Detected technologies: ${signals.detectedTechnologies.join(', ') || 'insufficient evidence'}`,
  ].join('\n');
}

function buildRepoContext(repo: RepoData, index: number): string {
  const fileTreeSample = repo.fileTree.slice(0, MAX_FILE_TREE_ENTRIES_IN_PROMPT).join('\n');
  const commitMessages = repo.recentCommits
    .slice(0, 12)
    .map(
      (commit) =>
        `- ${commit.commit.message.split('\n')[0]} (${commit.commit.author.date.split('T')[0]})`
    )
    .join('\n');

  const codeFilesContent = repo.sampleFiles
    .map(
      (file) =>
        `--- CODE FILE: ${file.path} ---\n${file.content.substring(0, MAX_SAMPLE_FILE_CHARS_IN_PROMPT)}`
    )
    .join('\n\n');

  const evidenceFilesContent = repo.evidenceFiles
    .map(
      (file) =>
        `--- ${file.kind.toUpperCase()} FILE: ${file.path} ---\n${file.content.substring(0, MAX_EVIDENCE_FILE_CHARS_IN_PROMPT)}`
    )
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

DETERMINISTIC SIGNALS:
${buildSignalsContext(repo.signals)}

FILE TREE (first ${MAX_FILE_TREE_ENTRIES_IN_PROMPT} files):
${fileTreeSample || 'No file tree available'}

RECENT COMMITS:
${commitMessages || 'No commits available'}

README HIGHLIGHTS:
${repo.readme?.substring(0, 1600) || 'No README found'}

SAMPLED CODE FILES:
${codeFilesContent || 'No code files sampled'}

EVIDENCE FILE EXCERPTS:
${evidenceFilesContent || 'No additional evidence files sampled'}
`;
}

function buildBatchedPrompt(
  repos: RepoData[],
  targetRole: string,
  username: string,
  totalRepos: number,
  portfolioCatalog: PortfolioRepoSummary[]
): string {
  const portfolioCatalogContext = buildPortfolioCatalogContext(portfolioCatalog);
  const reposContext = repos.map(buildRepoContext).join('\n\n');

  return `You are a production-grade GitHub portfolio evaluator for hiring decisions.

You are evaluating GitHub user "${username}" for the role "${targetRole}".
They have ${totalRepos} non-fork, non-archived public repositories.

You have two context layers:
1. FULL PORTFOLIO CATALOG: broad metadata across the portfolio to prevent recency bias.
2. REPRESENTATIVE REPOSITORY SNAPSHOTS: deep evidence from selected repositories including code files, config files, infra/workflow files, and deterministic repository signals.

FULL PORTFOLIO CATALOG (up to ${MAX_PORTFOLIO_CATALOG_ITEMS} repositories):
${portfolioCatalogContext || 'No portfolio catalog available'}

${reposContext}

MANDATORY ANALYSIS RULES:
1. Produce EXACTLY ${repos.length} repoAnalyses entries, one for each representative repository above, in the same order. Never omit, merge, or rename repositories.
2. Every finding MUST end with a citation in this exact form: "(evidence: path1, path2)".
3. If you cannot ground a finding in inspected files or deterministic signals, you MUST write "(evidence: insufficient evidence)".
4. Never make unsupported absence claims such as "no API", "no database", or "no tests" unless you can ground that statement. If evidence is incomplete, say insufficient evidence instead.
5. Prefer sampled code files, evidence files, and deterministic signals over README claims when they conflict.
6. Avoid generic statements. Every finding should point to specific implementation evidence or explicitly say insufficient evidence.
7. Suggestions should be actionable and tied to the observed evidence, but they do not need file-path citations.
8. Use the FULL PORTFOLIO CATALOG when writing the portfolio summary so older but stronger repositories can still influence the overall judgment.

DIMENSIONS:
1. CODE QUALITY (0-20): readability, naming, modularity, correctness signals, defensive coding, testing signal
2. PROJECT COMPLEXITY (0-20): architecture, APIs, databases, infrastructure, CI/CD, deployment, integrations
3. DOCUMENTATION (0-20): README quality, setup clarity, architecture notes, examples, inline explanation
4. CONSISTENCY & ACTIVITY (0-20): maintenance habits, commit cadence, coding consistency, project hygiene
5. TECH RELEVANCE (0-20): alignment with "${targetRole}", modern stack, AI/LLM tooling where applicable

Respond ONLY with valid JSON using the required schema.`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAi(prompt: string, apiKey: string, maxRetries = 2): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert software engineer and portfolio evaluator. Be strict, evidence-grounded, and return only valid structured JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        response_format: ANALYSIS_RESPONSE_FORMAT,
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
      throw new Error('No response from OpenAI.');
    }

    return text;
  }

  throw new Error('OpenAI API: max retries exceeded');
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

function isValidEvidencePath(path: string): boolean {
  const trimmed = path.trim();
  return Boolean(trimmed) && (trimmed.includes('/') || /\.[a-z0-9]+$/i.test(trimmed));
}

function ensureEvidenceCitation(finding: string): string {
  const trimmed = finding.trim();
  if (!trimmed) {
    return 'Finding unavailable (evidence: insufficient evidence)';
  }

  const evidenceMatches = [...trimmed.matchAll(ALL_EVIDENCE_CITATIONS_PATTERN)];
  const explicitEvidence = evidenceMatches
    .flatMap((match) => match[1].split(',').map((path) => path.trim()))
    .filter(isValidEvidencePath)
    .slice(0, 4);
  const statement = trimmed
    .replace(ALL_EVIDENCE_CITATIONS_PATTERN, '')
    .replace(/[. ]+$/, '')
    .trim();

  if (!statement) {
    return 'Finding unavailable (evidence: insufficient evidence)';
  }

  if (explicitEvidence.length) {
    return `${statement} (evidence: ${explicitEvidence.join(', ')})`;
  }

  return `${statement} (evidence: insufficient evidence)`;
}

function extractEvidencePaths(finding: string): string[] {
  return [...finding.matchAll(ALL_EVIDENCE_CITATIONS_PATTERN)]
    .flatMap((match) => match[1].split(',').map((path) => path.trim()))
    .filter(isValidEvidencePath)
    .slice(0, 4);
}

function hasSignalEvidence(
  evidencePaths: string[],
  signal: { evidencePaths: string[] }
): boolean {
  if (!evidencePaths.length || !signal.evidencePaths.length) {
    return false;
  }

  return evidencePaths.some((path) => signal.evidencePaths.includes(path));
}

function buildSignalFinding(label: string, signal: { evidencePaths: string[] }): string {
  if (!signal.evidencePaths.length) {
    return `${label} could not be verified from inspected files (evidence: insufficient evidence)`;
  }

  return `${label} was detected in inspected files (evidence: ${signal.evidencePaths.join(', ')})`;
}

function applySignalGuardrails(findings: string[], repo: RepoData): string[] {
  return findings.map((finding) => {
    const normalized = ensureEvidenceCitation(finding);
    const evidencePaths = extractEvidencePaths(normalized);
    const mentionsTests = /\btests?\b|\bpytest\b|\bjest\b|\bvitest\b|\bplaywright\b|\bcypress\b/i.test(
      normalized
    );
    const mentionsApi = /\bapi\b|\bapis\b|\broute handlers?\b|\baxios\b|\bfetch\b|\bhttpx\b/i.test(
      normalized
    );
    const mentionsDatabase = /\bdatabase\b|\bpostgres\b|\bmysql\b|\bsqlite\b|\bmongo\b|\bmongodb\b|\bprisma\b|\bsupabase\b|\bfirebase\b/i.test(
      normalized
    );
    const mentionsDocker = /\bdocker\b|\bcontainer\b|\bcontainerization\b/i.test(normalized);
    const mentionsCi = /\bci\b|\bcd\b|\bgithub actions\b|\bworkflow\b|\bautomation\b/i.test(normalized);
    const mentionsAi = /\bai\b|\bllm\b|\bopenai\b|\bgemini\b|\banthropic\b|\blangchain\b|\bembedding\b|\bvector\b|\brag\b|\bagent\b/i.test(
      normalized
    );

    if (/\bcommits?\b/i.test(normalized)) {
      return 'Repository activity was inferred from commit history, so file-grounded evidence is limited (evidence: insufficient evidence)';
    }

    if (mentionsTests) {
      if (hasSignalEvidence(evidencePaths, repo.signals.tests)) {
        return normalized;
      }

      return repo.signals.tests.present
        ? buildSignalFinding('Automated test assets', repo.signals.tests)
        : 'Automated test coverage could not be verified from inspected files (evidence: insufficient evidence)';
    }

    if (mentionsApi) {
      if (hasSignalEvidence(evidencePaths, repo.signals.apiUsage)) {
        return normalized;
      }

      return repo.signals.apiUsage.present
        ? buildSignalFinding('API usage', repo.signals.apiUsage)
        : 'API usage could not be verified from inspected files (evidence: insufficient evidence)';
    }

    if (mentionsDatabase) {
      if (hasSignalEvidence(evidencePaths, repo.signals.database)) {
        return normalized;
      }

      if (mentionsAi && repo.signals.ai.present) {
        return buildSignalFinding('AI or LLM integration', repo.signals.ai);
      }

      if (mentionsApi && repo.signals.apiUsage.present) {
        return buildSignalFinding('API usage', repo.signals.apiUsage);
      }

      return repo.signals.database.present
        ? buildSignalFinding('Database usage', repo.signals.database)
        : 'Database usage could not be verified from inspected files (evidence: insufficient evidence)';
    }

    if (mentionsDocker) {
      if (hasSignalEvidence(evidencePaths, repo.signals.docker)) {
        return normalized;
      }

      return repo.signals.docker.present
        ? buildSignalFinding('Containerization assets', repo.signals.docker)
        : 'Containerization evidence could not be verified from inspected files (evidence: insufficient evidence)';
    }

    if (mentionsCi) {
      if (hasSignalEvidence(evidencePaths, repo.signals.ci)) {
        return normalized;
      }

      return repo.signals.ci.present
        ? buildSignalFinding('CI/CD automation', repo.signals.ci)
        : 'CI/CD automation could not be verified from inspected files (evidence: insufficient evidence)';
    }

    if (mentionsAi) {
      if (hasSignalEvidence(evidencePaths, repo.signals.ai)) {
        return normalized;
      }

      return repo.signals.ai.present
        ? buildSignalFinding('AI or LLM integration', repo.signals.ai)
        : 'AI or LLM integration could not be verified from inspected files (evidence: insufficient evidence)';
    }

    if (
      /external apis? or databases?/i.test(normalized) &&
      (repo.signals.apiUsage.present || repo.signals.database.present)
    ) {
      if (
        hasSignalEvidence(evidencePaths, repo.signals.apiUsage) ||
        hasSignalEvidence(evidencePaths, repo.signals.database)
      ) {
        return normalized;
      }

      return `API or database integration evidence was detected in inspected files (evidence: ${[
        ...repo.signals.apiUsage.evidencePaths,
        ...repo.signals.database.evidencePaths,
      ]
        .filter(Boolean)
        .slice(0, 4)
        .join(', ')})`;
    }

    return normalized;
  });
}

function fallbackFindingsForRepo(repo: RepoData): string[] {
  const candidateFindings = [
    repo.signals.ai.present ? buildSignalFinding('AI or LLM integration', repo.signals.ai) : null,
    repo.signals.apiUsage.present ? buildSignalFinding('API usage', repo.signals.apiUsage) : null,
    repo.signals.tests.present ? buildSignalFinding('Automated test assets', repo.signals.tests) : null,
    repo.signals.database.present ? buildSignalFinding('Database usage', repo.signals.database) : null,
    repo.signals.ci.present ? buildSignalFinding('CI/CD automation', repo.signals.ci) : null,
    repo.signals.docker.present ? buildSignalFinding('Containerization assets', repo.signals.docker) : null,
  ].filter((finding): finding is string => Boolean(finding));

  return candidateFindings.length
    ? candidateFindings.slice(0, 2)
    : ['Inspected files did not provide enough grounded evidence for a stronger finding (evidence: insufficient evidence)'];
}

function sanitizeSuggestions(suggestions: string[] | undefined, fallback: string): string[] {
  const sanitized = (suggestions || [])
    .map((suggestion) => suggestion.trim())
    .filter(Boolean)
    .slice(0, 2);

  return sanitized.length ? sanitized : [fallback];
}

function sanitizeDimensionScore(
  dimension: RawDimensionScore | undefined,
  repo: RepoData,
  fallbackSuggestion: string
): DimensionScore {
  const score = Math.max(0, Math.min(20, Math.round(dimension?.score ?? 10)));
  const findings = applySignalGuardrails(
    (dimension?.findings || []).map(ensureEvidenceCitation),
    repo
  );
  const normalizedFindings = findings.length ? findings.slice(0, 3) : fallbackFindingsForRepo(repo);

  return {
    score,
    maxScore: 20,
    findings: normalizedFindings,
    suggestions: sanitizeSuggestions(dimension?.suggestions, fallbackSuggestion),
  };
}

function buildFallbackRepoAnalysis(repo: RepoData): RepoAnalysis {
  const codeQuality = sanitizeDimensionScore(undefined, repo, 'Inspect naming, error handling, and test coverage in more depth.');
  const projectComplexity = sanitizeDimensionScore(undefined, repo, 'Document architecture, integrations, and deployment assets more clearly.');
  const documentation = {
    score: repo.readme ? 12 : 8,
    maxScore: 20,
    findings: [
      repo.readme
        ? 'README content was available for inspection (evidence: README.md)'
        : 'Documentation depth could not be verified from inspected files (evidence: insufficient evidence)',
    ],
    suggestions: [
      repo.readme
        ? 'Expand the README with setup steps, architecture notes, and usage examples.'
        : 'Add a README with setup steps, architecture notes, and usage examples.',
    ],
  };
  const consistency = sanitizeDimensionScore(undefined, repo, 'Improve project hygiene with clearer commit conventions and automated checks.');
  const techRelevance = sanitizeDimensionScore(undefined, repo, 'Highlight the most role-relevant technologies and workflows more explicitly.');

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
      'Repository was inspected, but the model did not return a complete structured breakdown.',
  };
}

function average(getter: (repo: RepoAnalysis) => number, repoAnalyses: RepoAnalysis[]): number {
  return Math.round(
    repoAnalyses.reduce((sum, repo) => sum + getter(repo), 0) / Math.max(repoAnalyses.length, 1)
  );
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
  if (onProgress) {
    onProgress(1, 1, 'Deep Portfolio Analysis');
  }

  const prompt = buildBatchedPrompt(
    repos,
    targetRole,
    username,
    totalRepos,
    portfolioCatalog
  );
  const responseText = await callOpenAi(prompt, apiKey);

  const parsed = parseJSON<{
    repoAnalyses: {
      repoName: string;
      codeQuality: RawDimensionScore;
      projectComplexity: RawDimensionScore;
      documentation: RawDimensionScore;
      consistency: RawDimensionScore;
      techRelevance: RawDimensionScore;
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

  const parsedByName = new Map(
    parsed.repoAnalyses.map((repoAnalysis) => [
      normalizeRepoName(repoAnalysis.repoName),
      repoAnalysis,
    ])
  );

  const repoAnalyses: RepoAnalysis[] = repos.map((repo) => {
    const parsedRepo = parsedByName.get(normalizeRepoName(repo.repo.name));

    if (!parsedRepo) {
      return buildFallbackRepoAnalysis(repo);
    }

    const codeQuality = sanitizeDimensionScore(
      parsedRepo.codeQuality,
      repo,
      'Improve naming consistency, test depth, and defensive code paths.'
    );
    const projectComplexity = sanitizeDimensionScore(
      parsedRepo.projectComplexity,
      repo,
      'Document and strengthen APIs, infrastructure, and integration boundaries.'
    );
    const documentation = sanitizeDimensionScore(
      parsedRepo.documentation,
      repo,
      'Strengthen setup steps, architecture notes, and concrete usage examples.'
    );
    const consistency = sanitizeDimensionScore(
      parsedRepo.consistency,
      repo,
      'Tighten project hygiene with better automation, commit discipline, and consistency checks.'
    );
    const techRelevance = sanitizeDimensionScore(
      parsedRepo.techRelevance,
      repo,
      'Make the role-relevant stack and problem framing more explicit.'
    );

    const overallRepoScore =
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
      overallRepoScore: Math.max(0, Math.min(100, overallRepoScore)),
      summary: parsedRepo.summary || repo.repo.description || 'Analysis complete.',
    };
  });

  const dimensions = {
    codeQuality: {
      score: average((repo) => repo.codeQuality.score, repoAnalyses),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.codeQuality.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.codeQuality.suggestions).slice(0, 3),
    },
    projectComplexity: {
      score: average((repo) => repo.projectComplexity.score, repoAnalyses),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.projectComplexity.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.projectComplexity.suggestions).slice(0, 3),
    },
    documentation: {
      score: average((repo) => repo.documentation.score, repoAnalyses),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.documentation.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.documentation.suggestions).slice(0, 3),
    },
    consistency: {
      score: average((repo) => repo.consistency.score, repoAnalyses),
      maxScore: 20,
      findings: repoAnalyses.flatMap((repo) => repo.consistency.findings).slice(0, 5),
      suggestions: repoAnalyses.flatMap((repo) => repo.consistency.suggestions).slice(0, 3),
    },
    techRelevance: {
      score: average((repo) => repo.techRelevance.score, repoAnalyses),
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
