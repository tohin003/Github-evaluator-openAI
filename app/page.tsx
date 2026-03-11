'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Code2,
  FolderGit2,
  Github,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Zap,
} from 'lucide-react';

interface DimensionScore {
  score: number;
  maxScore: number;
  findings: string[];
  suggestions: string[];
}

interface RepoAnalysis {
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

interface AnalysisResult {
  user: {
    login: string;
    avatarUrl: string;
    name?: string | null;
    bio?: string | null;
    profileUrl?: string;
  };
  analysis: {
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
  };
  targetRole: string;
  analyzedAt: string;
}

const DIMENSION_KEYS = [
  'codeQuality',
  'projectComplexity',
  'documentation',
  'consistency',
  'techRelevance',
] as const;

type DimensionKey = (typeof DIMENSION_KEYS)[number];

const DIMENSION_META: Record<
  DimensionKey,
  {
    title: string;
    hint: string;
    icon: LucideIcon;
    accent: string;
    soft: string;
    border: string;
    track: string;
  }
> = {
  codeQuality: {
    title: 'Code Quality',
    hint: 'Architecture, readability, testing signal, and delivery discipline.',
    icon: Code2,
    accent: '#0f766e',
    soft: 'rgba(15, 118, 110, 0.12)',
    border: 'rgba(15, 118, 110, 0.18)',
    track: 'rgba(15, 118, 110, 0.18)',
  },
  projectComplexity: {
    title: 'Project Complexity',
    hint: 'Scope, systems thinking, integration depth, and technical ambition.',
    icon: Activity,
    accent: '#1d4f91',
    soft: 'rgba(29, 79, 145, 0.12)',
    border: 'rgba(29, 79, 145, 0.18)',
    track: 'rgba(29, 79, 145, 0.18)',
  },
  documentation: {
    title: 'Documentation',
    hint: 'README clarity, onboarding quality, and developer communication.',
    icon: BookOpenText,
    accent: '#9a6700',
    soft: 'rgba(154, 103, 0, 0.12)',
    border: 'rgba(154, 103, 0, 0.18)',
    track: 'rgba(154, 103, 0, 0.18)',
  },
  consistency: {
    title: 'Consistency',
    hint: 'Activity cadence, maintenance habits, and sustained portfolio care.',
    icon: ShieldCheck,
    accent: '#475569',
    soft: 'rgba(71, 85, 105, 0.12)',
    border: 'rgba(71, 85, 105, 0.18)',
    track: 'rgba(71, 85, 105, 0.18)',
  },
  techRelevance: {
    title: 'Tech Relevance',
    hint: 'Stack fit for the target role and evidence of modern tooling.',
    icon: Star,
    accent: '#c35a29',
    soft: 'rgba(195, 90, 41, 0.12)',
    border: 'rgba(195, 90, 41, 0.18)',
    track: 'rgba(195, 90, 41, 0.18)',
  },
};

const HERO_METRICS = [
  {
    icon: Target,
    value: '5',
    label: 'Weighted dimensions',
    description: 'Every review balances engineering craft, complexity, clarity, consistency, and role fit.',
  },
  {
    icon: Github,
    value: 'Up to 6',
    label: 'Representative repos',
    description: 'The analysis prefers role-relevant repositories and only falls back to general projects when the profile is sparse.',
  },
  {
    icon: Zap,
    value: '1',
    label: 'Action roadmap',
    description: 'The report closes with prioritized improvements you can act on immediately.',
  },
];

const REPORT_SECTIONS = [
  {
    title: 'Portfolio score',
    description: 'A single hiring-ready score backed by dimension-by-dimension evidence.',
  },
  {
    title: 'Repository drill-down',
    description: 'Expandable repository cards explain what pushed the score up or down.',
  },
  {
    title: 'Improvement priorities',
    description: 'The evaluator turns vague feedback into concrete next moves with clear impact.',
  },
];

const SAMPLE_PROFILES = [
  { username: 'tohin003', role: 'Software Engineer' },
  { username: 'shadcn', role: 'Frontend Engineer' },
];

function getScorePalette(score: number) {
  if (score >= 85) {
    return {
      accent: '#0f766e',
      soft: 'rgba(15, 118, 110, 0.12)',
      border: 'rgba(15, 118, 110, 0.2)',
      track: 'rgba(15, 118, 110, 0.28)',
    };
  }

  if (score >= 70) {
    return {
      accent: '#166534',
      soft: 'rgba(22, 101, 52, 0.12)',
      border: 'rgba(22, 101, 52, 0.2)',
      track: 'rgba(22, 101, 52, 0.28)',
    };
  }

  if (score >= 50) {
    return {
      accent: '#9a6700',
      soft: 'rgba(154, 103, 0, 0.12)',
      border: 'rgba(154, 103, 0, 0.2)',
      track: 'rgba(154, 103, 0, 0.28)',
    };
  }

  if (score >= 30) {
    return {
      accent: '#b45309',
      soft: 'rgba(180, 83, 9, 0.12)',
      border: 'rgba(180, 83, 9, 0.2)',
      track: 'rgba(180, 83, 9, 0.28)',
    };
  }

  return {
    accent: '#b42318',
    soft: 'rgba(180, 35, 24, 0.12)',
    border: 'rgba(180, 35, 24, 0.2)',
    track: 'rgba(180, 35, 24, 0.28)',
  };
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getPercent(score: number, maxScore: number) {
  if (!maxScore) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
}

function uniqueItems(items: string[]) {
  return items.filter((item, index) => item && items.indexOf(item) === index);
}

function collectRepoInsights(repo: RepoAnalysis, field: 'findings' | 'suggestions') {
  return uniqueItems(
    DIMENSION_KEYS.flatMap((key) => repo[key][field] || [])
  ).slice(0, 4);
}

function DimensionCard({
  dimension,
  scoreObj,
}: {
  dimension: DimensionKey;
  scoreObj: DimensionScore;
}) {
  const meta = DIMENSION_META[dimension];
  const Icon = meta.icon;
  const percent = getPercent(scoreObj.score, scoreObj.maxScore);

  return (
    <article className="panel h-full p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[18px] border"
            style={{ backgroundColor: meta.soft, borderColor: meta.border }}
          >
            <Icon size={20} style={{ color: meta.accent }} />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[color:var(--ink)]">{meta.title}</h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{meta.hint}</p>
        </div>

        <div
          className="rounded-[20px] border px-4 py-3 text-right"
          style={{ borderColor: meta.border, backgroundColor: 'rgba(255, 255, 255, 0.72)' }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
            Score
          </div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: meta.accent }}>
            {scoreObj.score}
          </div>
          <div className="text-xs text-[color:var(--muted)]">/ {scoreObj.maxScore}</div>
        </div>
      </div>

      <div className="mt-6 h-2 rounded-full" style={{ backgroundColor: meta.track }}>
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${meta.accent} 0%, ${meta.accent}cc 100%)`,
          }}
        />
      </div>

      <div className="mt-5 space-y-3">
        <div
          className="rounded-[22px] border p-4"
          style={{
            borderColor: 'rgba(19, 32, 51, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.72)',
          }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
            Observed
          </div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--ink)] [overflow-wrap:anywhere]">
            {scoreObj.findings[0] || 'No clear positive signal was returned for this dimension.'}
          </p>
        </div>

        <div
          className="rounded-[22px] border p-4"
          style={{
            borderColor: 'rgba(19, 32, 51, 0.08)',
            backgroundColor: 'rgba(255, 249, 242, 0.82)',
          }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
            Next move
          </div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--ink)] [overflow-wrap:anywhere]">
            {scoreObj.suggestions[0] || 'No immediate follow-up was recommended in the analysis.'}
          </p>
        </div>
      </div>
    </article>
  );
}

function InsightPanel({
  title,
  items,
  accent,
  soft,
  icon: Icon,
}: {
  title: string;
  items: string[];
  accent: string;
  soft: string;
  icon: LucideIcon;
}) {
  return (
    <article className="panel p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[16px] border"
          style={{ borderColor: `${accent}33`, backgroundColor: soft }}
        >
          <Icon size={18} style={{ color: accent }} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
            Snapshot
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[color:var(--ink)]">{title}</h3>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {(items.length ? items : ['The analysis did not return highlights for this section.']).map(
          (item, index) => (
            <li
              key={`${title}-${index}`}
              className="flex gap-3 rounded-[20px] border p-4 text-sm leading-6 text-[color:var(--ink)]"
              style={{
                borderColor: 'rgba(19, 32, 51, 0.08)',
                backgroundColor: 'rgba(255, 255, 255, 0.72)',
              }}
            >
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item}</span>
            </li>
          )
        )}
      </ul>
    </article>
  );
}

export default function HomePage() {
  const [usernameInput, setUsernameInput] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [statusText, setStatusText] = useState('');
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({});

  const canSubmit = Boolean(usernameInput.trim()) && !isLoading;

  const handleAnalyze = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!usernameInput.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setExpandedRepos({});
    setStatusText('Fetching repositories and reading the strongest portfolio signals.');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubUsername: usernameInput.trim(),
          targetRole: roleInput.trim() || 'Software Engineer',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed.');
      }

      const nextResult: AnalysisResult = data.data;
      const firstRepo = nextResult.analysis.repoAnalyses[0]?.repoName;

      setResult(nextResult);
      setExpandedRepos(firstRepo ? { [firstRepo]: true } : {});
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'An unexpected error occurred while analyzing this portfolio.'
      );
    } finally {
      setIsLoading(false);
      setStatusText('');
    }
  };

  const toggleRepo = (repoName: string) => {
    setExpandedRepos((current) => ({
      ...current,
      [repoName]: !current[repoName],
    }));
  };

  const overallPalette = getScorePalette(result?.analysis.overallScore ?? 0);
  const profileUrl = result?.user.profileUrl || `https://github.com/${result?.user.login ?? ''}`;
  const analyzedLabel = result ? formatDate(result.analyzedAt) : null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] overflow-hidden">
        <div
          className="absolute -left-24 top-0 h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: 'var(--wash-amber)' }}
        />
        <div
          className="absolute right-0 top-16 h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: 'var(--wash-teal)' }}
        />
      </div>

      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[rgba(248,244,238,0.78)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-[18px] border"
              style={{
                borderColor: 'rgba(195, 90, 41, 0.18)',
                backgroundColor: 'rgba(195, 90, 41, 0.1)',
              }}
            >
              <Sparkles size={19} style={{ color: '#c35a29' }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--muted)]">
                Candidate Intelligence
              </p>
              <h1 className="font-display text-lg font-semibold text-[color:var(--ink)]">
                GitHub Evaluator
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="surface-tag hidden sm:inline-flex">Hiring-ready portfolio review</span>
            {result ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noreferrer"
                className="surface-tag inline-flex items-center gap-2 hover:border-[rgba(195,90,41,0.24)] hover:text-[color:var(--ink)]"
              >
                Open profile
                <ArrowUpRight size={14} />
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-8 lg:pt-14">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
          <div className="motion-enter space-y-8">
            <div className="space-y-6">
              <span className="eyebrow">
                <BriefcaseBusiness size={14} />
                Portfolio Benchmarking
              </span>
              <div className="max-w-3xl space-y-5">
                <h2 className="section-title max-w-3xl text-balance">
                  Evaluate a GitHub portfolio with the polish of a hiring review panel.
                </h2>
                <p className="max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
                  This dashboard reads repository structure, code samples, documentation, and
                  activity patterns, then turns the signal into a portfolio score, repository
                  breakdowns, and a precise improvement roadmap.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {HERO_METRICS.map(({ icon: Icon, value, label, description }) => (
                <article key={label} className="panel panel-muted h-full p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-[16px] border"
                      style={{
                        borderColor: 'rgba(19, 32, 51, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.72)',
                      }}
                    >
                      <Icon size={18} style={{ color: '#1d4f91' }} />
                    </div>
                    <span className="font-display text-2xl font-semibold text-[color:var(--ink)]">
                      {value}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[color:var(--ink)]">{label}</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{description}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="panel motion-enter p-6 sm:p-8" style={{ animationDelay: '120ms' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Run Analysis
                </p>
                <h3 className="mt-3 font-display text-[1.65rem] font-semibold text-[color:var(--ink)]">
                  Review any public profile in one pass.
                </h3>
              </div>
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[18px] border"
                style={{
                  borderColor: 'rgba(29, 79, 145, 0.18)',
                  backgroundColor: 'rgba(29, 79, 145, 0.1)',
                }}
              >
                <Search size={18} style={{ color: '#1d4f91' }} />
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
              Enter a GitHub username and, optionally, the role you want the portfolio measured
              against.
            </p>

            <form onSubmit={handleAnalyze} className="mt-8 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--ink)]">GitHub username</span>
                <div className="relative">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
                  />
                  <input
                    className="field-input pl-11"
                    placeholder="e.g. tohin003"
                    value={usernameInput}
                    onChange={(event) => setUsernameInput(event.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--ink)]">Target role</span>
                <input
                  className="field-input"
                  placeholder="e.g. Frontend Engineer"
                  value={roleInput}
                  onChange={(event) => setRoleInput(event.target.value)}
                  disabled={isLoading}
                />
              </label>

              <button type="submit" disabled={!canSubmit} className="primary-button w-full">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {isLoading ? 'Reviewing portfolio' : 'Analyze portfolio'}
              </button>
            </form>

            <div className="mt-6 border-t border-[color:var(--line)] pt-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[color:var(--ink)]">Starter profiles</p>
                <span className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  Quick load
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {SAMPLE_PROFILES.map((sample) => (
                  <button
                    key={sample.username}
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setUsernameInput(sample.username);
                      setRoleInput(sample.role);
                    }}
                  >
                    <span>Load {sample.username}</span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {error ? (
          <div
            className="motion-enter mt-8 flex items-start gap-3 rounded-[24px] border px-5 py-4 text-sm"
            style={{
              borderColor: 'rgba(180, 35, 24, 0.18)',
              backgroundColor: 'rgba(180, 35, 24, 0.08)',
              color: '#8c1d18',
            }}
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {isLoading ? (
          <section className="panel motion-enter mt-10 flex flex-col items-center px-6 py-20 text-center sm:px-8">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: 'rgba(19, 32, 51, 0.08)' }}
              />
              <div
                className="absolute inset-2 rounded-full border-2 border-t-transparent"
                style={{
                  borderColor: 'rgba(195, 90, 41, 0.35)',
                  borderTopColor: 'transparent',
                  animation: 'spin 1.1s linear infinite',
                }}
              />
              <div
                className="absolute h-12 w-12 rounded-full blur-2xl"
                style={{ backgroundColor: 'rgba(195, 90, 41, 0.18)' }}
              />
              <Sparkles size={24} style={{ color: '#c35a29' }} />
            </div>

            <h3 className="mt-8 font-display text-3xl font-semibold text-[color:var(--ink)]">
              Reviewing repositories and ranking portfolio signal.
            </h3>
            <p className="mt-3 max-w-xl text-base leading-7 text-[color:var(--muted)]">
              {statusText || 'Pulling code samples, commit history, and documentation context.'}
            </p>
          </section>
        ) : result ? (
          <section className="mt-10 space-y-8">
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <article className="panel motion-enter p-6 sm:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Portfolio Score
                </p>

                <div className="mt-6 flex flex-col items-center text-center">
                  <div
                    className="relative flex h-56 w-56 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(${overallPalette.accent} ${Math.round(
                        (result.analysis.overallScore / 100) * 360
                      )}deg, rgba(19, 32, 51, 0.08) 0deg)`,
                    }}
                  >
                    <div
                      className="flex h-40 w-40 flex-col items-center justify-center rounded-full border"
                      style={{
                        borderColor: 'rgba(19, 32, 51, 0.08)',
                        backgroundColor: 'rgba(255, 252, 248, 0.92)',
                      }}
                    >
                      <span
                        className="font-display text-6xl font-semibold tracking-[-0.05em]"
                        style={{ color: overallPalette.accent }}
                      >
                        {result.analysis.overallScore}
                      </span>
                      <span className="mt-1 text-sm text-[color:var(--muted)]">out of 100</span>
                    </div>
                  </div>

                  <span
                    className="mt-6 inline-flex rounded-full border px-4 py-2 text-sm font-semibold"
                    style={{
                      borderColor: overallPalette.border,
                      backgroundColor: overallPalette.soft,
                      color: overallPalette.accent,
                    }}
                  >
                    {result.analysis.scoreBand} match
                  </span>
                </div>
              </article>

              <article className="panel motion-enter p-6 sm:p-8" style={{ animationDelay: '90ms' }}>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4 sm:gap-5">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-white/80">
                      {result.user.avatarUrl ? (
                        <Image
                          src={result.user.avatarUrl}
                          alt={`Avatar for ${result.user.login}`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Github size={24} className="text-[color:var(--muted)]" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="font-display text-3xl font-semibold text-[color:var(--ink)]">
                          {result.user.name || result.user.login}
                        </h2>
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="surface-tag inline-flex items-center gap-2 hover:border-[rgba(195,90,41,0.24)] hover:text-[color:var(--ink)]"
                        >
                          View on GitHub
                          <ArrowUpRight size={14} />
                        </a>
                      </div>
                      <p className="text-sm uppercase tracking-[0.22em] text-[color:var(--muted)]">
                        @{result.user.login} • {result.targetRole}
                      </p>
                      <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
                        {result.user.bio || 'Public profile reviewed for hiring readiness.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:w-[20rem]">
                    <div className="metric-card">
                      <span className="metric-label">Reviewed repos</span>
                      <span className="metric-value">{result.analysis.repoAnalyses.length}</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Recommendations</span>
                      <span className="metric-value">{result.analysis.recommendations.length}</span>
                    </div>
                    <div className="metric-card sm:col-span-2">
                      <span className="metric-label">Analyzed</span>
                      <span className="metric-value">{analyzedLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-[color:var(--line)] pt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                    Portfolio Summary
                  </p>
                  <p className="mt-3 max-w-4xl text-base leading-8 text-[color:var(--ink)]">
                    {result.analysis.profileSummary}
                  </p>
                </div>
              </article>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {DIMENSION_KEYS.map((dimension, index) => (
                <div
                  key={dimension}
                  className="motion-enter h-full"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <DimensionCard
                    dimension={dimension}
                    scoreObj={result.analysis.dimensions[dimension]}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <article className="panel motion-enter p-6 sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <span className="eyebrow">
                      <Zap size={14} />
                      Improvement Roadmap
                    </span>
                    <h3 className="mt-4 font-display text-[1.85rem] font-semibold text-[color:var(--ink)]">
                      Highest-value changes to improve portfolio signal.
                    </h3>
                  </div>
                  <p className="max-w-sm text-sm leading-6 text-[color:var(--muted)]">
                    Prioritized by likely impact on portfolio quality and hiring relevance.
                  </p>
                </div>

                <div className="mt-8 space-y-4">
                  {result.analysis.recommendations.length ? (
                    result.analysis.recommendations.map((recommendation, index) => (
                      <div
                        key={`${recommendation.title}-${index}`}
                        className="rounded-[26px] border p-5"
                        style={{
                          borderColor: 'rgba(19, 32, 51, 0.08)',
                          backgroundColor: 'rgba(255, 255, 255, 0.72)',
                        }}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex gap-4">
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border text-base font-semibold"
                              style={{
                                borderColor: 'rgba(195, 90, 41, 0.18)',
                                backgroundColor: 'rgba(195, 90, 41, 0.1)',
                                color: '#c35a29',
                              }}
                            >
                              {recommendation.priority || index + 1}
                            </span>
                            <div>
                              <h4 className="text-lg font-semibold text-[color:var(--ink)]">
                                {recommendation.title}
                              </h4>
                              <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                                {recommendation.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="surface-tag">{recommendation.impact}</span>
                            <span className="surface-tag">
                              {DIMENSION_META[
                                recommendation.dimension as DimensionKey
                              ]?.title || recommendation.dimension}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      className="rounded-[24px] border p-5 text-sm leading-7 text-[color:var(--muted)]"
                      style={{
                        borderColor: 'rgba(19, 32, 51, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.72)',
                      }}
                    >
                      The evaluator did not return explicit recommendations for this profile.
                    </div>
                  )}
                </div>
              </article>

              <div className="grid gap-6">
                <InsightPanel
                  title="Top strengths"
                  items={result.analysis.strengths}
                  accent="#0f766e"
                  soft="rgba(15, 118, 110, 0.12)"
                  icon={ShieldCheck}
                />
                <InsightPanel
                  title="Main concerns"
                  items={result.analysis.concerns}
                  accent="#b45309"
                  soft="rgba(180, 83, 9, 0.12)"
                  icon={AlertTriangle}
                />
              </div>
            </div>

            <article className="panel motion-enter p-6 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="eyebrow">
                    <FolderGit2 size={14} />
                    Repository Breakdown
                  </span>
                  <h3 className="mt-4 font-display text-[1.85rem] font-semibold text-[color:var(--ink)]">
                    Where the portfolio score is coming from.
                  </h3>
                </div>
                <p className="max-w-sm text-sm leading-6 text-[color:var(--muted)]">
                  Expand each repository to inspect the dimension scores, supporting findings, and
                  recommended fixes.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                {result.analysis.repoAnalyses.map((repo, index) => {
                  const isExpanded = Boolean(expandedRepos[repo.repoName]);
                  const palette = getScorePalette(repo.overallRepoScore);
                  const repoFindings = collectRepoInsights(repo, 'findings');
                  const repoSuggestions = collectRepoInsights(repo, 'suggestions');

                  return (
                    <article
                      key={repo.repoName}
                      className="overflow-hidden rounded-[30px] border"
                      style={{
                        borderColor: 'rgba(19, 32, 51, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.72)',
                      }}
                    >
                      <button
                        type="button"
                        className="w-full p-5 text-left sm:p-6"
                        onClick={() => toggleRepo(repo.repoName)}
                      >
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-4">
                            <div
                              className="mt-1 flex h-12 w-12 items-center justify-center rounded-[18px] border"
                              style={{
                                borderColor: palette.border,
                                backgroundColor: palette.soft,
                              }}
                            >
                              <FolderGit2 size={19} style={{ color: palette.accent }} />
                            </div>

                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <h4 className="font-display text-2xl font-semibold text-[color:var(--ink)]">
                                  {repo.repoName}
                                </h4>
                                <a
                                  href={repo.repoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="surface-tag inline-flex items-center gap-2 hover:border-[rgba(195,90,41,0.24)] hover:text-[color:var(--ink)]"
                                >
                                  View repo
                                  <ArrowUpRight size={14} />
                                </a>
                              </div>

                              <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--muted)]">
                                {repo.language || 'Unknown stack'} • {repo.stars} star
                                {repo.stars === 1 ? '' : 's'}
                              </p>

                              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted)] [overflow-wrap:anywhere]">
                                {repo.summary}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 sm:gap-6">
                            <div
                              className="min-w-[7.5rem] rounded-[22px] border px-4 py-3 text-center"
                              style={{
                                borderColor: palette.border,
                                backgroundColor: palette.soft,
                              }}
                            >
                              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                                Repo score
                              </div>
                              <div
                                className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em]"
                                style={{ color: palette.accent }}
                              >
                                {repo.overallRepoScore}
                              </div>
                            </div>

                            <div className="text-[color:var(--muted)]">
                              {isExpanded ? (
                                <ChevronDown size={22} />
                              ) : (
                                <ChevronRight size={22} />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-[color:var(--line)] px-5 py-6 sm:px-6">
                          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <div className="space-y-4">
                              <h5 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                                Dimension detail
                              </h5>

                              {DIMENSION_KEYS.map((dimension) => {
                                const dimensionScore = repo[dimension];
                                const meta = DIMENSION_META[dimension];
                                const Icon = meta.icon;
                                const percent = getPercent(
                                  dimensionScore.score,
                                  dimensionScore.maxScore
                                );

                                return (
                                  <div
                                    key={`${repo.repoName}-${dimension}`}
                                    className="rounded-[22px] border p-4"
                                    style={{
                                      borderColor: 'rgba(19, 32, 51, 0.08)',
                                      backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 251, 245, 0.78)',
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3">
                                        <div
                                          className="flex h-9 w-9 items-center justify-center rounded-[14px] border"
                                          style={{
                                            borderColor: meta.border,
                                            backgroundColor: meta.soft,
                                          }}
                                        >
                                          <Icon size={16} style={{ color: meta.accent }} />
                                        </div>
                                        <span className="text-sm font-medium text-[color:var(--ink)]">
                                          {meta.title}
                                        </span>
                                      </div>

                                      <span
                                        className="text-sm font-semibold"
                                        style={{ color: meta.accent }}
                                      >
                                        {dimensionScore.score}/{dimensionScore.maxScore}
                                      </span>
                                    </div>

                                    <div
                                      className="mt-3 h-2 rounded-full"
                                      style={{ backgroundColor: meta.track }}
                                    >
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${percent}%`,
                                          background: `linear-gradient(90deg, ${meta.accent} 0%, ${meta.accent}cc 100%)`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div
                                className="rounded-[26px] border p-5"
                                style={{
                                  borderColor: 'rgba(15, 118, 110, 0.16)',
                                  backgroundColor: 'rgba(15, 118, 110, 0.08)',
                                }}
                              >
                                <h5 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0f766e]">
                                  Working well
                                </h5>
                                <ul className="mt-4 space-y-3">
                                  {(repoFindings.length
                                    ? repoFindings
                                    : ['No distinct positive findings were returned for this repository.']
                                  ).map((item, itemIndex) => (
                                    <li
                                      key={`${repo.repoName}-good-${itemIndex}`}
                                      className="flex gap-3 rounded-[18px] border border-white/70 bg-white/70 p-4 text-sm leading-6 text-[color:var(--ink)]"
                                    >
                                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0f766e]" />
                                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                                        {item}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div
                                className="rounded-[26px] border p-5"
                                style={{
                                  borderColor: 'rgba(180, 83, 9, 0.16)',
                                  backgroundColor: 'rgba(180, 83, 9, 0.08)',
                                }}
                              >
                                <h5 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b45309]">
                                  Tighten next
                                </h5>
                                <ul className="mt-4 space-y-3">
                                  {(repoSuggestions.length
                                    ? repoSuggestions
                                    : ['No immediate improvements were highlighted for this repository.']
                                  ).map((item, itemIndex) => (
                                    <li
                                      key={`${repo.repoName}-next-${itemIndex}`}
                                      className="flex gap-3 rounded-[18px] border border-white/70 bg-white/70 p-4 text-sm leading-6 text-[color:var(--ink)]"
                                    >
                                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#b45309]" />
                                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                                        {item}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </article>
          </section>
        ) : (
          <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <article className="panel motion-enter p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="eyebrow">
                    <Activity size={14} />
                    Evaluation Lens
                  </span>
                  <h3 className="mt-4 font-display text-[1.85rem] font-semibold text-[color:var(--ink)]">
                    The report balances engineering quality, clarity, and market fit.
                  </h3>
                </div>
                <div
                  className="hidden h-14 w-14 items-center justify-center rounded-[18px] border sm:flex"
                  style={{
                    borderColor: 'rgba(19, 32, 51, 0.08)',
                    backgroundColor: 'rgba(255, 255, 255, 0.72)',
                  }}
                >
                  <ShieldCheck size={20} className="text-[#1d4f91]" />
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {DIMENSION_KEYS.map((dimension) => {
                  const meta = DIMENSION_META[dimension];
                  const Icon = meta.icon;

                  return (
                    <div
                      key={dimension}
                      className="rounded-[24px] border p-5"
                      style={{
                        borderColor: 'rgba(19, 32, 51, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.72)',
                      }}
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-[16px] border"
                        style={{
                          borderColor: meta.border,
                          backgroundColor: meta.soft,
                        }}
                      >
                        <Icon size={18} style={{ color: meta.accent }} />
                      </div>
                      <h4 className="mt-4 text-lg font-semibold text-[color:var(--ink)]">
                        {meta.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {meta.hint}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>

            <article
              className="panel panel-muted motion-enter p-6 sm:p-8"
              style={{ animationDelay: '120ms' }}
            >
              <span className="eyebrow">
                <Sparkles size={14} />
                Report Structure
              </span>
              <h3 className="mt-4 font-display text-[1.85rem] font-semibold text-[color:var(--ink)]">
                Every evaluation produces a score, supporting evidence, and next moves.
              </h3>

              <div className="mt-8 space-y-4">
                {REPORT_SECTIONS.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-[24px] border p-5"
                    style={{
                      borderColor: 'rgba(19, 32, 51, 0.08)',
                      backgroundColor: 'rgba(255, 255, 255, 0.72)',
                    }}
                  >
                    <h4 className="text-lg font-semibold text-[color:var(--ink)]">{section.title}</h4>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                      {section.description}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
