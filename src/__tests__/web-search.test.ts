import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMProvider } from "../types.js";
import { TavilyClient } from "../services/tavily.js";
import {
  WebSearchInputSchema,
  DeepResearchInputSchema,
} from "../types.js";

describe("WebSearchInputSchema", () => {
  it("validates minimal input", () => {
    const result = WebSearchInputSchema.safeParse({ query: "test" });
    expect(result.success).toBe(true);
    expect(result.data!.search_depth).toBe("basic");
    expect(result.data!.max_results).toBe(5);
  });

  it("validates full input", () => {
    const result = WebSearchInputSchema.safeParse({
      query: "AI advances",
      search_depth: "advanced",
      max_results: 10,
      include_domains: ["example.com"],
      exclude_domains: ["spam.com"],
      time_range: "week",
    });
    expect(result.success).toBe(true);
    expect(result.data!.search_depth).toBe("advanced");
    expect(result.data!.max_results).toBe(10);
  });

  it("rejects empty query", () => {
    const result = WebSearchInputSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid search_depth", () => {
    const result = WebSearchInputSchema.safeParse({
      query: "test",
      search_depth: "deep",
    });
    expect(result.success).toBe(false);
  });

  it("rejects max_results out of range", () => {
    const result = WebSearchInputSchema.safeParse({
      query: "test",
      max_results: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe("DeepResearchInputSchema", () => {
  it("validates minimal input with defaults", () => {
    const result = DeepResearchInputSchema.safeParse({ query: "deep research" });
    expect(result.success).toBe(true);
    expect(result.data!.depth).toBe(3);
    expect(result.data!.breadth).toBe(4);
    expect(result.data!.max_sources).toBe(50);
    expect(result.data!.max_time_seconds).toBe(300);
    expect(result.data!.search_depth).toBe("advanced");
  });

  it("validates full input", () => {
    const result = DeepResearchInputSchema.safeParse({
      query: "impact of AI on education",
      depth: 5,
      breadth: 6,
      max_sources: 80,
      max_time_seconds: 120,
      search_depth: "basic",
      time_range: "year",
      include_domains: ["edu.cn"],
      exclude_domains: ["spam.net"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects depth out of range", () => {
    const result = DeepResearchInputSchema.safeParse({
      query: "test",
      depth: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative breadth", () => {
    const result = DeepResearchInputSchema.safeParse({
      query: "test",
      breadth: -1,
    });
    expect(result.success).toBe(false);
  });
});
