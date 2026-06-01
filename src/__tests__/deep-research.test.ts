import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONSTRAINTS,
  truncateContent,
  isDomainBlocked,
  deduplicateByUrl,
} from "../constraints.js";
import { toSourceEntry, passesThreshold, scoreSource } from "../research/scorer.js";

describe("constraints", () => {
  describe("truncateContent", () => {
    it("returns content as-is when shorter than limit", () => {
      expect(truncateContent("short", 100)).toBe("short");
    });

    it("truncates content exceeding limit", () => {
      const result = truncateContent("hello world!!!!", 5);
      expect(result).toBe("hello...");
    });

    it("returns exact content at limit", () => {
      const result = truncateContent("abcde", 5);
      expect(result).toBe("abcde");
    });
  });

  describe("isDomainBlocked", () => {
    it("returns false when no blocked domains", () => {
      expect(isDomainBlocked("https://example.com", [])).toBe(false);
    });

    it("blocks exact domain match", () => {
      expect(isDomainBlocked("https://example.com", ["example.com"])).toBe(true);
    });

    it("blocks subdomain", () => {
      expect(isDomainBlocked("https://sub.example.com", ["example.com"])).toBe(true);
    });

    it("allows unrelated domain", () => {
      expect(isDomainBlocked("https://good.com", ["bad.com"])).toBe(false);
    });

    it("is case insensitive", () => {
      expect(isDomainBlocked("https://EXAMPLE.COM", ["example.com"])).toBe(true);
    });

    it("handles invalid URL gracefully", () => {
      expect(isDomainBlocked("not-a-url", ["example.com"])).toBe(false);
    });
  });

  describe("deduplicateByUrl", () => {
    it("detects exact URL duplicates", () => {
      const map = new Map([["https://example.com/page", {}]]);
      expect(deduplicateByUrl(map, "https://example.com/page", 0.9)).toBe(true);
    });

    it("detects trailing slash variants", () => {
      const map = new Map([["https://example.com/page", {}]]);
      expect(deduplicateByUrl(map, "https://example.com/page/", 0.9)).toBe(true);
    });

    it("detects highly similar URLs", () => {
      const map = new Map([["https://example.com/article-about-ai", {}]]);
      expect(
        deduplicateByUrl(map, "https://example.com/article-about-ai/", 0.9),
      ).toBe(true);
    });

    it("allows distinct URLs", () => {
      const map = new Map([["https://example.com/page1", {}]]);
      expect(
        deduplicateByUrl(map, "https://other.com/different", 0.9),
      ).toBe(false);
    });
  });
});

describe("scorer", () => {
  describe("scoreSource", () => {
    it("returns relevance based on token overlap", () => {
      const source = {
        title: "AI advances",
        url: "https://example.com/ai",
        content: "Artificial intelligence is making rapid advances in 2024",
        score: 0.5,
      };
      const result = scoreSource(source, "artificial intelligence advances 2024", DEFAULT_CONSTRAINTS);
      expect(result.relevance).toBeGreaterThan(0);
      expect(result.authority).toBe("low");
    });

    it("returns higher score for matching keywords", () => {
      const source = {
        title: "Python 3.12",
        url: "https://docs.python.org/3.12",
        content: "Python 3.12 introduces new features including better error messages and performance improvements",
        score: 0.3,
      };
      const result = scoreSource(source, "Python 3.12 performance", DEFAULT_CONSTRAINTS);
      expect(result.relevance).toBeGreaterThan(0.3);
    });

    it("returns low score for unrelated content", () => {
      const source = {
        title: "Gardening tips",
        url: "https://garden.com",
        content: "How to grow tomatoes in your backyard",
        score: 0.1,
      };
      const result = scoreSource(source, "quantum computing algorithms", DEFAULT_CONSTRAINTS);
      expect(result.relevance).toBeLessThan(0.5);
    });
  });

  describe("passesThreshold", () => {
    it("passes with high relevance", () => {
      expect(
        passesThreshold({ relevance: 0.8, authority: "low" }, 0.3),
      ).toBe(true);
    });

    it("rejects low relevance", () => {
      expect(
        passesThreshold({ relevance: 0.1, authority: "low" }, 0.3),
      ).toBe(false);
    });

    it("lowers bar for high authority sources", () => {
      expect(
        passesThreshold({ relevance: 0.25, authority: "high" }, 0.3),
      ).toBe(true);
    });
  });

  describe("toSourceEntry", () => {
    it("creates a valid SourceEntry", () => {
      const source = {
        title: "Test Article",
        url: "https://example.com/test",
        content: "This is a test article about AI and machine learning",
        score: 0.6,
        published_date: "2024-01-01",
      };
      const entry = toSourceEntry(source, "AI machine learning test", DEFAULT_CONSTRAINTS);
      expect(entry.url).toBe(source.url);
      expect(entry.title).toBe(source.title);
      expect(entry.relevance_score).toBeGreaterThan(0);
      expect(entry.authority_tier).toBe("low");
      expect(entry.cited).toBe(false);
      expect(entry.published_date).toBe("2024-01-01");
    });
  });
});
