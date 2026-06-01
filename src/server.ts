import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  WebSearchInputSchema,
  DeepResearchInputSchema,
} from "./types.js";
import type { WebSearchOutput, DeepResearchOutput } from "./types.js";
import type { TavilyClient } from "./services/tavily.js";
import type { LLMProvider } from "./types.js";
import { DEFAULT_CONSTRAINTS } from "./constraints.js";
import { runDeepResearch } from "./research/engine.js";

export function createServer(
  llm: LLMProvider,
  tavily: TavilyClient,
): McpServer {
  const server = new McpServer({
    name: "hy-search",
    version: "0.1.0",
  });

  // ── web_search ──

  server.tool(
    "web_search",
    "Single-round web search with summarized results and source citations.",
    WebSearchInputSchema.shape,
    async (input): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
      const startTime = Date.now();

      const tavilyResult = await tavily.search({
        query: input.query,
        search_depth: input.search_depth,
        max_results: input.max_results,
        include_domains: input.include_domains,
        exclude_domains: input.exclude_domains,
        time_range: input.time_range,
        include_answer: true,
      });

      const results = tavilyResult.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        published_date: r.published_date,
      }));

      const sources = results.map((r, i) => ({
        index: i + 1,
        url: r.url,
        title: r.title,
      }));

      const answer = await llm.generateText(
        `Summarize the following search results for the query "${input.query}". Use inline citations like [1], [2] to reference sources:\n\n` +
          results.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`).join("\n\n"),
      );

      const output: WebSearchOutput = {
        answer,
        results,
        sources,
        search_time_ms: Date.now() - startTime,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      };
    },
  );

  // ── deep_research ──

  server.tool(
    "deep_research",
    "Multi-round agentic research with comprehensive report and citations.",
    DeepResearchInputSchema.shape,
    async (input): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
      const deepInput: Parameters<typeof runDeepResearch>[2] = {
        query: input.query,
        depth: input.depth ?? 3,
        breadth: input.breadth ?? 4,
        max_sources: input.max_sources ?? 50,
        time_range: input.time_range,
        include_domains: input.include_domains,
        exclude_domains: input.exclude_domains,
        max_time_seconds: input.max_time_seconds ?? 300,
        search_depth: input.search_depth ?? "advanced" as const,
      };

      const output: DeepResearchOutput = await runDeepResearch(
        llm,
        tavily,
        deepInput,
        DEFAULT_CONSTRAINTS,
      );

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      };
    },
  );

  return server;
}
