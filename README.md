# hy-search

MCP Server for AI-powered web search and deep research. Powered by Tavily Search API.

Provides two tools:

- **`web_search`** — Single-round search, fast lookup with LLM-summarized results and source citations.
- **`deep_research`** — Multi-round agentic research. Generates queries from multiple angles, fetches full page content, analyzes information gaps, iterates until coverage thresholds are met, and produces a comprehensive report with inline citations.

## Installation

```bash
npm install
npm run build
```

## MCP Config

```json
{
  "mcp": {
    "hy-search": {
      "type": "local",
      "command": ["node", "dist/server.js"],
      "env": {
        "TAVILY_API_KEY": "<your-key>",
        "OPENAI_API_KEY": "<your-key>"
      },
      "enabled": true
    }
  }
}
```

## Tools

| Tool | Purpose | Latency | Rounds |
|---|---|---|---|
| `web_search` | Quick fact lookup | <5s | 1 |
| `deep_research` | Comprehensive investigation | minutes | N (`depth`) |

See [docs/tools.md](docs/tools.md) for full schemas and parameters.
See [docs/architecture.md](docs/architecture.md) for internal design.
