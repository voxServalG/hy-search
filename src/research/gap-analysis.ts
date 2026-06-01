import { z } from "zod";
import type { LLMProvider, SourceEntry } from "../types.js";

const GapAnalysisSchema = z.object({
  gaps: z.array(z.string()),
  severity: z.enum(["critical", "moderate", "low", "none"]),
  followups: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are a research gap analyst. Review accumulated knowledge from multiple sources and identify what's still missing.

Check for:
1. Coverage gaps — Are there sub-topics not yet explored?
2. Depth gaps — Is the information surface-level? Can we drill deeper?
3. Contradictions — Do sources disagree? What's the consensus?
4. Temporal gaps — Is the information outdated? Need more recent data?
5. Source diversity — Are we relying too much on one domain or perspective?

Return your analysis as JSON. If no significant gaps remain, set severity to "none" and provide an empty followups array.`;

export async function analyzeGaps(
  llm: LLMProvider,
  query: string,
  sources: Map<string, SourceEntry>,
  queries: string[],
): Promise<{ gaps: string[]; followups: string[] }> {
  if (sources.size === 0) {
    return { gaps: ["No sources collected yet"], followups: [] };
  }

  const sourceSummary = Array.from(sources.values())
    .map(
      (s) =>
        `[${s.url}] ${s.title} (relevance: ${s.relevance_score.toFixed(2)}, authority: ${s.authority_tier})\n${s.content.slice(0, 500)}...`,
    )
    .join("\n\n");

  const prompt = `Research question: "${query}"\n\nAccumulated sources:\n${sourceSummary}\n\nQueries used so far: ${queries.join(", ")}`;

  const result = await llm.generateStructured(prompt, GapAnalysisSchema);

  if (result.severity === "none") {
    return { gaps: [], followups: [] };
  }

  return {
    gaps: result.gaps,
    followups: result.followups,
  };
}
