import type { TavilyResult, TavilySearchResponse } from "../types.js";

const TAVILY_API_BASE = "https://api.tavily.com/search";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

export interface TavilySearchParams {
  query: string;
  search_depth?: "basic" | "advanced";
  max_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
  time_range?: "day" | "week" | "month" | "year";
  include_answer?: boolean;
}

export class TavilyClient {
  private apiKey: string;
  private lastRequestTime = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(params: TavilySearchParams): Promise<TavilySearchResponse> {
    const start = Date.now();

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.request(params);
        return response;
      } catch (err) {
        if (attempt === MAX_RETRIES) throw err;
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }

    throw new Error("Tavily search failed after retries");
  }

  private async request(params: TavilySearchParams): Promise<TavilySearchResponse> {
    const body: Record<string, unknown> = {
      api_key: this.apiKey,
      query: params.query,
      search_depth: params.search_depth ?? "basic",
      max_results: params.max_results ?? 5,
      include_answer: params.include_answer ?? false,
    };

    if (params.include_domains?.length) body.include_domains = params.include_domains;
    if (params.exclude_domains?.length) body.exclude_domains = params.exclude_domains;
    if (params.time_range) body.time_range = params.time_range;

    const res = await fetch(TAVILY_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tavily API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      results?: TavilyResult[];
      query?: string;
      response_time?: number;
    };

    return {
      results: data.results ?? [],
      query: data.query ?? params.query,
      response_time: data.response_time ?? 0,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
