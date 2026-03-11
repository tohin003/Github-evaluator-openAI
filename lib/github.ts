// GitHub API Client
// Fetches profile data and selects representative repositories for deep analysis.

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

export interface RepoData {
  repo: GitHubRepo;
  readme: string | null;
  fileTree: string[];
  sampleFiles: { path: string; content: string }[];
  recentCommits: GitHubCommit[];
  languages: Record<string, number>;
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
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return null;
  } catch {
    return null;
  }
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
      .slice(0, 200);
  } catch {
    return [];
  }
}

function selectSampleFiles(files: string[], language: string | null): string[] {
  const priorityPatterns = [
    /^src\//,
    /^app\//,
    /^lib\//,
    /^server\//,
    /^api\//,
    /^pages\//,
    /^components\//,
  ];

  const codeExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs',
    '.rb', '.php', '.cs', '.cpp', '.c', '.swift', '.kt',
  ];

  const configFiles = [
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    '.github/workflows',
    'Makefile',
    'Jenkinsfile',
    'jest.config',
    'vitest.config',
    'tsconfig.json',
    'package.json',
  ];

  const codeFiles = files.filter((file) =>
    codeExtensions.some((extension) => file.endsWith(extension))
  );

  const scored = codeFiles.map((file) => {
    let score = 0;

    if (priorityPatterns.some((pattern) => pattern.test(file))) score += 10;
    if (file.includes('test') || file.includes('spec')) score += 5;
    if (file.includes('index') || file.includes('main') || file.includes('app')) score += 3;

    if (language) {
      const langExtMap: Record<string, string[]> = {
        TypeScript: ['.ts', '.tsx'],
        JavaScript: ['.js', '.jsx'],
        Python: ['.py'],
        Java: ['.java'],
        Go: ['.go'],
        Rust: ['.rs'],
      };

      const extensions = langExtMap[language] || [];
      if (extensions.some((extension) => file.endsWith(extension))) score += 2;
    }

    return { path: file, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selectedCode = scored.slice(0, 5).map((item) => item.path);
  const selectedConfig = files
    .filter((file) => configFiles.some((config) => file.includes(config)))
    .slice(0, 2);

  return [...new Set([...selectedCode, ...selectedConfig])].slice(0, 7);
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
      fetchFileContent(username, repo.name, 'README.md', token),
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

    const filesToSample = selectSampleFiles(fileTree, repo.language);
    const sampleFiles: { path: string; content: string }[] = [];

    for (const filePath of filesToSample) {
      const content = await fetchFileContent(username, repo.name, filePath, token);
      if (content && content.length < 15000) {
        sampleFiles.push({ path: filePath, content: content.substring(0, 8000) });
      }
    }

    return {
      repo,
      readme,
      fileTree,
      sampleFiles,
      recentCommits,
      languages,
    };
  });

  const repos = await Promise.all(repoDataPromises);

  const allCommitDates = repos.flatMap((repo) =>
    repo.recentCommits.map((commit) => new Date(commit.commit.author.date))
  );
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts = new Array(7).fill(0);

  allCommitDates.forEach((date) => dayCounts[date.getDay()]++);

  const mostActiveDay = dayNames[dayCounts.indexOf(Math.max(...dayCounts))];

  return {
    user,
    repos,
    totalRepos: allRepos.length,
    portfolioCatalog,
    contributionStats: {
      totalCommitsLastYear: allCommitDates.length,
      mostActiveDay,
    },
  };
}
