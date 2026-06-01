# Tools: hy-search

## `web_search`

Single-round web search. Fast lookup with summarized results and source citations.

### Input Schema

```typescript
{
  query: string;                    // Search query (required)
  search_depth?: "basic" | "advanced";  // Tavily search depth (default: "basic")
  max_results?: number;             // Max results to return (1-20, default: 5)
  include_domains?: string[];       // Only include these domains
  exclude_domains?: string[];       // Exclude these domains
  time_range?: "day" | "week" | "month" | "year";  // Time filter
}
```

### Output

```typescript
{
  answer: string;                   // LLM-summarized answer with inline citations [1]
  results: Array<{
    title: string;
    url: string;
    content: string;                // Snippet or extracted content
    score: number;                  // Relevance score
    published_date?: string;
  }>;
  sources: Array<{
    index: number;
    url: string;
    title: string;
  }>;
  search_time_ms: number;
}
```

### When to Use

- Quick fact lookups ("What's the weather in Tokyo?")
- Recent news ("Latest AI regulation updates")
- Simple reference ("Python 3.12 release notes")
- Single-domain exploration ("Apple's latest earnings")

---

## `deep_research`

Multi-round agentic research. The tool internally runs a research loop: generating queries from multiple angles, fetching full page content, analyzing information gaps, and synthesizing a comprehensive report.

### Input Schema

```typescript
{
  query: string;                    // Research question (required)
  depth?: number;                   // Max search rounds (1-10, default: 3)
  breadth?: number;                 // Queries per round (1-10, default: 4)
  max_sources?: number;             // Max unique sources to track (10-100, default: 50)
  time_range?: "day" | "week" | "month" | "year";  // Time filter
  include_domains?: string[];       // Only include these domains
  exclude_domains?: string[];       // Exclude these domains
  max_time_seconds?: number;        // Hard timeout (30-600, default: 300)
  search_depth?: "basic" | "advanced";  // Tavily search depth per query (default: "advanced")
}
```

### Output

```typescript
{
  report: string;                   // Comprehensive synthesized report
                                    // with inline citations like [1], [2], ...
  sources: Array<{
    index: number;
    url: string;
    title: string;
    relevance_score: number;
    authority_tier: "high" | "medium" | "low";
    content_snippet: string;
    published_date?: string;
  }>;
  stats: {
    rounds_completed: number;
    queries_generated: number;
    sources_found: number;
    sources_cited: number;
    pages_fetched: number;
    total_time_ms: number;
    truncated: boolean;             // true if hit max_time or max_rounds
  };
  research_log: Array<{
    round: number;
    queries: string[];
    sources_added: number;
    gaps_identified: string[];
  }>;
}
```

### Internal Loop (not visible to external LLM)

```
Round 1: Generate {breadth} queries → Search → Fetch top pages → Score
Gap Analysis: What's missing? Contradictions? Depth gaps?
Round 2: Generate follow-up queries → Search → Fetch → Score
...
Round N: Synthesis → Final Report
```

### When to Use

- Multi-faceted research ("Impact of remote work on urban real estate")
- Comparative analysis ("Top 5 LLM providers: features, pricing, performance")
- Deep dives ("Current state of quantum computing: hardware, algorithms, companies")
- Literature-style surveys ("Recent advances in CRISPR gene editing 2024-2025")
- Competitive intelligence ("Competitor landscape for [product category]")

### Hard Constraints

| Parameter | Default | Hard Max |
|---|---|---|
| `depth` (rounds) | 3 | 10 |
| `breadth` (queries/round) | 4 | 10 |
| `max_sources` | 50 | 100 |
| `max_time_seconds` | 300 | 600 |
| Page content per source | — | 8000 chars |
| Rate limit (Tavily) | — | 5 req/s |

The tool enforces these limits programmatically. No prompt can override them.

### Gap Analysis Strategy (Soft Rule)

The internal LLM is prompted to check for:

1. **Coverage gaps** — Are there sub-topics not yet explored?
2. **Depth gaps** — Is the information surface-level? Can we drill deeper?
3. **Contradictions** — Do sources disagree? What's the consensus?
4. **Temporal gaps** — Is the information outdated? Need more recent data?
5. **Source diversity** — Are we relying too much on one domain or perspective?

If no significant gaps are found, the loop terminates early (before `depth` rounds).

### Source Citation Format

Citations in the report use numeric indices matching the `sources` array:

```
Recent advances in CRISPR have focused on prime editing [1] and base editing [2],
with clinical trials beginning in 2024 [3]. However, off-target effects remain
a significant concern [4][5].
```

Each `[N]` corresponds to `sources[N-1]` in the output.
