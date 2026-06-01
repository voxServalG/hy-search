import type {
  LLMProvider,
  DeepResearchInput,
  DeepResearchOutput,
  ResearchState,
  SourceEntry,
  RoundLog,
} from "../types.js";
import type { TavilyClient } from "../services/tavily.js";
import type { ResearchConstraints } from "../types.js";
import { generateQueries } from "./query-gen.js";
import { toSourceEntry, passesThreshold } from "./scorer.js";
import { analyzeGaps } from "./gap-analysis.js";
import { synthesize } from "./synthesis.js";
import { DEFAULT_CONSTRAINTS, truncateContent, isDomainBlocked, deduplicateByUrl } from "../constraints.js";

export async function runDeepResearch(
  llm: LLMProvider,
  tavily: TavilyClient,
  input: {
    query: string;
    depth: number;
    breadth: number;
    max_sources: number;
    max_time_seconds: number;
    search_depth: "basic" | "advanced";
    include_domains?: string[];
    exclude_domains?: string[];
    time_range?: "day" | "week" | "month" | "year";
  },
  constraints: ResearchConstraints = DEFAULT_CONSTRAINTS,
): Promise<DeepResearchOutput> {
  const startTime = Date.now();
  const researchLog: RoundLog[] = [];

  const state: ResearchState = {
    query: input.query,
    rounds: 0,
    sources: new Map<string, SourceEntry>(),
    queries: [],
    gaps: [],
    startTime,
    config: input,
  };

  for (let round = 1; round <= input.depth; round++) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= input.max_time_seconds * 1000) break;

    const queries = await generateQueries(
      llm,
      input.query,
      input.breadth,
      state.queries,
    );
    state.queries.push(...queries);

    const searchResults = await Promise.all(
      queries.map((q) =>
        tavily.search({
          query: q,
          search_depth: input.search_depth,
          max_results: 5,
          include_domains: input.include_domains,
          exclude_domains: input.exclude_domains,
          time_range: input.time_range,
        }),
      ),
    );

    let sourcesAddedThisRound = 0;

    for (const result of searchResults) {
      for (const r of result.results) {
        if (!r.url) continue;
        if (isDomainBlocked(r.url, constraints.blocked_domains)) continue;
        if (deduplicateByUrl(state.sources, r.url, constraints.dedup_threshold)) continue;
        if (state.sources.size >= input.max_sources) break;

        const content = truncateContent(r.content, constraints.max_page_content_chars);
        const entry = toSourceEntry(
          { ...r, content },
          input.query,
          constraints,
        );

        if (passesThreshold({ relevance: entry.relevance_score, authority: entry.authority_tier }, 0.3)) {
          state.sources.set(r.url, entry);
          sourcesAddedThisRound++;
        }
      }
    }

    state.rounds = round;

    const gapResult = await analyzeGaps(llm, input.query, state.sources, state.queries);
    state.gaps = gapResult.gaps;

    researchLog.push({
      round,
      queries,
      sources_added: sourcesAddedThisRound,
      gaps_identified: gapResult.gaps,
    });

    if (gapResult.gaps.length === 0) break;
  }

  const truncated = state.rounds >= input.depth || (Date.now() - startTime) >= input.max_time_seconds * 1000;

  const baseStats = {
    rounds_completed: state.rounds,
    queries_generated: state.queries.length,
    sources_found: state.sources.size,
    sources_cited: 0,
    pages_fetched: state.sources.size,
    total_time_ms: Date.now() - startTime,
    truncated,
  };

  const output = await synthesize(llm, input.query, state.sources, baseStats);
  output.research_log = researchLog;

  return output;
}
