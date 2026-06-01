import type { SourceEntry, ResearchConstraints } from "../types.js";

export function scoreSource(
  source: { title: string; url: string; content: string; score: number },
  query: string,
  constraints: ResearchConstraints,
): { relevance: number; authority: "high" | "medium" | "low" } {
  const relevanceScore = calculateRelevance(source.content, query);

  let authority: "high" | "medium" | "low" = "low";
  try {
    const hostname = new URL(source.url).hostname;
    authority = constraints.authority_tiers[hostname] ?? "low";
  } catch {
    authority = "low";
  }

  return {
    relevance: Math.max(relevanceScore, source.score),
    authority,
  };
}

export function passesThreshold(
  score: { relevance: number; authority: "high" | "medium" | "low" },
  minRelevance: number,
): boolean {
  if (score.authority === "high") return score.relevance >= minRelevance * 0.7;
  return score.relevance >= minRelevance;
}

function calculateRelevance(content: string, query: string): number {
  const queryTokens = tokenize(query);
  const contentTokens = tokenize(content);

  if (queryTokens.length === 0) return 0;

  const contentSet = new Set(contentTokens);
  let matchCount = 0;
  for (const token of queryTokens) {
    if (contentSet.has(token)) matchCount++;
  }

  return matchCount / queryTokens.length;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function toSourceEntry(
  source: { title: string; url: string; content: string; score: number; published_date?: string },
  query: string,
  constraints: ResearchConstraints,
): SourceEntry {
  const scoreResult = scoreSource(source, query, constraints);
  return {
    url: source.url,
    title: source.title,
    content: source.content,
    relevance_score: scoreResult.relevance,
    authority_tier: scoreResult.authority,
    published_date: source.published_date,
    cited: false,
  };
}
