#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TavilyClient } from "./services/tavily.js";
import { OpenAILLMProvider } from "./services/llm.js";
import { createServer } from "./server.js";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!TAVILY_API_KEY) {
  console.error("TAVILY_API_KEY environment variable is required");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

async function main() {
  const tavily = new TavilyClient(TAVILY_API_KEY!);
  const llm = new OpenAILLMProvider(OPENAI_API_KEY!);

  const server = createServer(llm, tavily);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start hy-search:", err);
  process.exit(1);
});
