// GitHub API Client
// Builds evidence-rich repository snapshots for grounded portfolio analysis.

interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  default_branch: string;
  topics: string[];
  has_issues: boolean;
  archived: boolean;
  fork: boolean;
  license: { name: string } | null;
}

interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  content?: string;
  encoding?: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

export interface RepoFileSnippet {
  path: string;
  content: string;
}

export interface EvidenceFile extends RepoFileSnippet {
  kind: 'manifest' | 'workflow' | 'infra' | 'schema' | 'test' | 'config';
}

export interface DeterministicSignal {
  present: boolean;
  summary: string;
  evidencePaths: string[];
}

export interface RepoSignals {
  tests: DeterministicSignal;
  apiUsage: DeterministicSignal;
  docker: DeterministicSignal;
  ci: DeterministicSignal;
  database: DeterministicSignal;
  ai: DeterministicSignal;
  detectedTechnologies: string[];
}

export interface RepoData {
  repo: GitHubRepo;
  readme: string | null;
  fileTree: string[];
  sampleFiles: RepoFileSnippet[];
  evidenceFiles: EvidenceFile[];
  recentCommits: GitHubCommit[];
  languages: Record<string, number>;
  signals: RepoSignals;
}

export interface PortfolioRepoSummary {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
  size: number;
  topics: string[];
}

export interface GitHubProfileData {
  user: GitHubUser;
  repos: RepoData[];
  totalRepos: number;
  portfolioCatalog: PortfolioRepoSummary[];
  contributionStats: {
    totalCommitsLastYear: number;
    mostActiveDay: string;
  };
}

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_DEEP_REPOS = 6;
const MAX_CODE_SAMPLE_FILES = 6;
const MAX_EVIDENCE_FILES = 8;
const MAX_FILE_TREE_ITEMS = 1200;
const MAX_SAMPLE_FILE_CHARS = 5000;
const MAX_EVIDENCE_FILE_CHARS = 2500;
const MIN_ROLE_MATCHED_REPOS = 3;

const ROLE_STOPWORDS = new Set([
  'developer',
  'engineer',
  'software',
  'application',
  'applications',
  'specialist',
  'lead',
  'senior',
  'junior',
  'associate',
]);

const ROLE_SIGNAL_MAP: Record<string, string[]> = {
  frontend: ['frontend', 'react', 'next', 'javascript', 'typescript', 'ui', 'css', 'tailwind', 'web'],
  backend: ['backend', 'node', 'express', 'nestjs', 'api', 'server', 'database', 'postgres', 'mongodb', 'auth'],
  fullstack: ['fullstack', 'full', 'frontend', 'backend', 'react', 'next', 'node', 'api', 'database', 'typescript'],
  data: ['data', 'python', 'pandas', 'numpy', 'ml', 'machine', 'learning', 'analytics', 'ai', 'jupyter'],
  mobile: ['mobile', 'android', 'ios', 'react-native', 'flutter', 'swift', 'kotlin'],
  devops: ['devops', 'docker', 'kubernetes', 'terraform', 'aws', 'ci', 'cd', 'infra', 'deployment'],
  genai: ['ai', 'llm', 'agent', 'rag', 'prompt', 'embedding', 'vector', 'langchain', 'openai', 'gemini', 'anthropic', 'inference', 'transformer', 'python'],
};

const CODE_PRIORITY_PATTERNS = [
  /^src\//,
  /^app\//,
  /^lib\//,
  /^server\//,
  /^api\//,
  /^pages\//,
  /^components\//,
  /^backend\//,
  /^frontend\//,
  /^agents?\//,
  /^services?\//,
];

const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs',
  '.rb', '.php', '.cs', '.cpp', '.c', '.swift', '.kt',
];

const CODE_KEYWORD_PATTERNS = [
  /agent/i,
  /assistant/i,
  /prompt/i,
  /vector/i,
  /embed/i,
  /rag/i,
  /api/i,
  /route/i,
  /server/i,
  /model/i,
  /tool/i,
  /worker/i,
  /planner/i,
  /service/i,
  /db/i,
];

const MANIFEST_PATTERNS = [
  /^package\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^requirements[^/]*\.txt$/,
  /^pyproject\.toml$/,
  /^Pipfile$/,
  /^poetry\.lock$/,
  /^environment\.ya?ml$/,
  /^go\.mod$/,
  /^Cargo\.toml$/,
  /^pom\.xml$/,
  /^build\.gradle(\.kts)?$/,
  /^Gemfile$/,
  /^composer\.json$/,
];

const WORKFLOW_PATTERNS = [
  /^\.github\/workflows\/.+\.(yml|yaml)$/,
  /^\.gitlab-ci\.yml$/,
  /^\.circleci\/config\.yml$/,
  /^Jenkinsfile$/,
];

const INFRA_EVIDENCE_PATTERNS = [
  /^Dockerfile$/,
  /^Dockerfile\./,
  /^Containerfile$/,
  /^docker-compose\.ya?ml$/,
  /^k8s\//,
  /^helm\//,
  /^terraform\//,
  /^infra\//,
  /^render\.ya?ml$/,
  /^vercel\.json$/,
];

const DOCKER_PATTERNS = [
  /^Dockerfile$/,
  /^Dockerfile\./,
  /^Containerfile$/,
  /^docker-compose\.ya?ml$/,
  /^k8s\//,
  /^helm\//,
];

const SCHEMA_PATTERNS = [
  /^prisma\/schema\.prisma$/,
  /schema\.sql$/i,
  /^db\//,
  /^migrations\//,
];

const TEST_FILE_PATTERNS = [
  /(^|\/)__tests__\//i,
  /(^|\/)tests?\//i,
  /\.test\./i,
  /\.spec\./i,
  /^conftest\.py$/i,
  /^pytest\.ini$/i,
  /^playwright\.config\./i,
  /^cypress\.config\./i,
  /^vitest\.config\./i,
  /^jest\.config\./i,
];

const API_PATH_PATTERNS = [
  /^app\/api\//,
  /^src\/app\/api\//,
  /^pages\/api\//,
  /^src\/pages\/api\//,
  /(^|\/)routes?\//,
  /(^|\/)controllers?\//,
  /(^|\/)server\//,
  /^src\/server\//,
];

const API_CONTENT_PATTERNS = [
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\bhttpx\b/,
  /\brequests\./,
  /\bNextRequest\b/,
  /\bNextResponse\b/,
  /\bAPIRouter\b/,
  /\brouter\.(get|post|put|delete|patch)\b/,
  /\bapp\.(get|post|put|delete|patch)\b/,
  /\bclient\.chat\.completions\b/,
];

const TEST_CONTENT_PATTERNS = [
  /\bdescribe\s*\(/,
  /\bit\s*\(/,
  /\btest\s*\(/,
  /\bexpect\s*\(/,
  /\bpytest\b/,
  /\bjest\b/,
  /\bvitest\b/,
  /\bplaywright\b/,
  /\bcypress\b/,
  /\bmocha\b/,
  /\bunittest\b/,
];

const DATABASE_CONTENT_PATTERNS = [
  /\bprisma\b/i,
  /\bmongoose\b/i,
  /\bmongodb\b/i,
  /\bpostgres\b/i,
  /\bmysql\b/i,
  /\bsqlite\b/i,
  /\bsupabase\b/i,
  /\bfirebase\b/i,
  /\bsequelize\b/i,
  /\bdrizzle\b/i,
  /\btypeorm\b/i,
  /\bsqlalchemy\b/i,
  /\bpsycopg\b/i,
  /\bpg\b/i,
];

const AI_CONTENT_PATTERNS = [
  /\bopenai\b/i,
  /\bgemini\b/i,
  /\banthropic\b/i,
  /\blangchain\b/i,
  /\bllamaindex\b/i,
  /\bollama\b/i,
  /\btransformers\b/i,
  /\bhuggingface\b/i,
  /\bembedding/i,
  /\bvector\b/i,
  /\brag\b/i,
  /\bprompt\b/i,
  /\bqdrant\b/i,
  /\bpinecone\b/i,
  /\bchroma\b/i,
  /\bfaiss\b/i,
];

const TECHNOLOGY_MARKERS = [
  { label: 'Next.js', patterns: [/\bnext\b/i, /next\/server/i, /^app\//i] },
  { label: 'React', patterns: [/\breact\b/i, /\.tsx?$/i] },
  { label: 'TypeScript', patterns: [/\btypescript\b/i, /\.tsx?$/i] },
  { label: 'Tailwind CSS', patterns: [/\btailwindcss\b/i] },
  { label: 'OpenAI', patterns: [/\bopenai\b/i] },
  { label: 'Gemini', patterns: [/\bgemini\b/i, /generativelanguage/i, /GoogleGenerativeAI/i] },
  { label: 'Anthropic', patterns: [/\banthropic\b/i] },
  { label: 'LangChain', patterns: [/\blangchain\b/i] },
  { label: 'LlamaIndex', patterns: [/\bllamaindex\b/i] },
  { label: 'Python', patterns: [/\.py$/i, /\bpython\b/i] },
  { label: 'FastAPI', patterns: [/\bfastapi\b/i] },
  { label: 'Flask', patterns: [/\bflask\b/i] },
  { label: 'Express', patterns: [/\bexpress\b/i] },
  { label: 'NestJS', patterns: [/\bnestjs\b/i] },
  { label: 'Prisma', patterns: [/\bprisma\b/i] },
  { label: 'PostgreSQL', patterns: [/\bpostgres\b/i, /\bpg\b/i] },
  { label: 'MongoDB', patterns: [/\bmongodb\b/i, /\bmongoose\b/i] },
  { label: 'Supabase', patterns: [/\bsupabase\b/i] },
  { label: 'Firebase', patterns: [/\bfirebase\b/i] },
  { label: 'Docker', patterns: [/Dockerfile/i, /\bdocker\b/i] },
  { label: 'GitHub Actions', patterns: [/\.github\/workflows\//i] },
  { label: 'Playwright', patterns: [/\bplaywright\b/i] },
  { label: 'Vitest', patterns: [/\bvitest\b/i] },
  { label: 'Jest', patterns: [/\bjest\b/i] },
  { label: 'Pytest', patterns: [/\bpytest\b/i] },
  { label: 'Electron', patterns: [/\belectron\b/i] },
  { label: 'Qdrant', patterns: [/\bqdrant\b/i] },
  { label: 'Pinecone', patterns: [/\bpinecone\b/i] },
  { label: 'Chroma', patterns: [/\bchroma\b/i] },
  { label: 'Transformers', patterns: [/\btransformers\b/i] },
];

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function getHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Portfolio-Evaluator-Agent',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchGitHub<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: getHeaders(token),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`GitHub resource not found: ${path}`);
    }

    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please provide a GitHub token.');
    }

    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function isProbablyTextContent(content: string): boolean {
  return !content.includes('\u0000');
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token?: string
): Promise<string | null> {
  try {
    const data = await fetchGitHub<GitHubContent>(
      `/repos/${owner}/${repo}/contents/${path}`,
      token
    );

    if (data.content && data.encoding === 'base64') {
      const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
      return isProbablyTextContent(decoded) ? decoded : null;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchReadmeContent(
  owner: string,
  repo: string,
  token?: string
): Promise<string | null> {
  const readmeCandidates = ['README.md', 'readme.md', 'README.MD', 'README', 'README.txt'];

  for (const candidate of readmeCandidates) {
    const content = await fetchFileContent(owner, repo, candidate, token);
    if (content) {
      return content;
    }
  }

  return null;
}

async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<string[]> {
  try {
    const data = await fetchGitHub<{
      tree: { path: string; type: string }[];
    }>(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token);

    return data.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path)
      .slice(0, MAX_FILE_TREE_ITEMS);
  } catch {
    return [];
  }
}

function getRoleSignals(targetRole: string): string[] {
  const loweredRole = targetRole.toLowerCase();
  const signals = new Set(
    loweredRole
      .split(/[^a-z0-9+#.]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !ROLE_STOPWORDS.has(token))
  );

  if (loweredRole.includes('front')) {
    ROLE_SIGNAL_MAP.frontend.forEach((signal) => signals.add(signal));
  }

  if (loweredRole.includes('back')) {
    ROLE_SIGNAL_MAP.backend.forEach((signal) => signals.add(signal));
  }

  if (loweredRole.includes('full')) {
    ROLE_SIGNAL_MAP.fullstack.forEach((signal) => signals.add(signal));
  }

  if (loweredRole.includes('data') || loweredRole.includes('ml') || loweredRole.includes('ai')) {
    ROLE_SIGNAL_MAP.data.forEach((signal) => signals.add(signal));
  }

  if (loweredRole.includes('mobile') || loweredRole.includes('android') || loweredRole.includes('ios')) {
    ROLE_SIGNAL_MAP.mobile.forEach((signal) => signals.add(signal));
  }

  if (loweredRole.includes('devops') || loweredRole.includes('platform') || loweredRole.includes('infra')) {
    ROLE_SIGNAL_MAP.devops.forEach((signal) => signals.add(signal));
  }

  if (
    loweredRole.includes('gen ai') ||
    loweredRole.includes('generative') ||
    loweredRole.includes('llm') ||
    loweredRole.includes('agent')
  ) {
    ROLE_SIGNAL_MAP.genai.forEach((signal) => signals.add(signal));
  }

  return Array.from(signals);
}

function getRoleMatchScore(repo: GitHubRepo, roleSignals: string[]): number {
  if (!roleSignals.length) {
    return 0;
  }

  const haystack = [
    repo.name,
    repo.description || '',
    repo.language || '',
    repo.topics.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  return roleSignals.reduce(
    (score, signal) => score + (haystack.includes(signal) ? 1 : 0),
    0
  );
}

function selectReposForAnalysis(repos: GitHubRepo[], targetRole: string): GitHubRepo[] {
  const roleSignals = getRoleSignals(targetRole);
  const rankedRepos = repos
    .map((repo, index) => {
      const recencyScore = Math.max(0, 24 - index * 1.75);
      const starScore = Math.min(repo.stargazers_count * 4, 24);
      const forkScore = Math.min(repo.forks_count * 2, 12);
      const sizeScore = Math.min(Math.log10(Math.max(repo.size, 1)) * 8, 16);
      const metadataScore =
        (repo.description ? 4 : 0) +
        Math.min(repo.topics.length * 2, 10) +
        (repo.license ? 2 : 0) +
        (repo.has_issues ? 2 : 0);
      const roleMatchScore = getRoleMatchScore(repo, roleSignals);
      const roleScore = roleMatchScore * 6;

      return {
        repo,
        roleMatchScore,
        score: recencyScore + starScore + forkScore + sizeScore + metadataScore + roleScore,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.repo.pushed_at).getTime() - new Date(a.repo.pushed_at).getTime()
    );

  if (!roleSignals.length) {
    return rankedRepos.slice(0, MAX_DEEP_REPOS).map(({ repo }) => repo);
  }

  const roleMatchedRepos = rankedRepos.filter((repo) => repo.roleMatchScore > 0);

  if (roleMatchedRepos.length >= MIN_ROLE_MATCHED_REPOS) {
    return roleMatchedRepos.slice(0, MAX_DEEP_REPOS).map(({ repo }) => repo);
  }

  return rankedRepos.slice(0, MAX_DEEP_REPOS).map(({ repo }) => repo);
}

function selectCodeSampleFiles(
  files: string[],
  language: string | null,
  targetRole: string
): string[] {
  const roleSignals = getRoleSignals(targetRole);
  const codeFiles = files.filter((file) =>
    CODE_EXTENSIONS.some((extension) => file.endsWith(extension))
  );

  const scoredFiles = codeFiles
    .filter((file) => !file.endsWith('.d.ts') && !file.endsWith('.min.js'))
    .map((file) => {
      let score = 0;

      if (CODE_PRIORITY_PATTERNS.some((pattern) => pattern.test(file))) score += 12;
      if (CODE_KEYWORD_PATTERNS.some((pattern) => pattern.test(file))) score += 8;
      if (file.includes('test') || file.includes('spec')) score += 6;
      if (file.includes('index') || file.includes('main') || file.includes('app')) score += 3;
      if (roleSignals.some((signal) => file.toLowerCase().includes(signal))) score += 6;

      if (language) {
        const languageExtensions: Record<string, string[]> = {
          TypeScript: ['.ts', '.tsx'],
          JavaScript: ['.js', '.jsx'],
          Python: ['.py'],
          Java: ['.java'],
          Go: ['.go'],
          Rust: ['.rs'],
        };

        const extensions = languageExtensions[language] || [];
        if (extensions.some((extension) => file.endsWith(extension))) score += 3;
      }

      return { path: file, score };
    });

  return scoredFiles
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CODE_SAMPLE_FILES)
    .map((item) => item.path);
}

function getEvidenceKind(path: string): EvidenceFile['kind'] | null {
  if (matchesAny(path, WORKFLOW_PATTERNS)) return 'workflow';
  if (matchesAny(path, INFRA_EVIDENCE_PATTERNS)) return 'infra';
  if (matchesAny(path, SCHEMA_PATTERNS)) return 'schema';
  if (matchesAny(path, TEST_FILE_PATTERNS)) return 'test';
  if (matchesAny(path, MANIFEST_PATTERNS)) return 'manifest';
  if (path === '.env.example' || path === '.env.sample' || path === 'tsconfig.json') return 'config';
  return null;
}

function selectEvidenceFiles(files: string[], excludedPaths: string[]): { path: string; kind: EvidenceFile['kind'] }[] {
  const excluded = new Set(excludedPaths);

  return files
    .filter((file) => !excluded.has(file))
    .map((file) => {
      const kind = getEvidenceKind(file);
      if (!kind) {
        return null;
      }

      const kindScore =
        kind === 'manifest'
          ? 24
          : kind === 'workflow'
            ? 22
            : kind === 'infra'
              ? 21
              : kind === 'schema'
                ? 20
                : kind === 'test'
                  ? 19
                  : 16;

      return { path: file, kind, score: kindScore };
    })
    .filter((file): file is { path: string; kind: EvidenceFile['kind']; score: number } => Boolean(file))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVIDENCE_FILES)
    .map(({ path, kind }) => ({ path, kind }));
}

async function loadRepoFiles(
  owner: string,
  repo: string,
  fileSpecs: { path: string; kind?: EvidenceFile['kind'] }[],
  token: string | undefined,
  maxChars: number
): Promise<Array<{ path: string; content: string; kind: EvidenceFile['kind'] | undefined }>> {
  const loadedFiles = await Promise.all(
    fileSpecs.map(async (fileSpec) => {
      const content = await fetchFileContent(owner, repo, fileSpec.path, token);
      if (!content) {
        return null;
      }

      return {
        path: fileSpec.path,
        content: content.substring(0, maxChars),
        kind: fileSpec.kind,
      };
    })
  );

  const compactFiles = loadedFiles.filter((file) => file !== null) as Array<{
    path: string;
    content: string;
    kind: EvidenceFile['kind'] | undefined;
  }>;

  return compactFiles;
}

function collectPathMatches(files: string[], patterns: RegExp[]): string[] {
  return unique(files.filter((file) => matchesAny(file, patterns))).slice(0, 4);
}

function collectContentMatches(files: RepoFileSnippet[], patterns: RegExp[]): string[] {
  return unique(
    files
      .filter((file) => patterns.some((pattern) => pattern.test(file.content)))
      .map((file) => file.path)
  ).slice(0, 4);
}

function isTestEvidenceFile(path: string): boolean {
  return (
    matchesAny(path, TEST_FILE_PATTERNS) ||
    matchesAny(path, MANIFEST_PATTERNS) ||
    path === 'package-lock.json' ||
    path === 'yarn.lock'
  );
}

function buildSignal(label: string, evidencePaths: string[]): DeterministicSignal {
  if (!evidencePaths.length) {
    return {
      present: false,
      summary: `Insufficient evidence of ${label.toLowerCase()} in inspected files.`,
      evidencePaths: [],
    };
  }

  return {
    present: true,
    summary: `${label} detected in ${evidencePaths.join(', ')}.`,
    evidencePaths,
  };
}

function detectTechnologies(
  fileTree: string[],
  inspectedFiles: RepoFileSnippet[],
  language: string | null
): string[] {
  const corpus = [
    ...fileTree,
    ...inspectedFiles.map((file) => `${file.path}\n${file.content}`),
    language || '',
  ].join('\n');

  const technologies = TECHNOLOGY_MARKERS
    .filter((marker) => marker.patterns.some((pattern) => pattern.test(corpus)))
    .map((marker) => marker.label);

  return unique([language, ...technologies].filter(Boolean) as string[]).slice(0, 12);
}

function buildRepoSignals(
  fileTree: string[],
  sampleFiles: RepoFileSnippet[],
  evidenceFiles: EvidenceFile[],
  language: string | null
): RepoSignals {
  const inspectedFiles = [...sampleFiles, ...evidenceFiles];
  const testInspectableFiles = inspectedFiles.filter((file) => isTestEvidenceFile(file.path));

  const tests = buildSignal('Tests', unique([
    ...collectPathMatches(fileTree, TEST_FILE_PATTERNS),
    ...collectContentMatches(testInspectableFiles, TEST_CONTENT_PATTERNS),
  ]));

  const apiUsage = buildSignal('API usage', unique([
    ...collectPathMatches(fileTree, API_PATH_PATTERNS),
    ...collectContentMatches(inspectedFiles, API_CONTENT_PATTERNS),
  ]));

  const docker = buildSignal('Docker or containerization', collectPathMatches(fileTree, DOCKER_PATTERNS));
  const ci = buildSignal('CI/CD automation', collectPathMatches(fileTree, WORKFLOW_PATTERNS));

  const database = buildSignal('Database usage', unique([
    ...collectPathMatches(fileTree, SCHEMA_PATTERNS),
    ...collectContentMatches(inspectedFiles, DATABASE_CONTENT_PATTERNS),
  ]));

  const ai = buildSignal('AI or LLM integration', collectContentMatches(inspectedFiles, AI_CONTENT_PATTERNS));

  return {
    tests,
    apiUsage,
    docker,
    ci,
    database,
    ai,
    detectedTechnologies: detectTechnologies(fileTree, inspectedFiles, language),
  };
}

function toPortfolioRepoSummary(repo: GitHubRepo): PortfolioRepoSummary {
  return {
    name: repo.name,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    pushedAt: repo.pushed_at,
    size: repo.size,
    topics: repo.topics,
  };
}

export async function fetchGitHubProfile(
  username: string,
  token?: string,
  targetRole = 'Software Developer'
): Promise<GitHubProfileData> {
  const user = await fetchGitHub<GitHubUser>(`/users/${username}`, token);

  const allRepos = await fetchGitHub<GitHubRepo[]>(
    `/users/${username}/repos?sort=pushed&direction=desc&per_page=100&type=owner`,
    token
  );

  const filteredRepos = allRepos.filter((repo) => !repo.fork && !repo.archived);
  const portfolioCatalog = filteredRepos.map(toPortfolioRepoSummary);
  const reposToAnalyze = selectReposForAnalysis(filteredRepos, targetRole);

  const repoDataPromises = reposToAnalyze.map(async (repo): Promise<RepoData> => {
    const [readme, fileTree, recentCommits, languages] = await Promise.all([
      fetchReadmeContent(username, repo.name, token),
      fetchRepoTree(username, repo.name, repo.default_branch, token),
      fetchGitHub<GitHubCommit[]>(
        `/repos/${username}/${repo.name}/commits?per_page=30`,
        token
      ).catch(() => []),
      fetchGitHub<Record<string, number>>(
        `/repos/${username}/${repo.name}/languages`,
        token
      ).catch(() => ({})),
    ]);

    const sampleFilePaths = selectCodeSampleFiles(fileTree, repo.language, targetRole);
    const evidenceFileSpecs = selectEvidenceFiles(fileTree, sampleFilePaths);

    const [sampleFiles, loadedEvidenceFiles] = await Promise.all([
      loadRepoFiles(
        username,
        repo.name,
        sampleFilePaths.map((path) => ({ path })),
        token,
        MAX_SAMPLE_FILE_CHARS
      ),
      loadRepoFiles(username, repo.name, evidenceFileSpecs, token, MAX_EVIDENCE_FILE_CHARS),
    ]);

    const evidenceFiles: EvidenceFile[] = loadedEvidenceFiles
      .filter((file): file is EvidenceFile => Boolean(file.kind))
      .map((file) => ({
        path: file.path,
        content: file.content,
        kind: file.kind,
      }));

    const signals = buildRepoSignals(fileTree, sampleFiles, evidenceFiles, repo.language);

    return {
      repo,
      readme,
      fileTree,
      sampleFiles,
      evidenceFiles,
      recentCommits,
      languages,
      signals,
    };
  });

  const repos = await Promise.all(repoDataPromises);

  const allCommitDates = repos.flatMap((repo) =>
    repo.recentCommits.map((commit) => new Date(commit.commit.author.date))
  );
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts = new Array(7).fill(0);

  allCommitDates.forEach((date) => dayCounts[date.getDay()]++);

  const mostActiveDay =
    dayNames[dayCounts.indexOf(Math.max(...dayCounts))] || 'Insufficient evidence';

  return {
    user,
    repos,
    totalRepos: filteredRepos.length,
    portfolioCatalog,
    contributionStats: {
      totalCommitsLastYear: allCommitDates.length,
      mostActiveDay,
    },
  };
}
