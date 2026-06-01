import { z } from "zod";

// ── Web Search ──

export const WebSearchInputSchema = z.object({
  query: z.string().min(1, "query is required"),
  search_depth: z.enum(["basic", "advanced"]).default("basic"),
  max_results: z.number().int().min(1).max(20).default(5),
  include_domains: z.array(z.string()).optional(),
  exclude_domains: z.array(z.string()).optional(),
  time_range: z.enum(["day", "week", "month", "year"]).optional(),
});

export type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface WebSearchSource {
  index: number;
  url: string;
  title: string;
}

export interface WebSearchOutput {
  answer: string;
  results: WebSearchResult[];
  sources: WebSearchSource[];
  search_time_ms: number;
}

// ── Deep Research ──

export const DeepResearchInputSchema = z.object({
  query: z.string().min(1, "query is required"),
  depth: z.number().int().min(1).max(10).default(3),
  breadth: z.number().int().min(1).max(10).default(4),
  max_sources: z.number().int().min(10).max(100).default(50),
  time_range: z.enum(["day", "week", "month", "year"]).optional(),
  include_domains: z.array(z.string()).optional(),
  exclude_domains: z.array(z.string()).optional(),
  max_time_seconds: z.number().int().min(30).max(600).default(300),
  search_depth: z.enum(["basic", "advanced"]).default("advanced"),
});

export type DeepResearchInput = z.infer<typeof DeepResearchInputSchema>;

export interface SourceEntry {
  url: string;
  title: string;
  content: string;
  relevance_score: number;
  authority_tier: "high" | "medium" | "low";
  published_date?: string;
  cited: boolean;
}

export interface DeepResearchSource {
  index: number;
  url: string;
  title: string;
  relevance_score: number;
  authority_tier: "high" | "medium" | "low";
  content_snippet: string;
  published_date?: string;
}

export interface ResearchStats {
  rounds_completed: number;
  queries_generated: number;
  sources_found: number;
  sources_cited: number;
  pages_fetched: number;
  total_time_ms: number;
  truncated: boolean;
}

export interface RoundLog {
  round: number;
  queries: string[];
  sources_added: number;
  gaps_identified: string[];
}

export interface DeepResearchOutput {
  report: string;
  sources: DeepResearchSource[];
  stats: ResearchStats;
  research_log: RoundLog[];
}

// ── Internal Research State ──

export interface ResearchConfig {
  query: string;
  depth: number;
  breadth: number;
  max_sources: number;
  max_time_seconds: number;
  search_depth: "basic" | "advanced";
  include_domains?: string[];
  exclude_domains?: string[];
  time_range?: "day" | "week" | "month" | "year";
}

export interface ResearchState {
  query: string;
  rounds: number;
  sources: Map<string, SourceEntry>;
  queries: string[];
  gaps: string[];
  startTime: number;
  config: ResearchConfig;
}

// ── Tavily ──

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
  query: string;
  response_time: number;
}

// ── LLM Provider ──

export interface LLMProvider {
  generateStructured<T>(prompt: string, schema: z.ZodType<T>): Promise<T>;
  generateText(prompt: string): Promise<string>;
}

// ── Constraints ──

export interface ResearchConstraints {
  max_page_content_chars: number;
  rate_limit_rps: number;
  dedup_threshold: number;
  blocked_domains: string[];
  authority_tiers: Record<string, "high" | "medium" | "low">;
}
