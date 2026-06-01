import { z } from "zod";
import type { LLMProvider } from "../types.js";

const QueryGenSchema = z.object({
  queries: z.array(z.string()).min(1).max(10),
});

const SYSTEM_PROMPT = `You are a research assistant. Given a research question, generate multiple search queries from diverse angles to comprehensively explore the topic.

Cover these perspectives:
- Factual anchors — "what is X", "when did Y happen"
- Comparative angles — "X vs Y", "before vs after"
- Depth probes — specific sub-questions that drill into details
- Contrarian views — "criticism of X", "limitations of Y"
- Temporal slices — queries targeting different time ranges

Return the queries as a JSON object with a "queries" array field.`;

export async function generateQueries(
  llm: LLMProvider,
  query: string,
  breadth: number,
  previousQueries: string[],
): Promise<string[]> {
  const previousBlock =
    previousQueries.length > 0
      ? `\n\nPreviously used queries (avoid repeating):\n${previousQueries.map((q) => `- ${q}`).join("\n")}`
      : "";

  const prompt = `Research question: "${query}"\n\nGenerate exactly ${breadth} new search queries from different angles.${previousBlock}`;

  const result = await llm.generateStructured(prompt, QueryGenSchema);
  return result.queries.slice(0, breadth);
}
