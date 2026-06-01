# Architecture: hy-search

## Overview

hy-search is an MCP Server that gives LLMs the ability to search the web and conduct multi-round deep research. It sits between the external LLM (the one calling MCP tools) and the web.

```
┌──────────────┐     MCP (stdio)      ┌───────────────┐
│  External LLM │ ◄──────────────────► │  hy-search     │
│  (user's)     │                      │  MCP Server    │
└──────────────┘                      └───────┬───────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                         ┌────▼────┐   ┌──────▼──────┐  ┌────▼────┐
                         │ Tavily  │   │  OpenAI API │  │  Rules  │
                         │ Search  │   │  (internal  │  │  Engine │
                         │ API     │   │   LLM)      │  │  (hard) │
                         └─────────┘   └─────────────┘  └─────────┘
```

## Three-Layer Architecture

### Layer 1: External LLM (Decision Maker)
- Decides *when* to call `web_search` or `deep_research`
- Provides the user's query and parameters (`depth`, `breadth`, etc.)
- Receives final results with citations
- No involvement in the internal research loop

### Layer 2: MCP Server Code (Hard Constraints)
Enforced programmatically, cannot be bypassed by prompts:

| Constraint | Default | Description |
|---|---|---|
| `max_rounds` | 3 | Maximum search iterations |
| `max_sources` | 50 | Maximum unique sources tracked |
| `max_time_seconds` | 300 | Hard timeout for the entire research run |
| `max_page_content_chars` | 8000 | Truncation per fetched page |
| `blocked_domains` | configurable | Domain blocklist |
| `dedup_threshold` | 0.9 | URL/content deduplication |
| `rate_limit_rps` | 5 | Max requests/second to Tavily |

### Layer 3: Internal LLM (Researcher)
A separate LLM call (OpenAI API) used *inside* the deep research loop:
- Generates search queries from multiple angles
- Scores and filters search results
- Analyzes information gaps after each round
- Synthesizes the final report

**Decoupled from the external LLM** — the external LLM never sees the intermediate steps. It only gets the final report.

## Flow: `web_search`

```
User Query → Tavily Search → Results + Snippets → LLM Summarize → Response + Citations
```

Single round. No page fetching (uses Tavily's built-in content extraction). Under 5s.

## Flow: `deep_research`

```
User Query
  │
  ├─[Round 1]──────────────────────────────────────────────────
  │  1. Internal LLM generates N queries from different angles
  │  2. Tavily Search each query (parallel)
  │  3. Score results → open high-value pages → extract full text
  │  4. Store in research state (dedup, track sources)
  │
  ├─[Gap Analysis]──────────────────────────────────────────────
  │  5. Internal LLM reviews accumulated knowledge
  │  6. Identifies missing angles, contradictions, depth gaps
  │  7. If (rounds < max_rounds AND gaps exist AND time remains):
  │       generate follow-up queries → Go to Round 2
  │     else: proceed to synthesis
  │
  ├─[Synthesis]─────────────────────────────────────────────────
  │  8. Internal LLM synthesizes all sources into a report
  │  9. Inline citations ([1], [2], ...) linked to source list
  │  10. Sources appendix with URLs, titles, relevance scores
  │
  └─→ Final Report returned to external LLM
```

### Query Generation Strategy (Soft Rule, via Internal LLM Prompt)

The internal LLM is instructed to decompose the user's question into queries covering:
- **Factual anchors** — "what is X", "when did Y happen"
- **Comparative angles** — "X vs Y", "before vs after"
- **Depth probes** — specific sub-questions that drill into details
- **Contrarian views** — "criticism of X", "limitations of Y"
- **Temporal slices** — if time matters, queries targeting different time ranges

### Source Quality Scoring (Hard Rule)

Each fetched source is scored on:
- **Relevance** — cosine similarity or keyword overlap with original query (hard)
- **Authority** — domain tier list (hard, configurable)
- **Freshness** — recency of content (hard, from Tavily metadata)

Only sources above a configurable threshold proceed to extraction.

## State Management

`deep_research` maintains an internal state object across rounds:

```typescript
interface ResearchState {
  query: string;
  rounds: number;
  sources: Map<string, SourceEntry>;   // url → {title, content, score, cited}
  queries: string[];                   // all queries generated so far
  gaps: string[];                      // identified information gaps
  startTime: number;
  config: ResearchConfig;
}
```

This state is ephemeral (per invocation). No persistence between calls.

## Soft Rules (System Prompt Injection)

Following the pattern from `hy-workflow-mcp`, soft behavioral rules are injected via MCP's system prompt capability. The internal LLM receives a prompt that guides:

- Source diversity: avoid over-relying on a single domain
- Query iteration: when to refine vs when to branch
- Synthesis quality: report structure, citation style, objectivity
- Stopping criteria heuristics: recognizing when "enough" information is gathered

## Error Handling

| Scenario | Behavior |
|---|---|
| Tavily API error | Retry 3x with backoff, then return partial results |
| Internal LLM error | Fall back to results gathered so far, synthesize without LLM gap analysis |
| Timeout | Return partial report with `"truncated": true` and gathered sources |
| No search results | Report "no results found" with the attempted queries |
| Rate limit hit | Queue and delay, respect `rate_limit_rps` |
