// GitHub API Client
// Fetches user profile, repos, file trees, README, and sample code files

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

export interface GitHubProfileData {
  user: GitHubUser;
  repos: RepoData[];
  totalRepos: number;
  contributionStats: {
    totalCommitsLastYear: number;
    mostActiveDay: string;
  };
}

const GITHUB_API_BASE = 'https://api.github.com';

function getHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Portfolio-Evaluator-Agent',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
      .slice(0, 200); // Limit to 200 files for display
  } catch {
    return [];
  }
}

// Prioritize important code files for sampling
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
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    '.github/workflows', 'Makefile', 'Jenkinsfile',
    'jest.config', 'vitest.config', 'tsconfig.json',
    'package.json',
  ];

  const codeFiles = files.filter((f) =>
    codeExtensions.some((ext) => f.endsWith(ext))
  );

  // Score each file by priority
  const scored = codeFiles.map((f) => {
    let score = 0;
    if (priorityPatterns.some((p) => p.test(f))) score += 10;
    if (f.includes('test') || f.includes('spec')) score += 5; // Tests are valuable
    if (f.includes('index') || f.includes('main') || f.includes('app')) score += 3;
    // Prefer files matching the repo's primary language
    if (language) {
      const langExtMap: Record<string, string[]> = {
        TypeScript: ['.ts', '.tsx'],
        JavaScript: ['.js', '.jsx'],
        Python: ['.py'],
        Java: ['.java'],
        Go: ['.go'],
        Rust: ['.rs'],
      };
      const exts = langExtMap[language] || [];
      if (exts.some((ext) => f.endsWith(ext))) score += 2;
    }
    return { path: f, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Take top 5 code files + any config files found
  const selectedCode = scored.slice(0, 5).map((s) => s.path);
  const selectedConfig = files
    .filter((f) => configFiles.some((c) => f.includes(c)))
    .slice(0, 2);

  return [...new Set([...selectedCode, ...selectedConfig])].slice(0, 7);
}

export async function fetchGitHubProfile(
  username: string,
  token?: string
): Promise<GitHubProfileData> {
  // Fetch user profile
  const user = await fetchGitHub<GitHubUser>(`/users/${username}`, token);

  // Fetch repos (sorted by pushed_at for recency)
  const allRepos = await fetchGitHub<GitHubRepo[]>(
    `/users/${username}/repos?sort=pushed&direction=desc&per_page=100&type=owner`,
    token
  );

  // Filter out forks and archived repos
  const filteredRepos = allRepos.filter((r) => !r.fork && !r.archived);

  // Prioritize the user's specific testing repo
  filteredRepos.sort((a, b) => {
    if (a.name.toLowerCase() === 'unimonks-test-platform') return -1;
    if (b.name.toLowerCase() === 'unimonks-test-platform') return 1;
    return 0;
  });

  const reposToAnalyze = filteredRepos.slice(0, 5);

  // Fetch detailed data for each repo (in parallel, max 5 concurrent)
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

    // Sample key code files
    const filesToSample = selectSampleFiles(fileTree, repo.language);
    const sampleFiles: { path: string; content: string }[] = [];

    for (const filePath of filesToSample) {
      const content = await fetchFileContent(username, repo.name, filePath, token);
      if (content && content.length < 15000) {
        // Skip very large files
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

  // Basic contribution stats
  const allCommitDates = repos.flatMap((r) =>
    r.recentCommits.map((c) => new Date(c.commit.author.date))
  );
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts = new Array(7).fill(0);
  allCommitDates.forEach((d) => dayCounts[d.getDay()]++);
  const mostActiveDay = dayNames[dayCounts.indexOf(Math.max(...dayCounts))];

  return {
    user,
    repos,
    totalRepos: allRepos.length,
    contributionStats: {
      totalCommitsLastYear: allCommitDates.length,
      mostActiveDay,
    },
  };
}
