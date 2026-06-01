import { z } from "zod";
import type { LLMProvider, SourceEntry, DeepResearchOutput } from "../types.js";

const SynthesisSchema = z.object({
  report: z.string(),
  sources_cited: z.array(z.number()),
});

const SYSTEM_PROMPT = `You are a research synthesizer. Given all collected sources for a research question, produce a comprehensive, well-structured report.

Guidelines:
- Use inline citations like [1], [2] to reference sources by their index number
- Present multiple perspectives, including contradictory views
- Structure the report with clear sections
- Be objective and balanced
- Include sources not cited if they provide corroborating evidence

Return the report as a JSON object with "report" (string) and "sources_cited" (array of source index numbers).`;

export async function synthesize(
  llm: LLMProvider,
  query: string,
  sources: Map<string, SourceEntry>,
  stats: Omit<DeepResearchOutput["stats"], "sources_cited">,
): Promise<DeepResearchOutput> {
  let sourceIndex = 0;
  const sourceList = Array.from(sources.values()).map((s) => {
    sourceIndex++;
    return {
      index: sourceIndex,
      ...s,
    };
  });

  const sourceSummary = sourceList
    .map((s) => `[${s.index}] ${s.title}\nURL: ${s.url}\n${s.content.slice(0, 800)}...`)
    .join("\n\n");

  const prompt = `Research question: "${query}"\n\nSources:\n${sourceSummary}\n\nSynthesize a comprehensive report. Use [N] to cite sources.`;

  const result = await llm.generateStructured(prompt, SynthesisSchema);

  const citedSources = new Set(result.sources_cited);
  for (const s of sourceList) {
    if (citedSources.has(s.index)) s.cited = true;
  }

  const sourcesCited = result.sources_cited.length;

  sources.forEach((s) => {
    if (citedSources.has(sourceIndex)) s.cited = true;
  });

  return {
    report: result.report,
    sources: sourceList.map((s) => ({
      index: s.index,
      url: s.url,
      title: s.title,
      relevance_score: s.relevance_score,
      authority_tier: s.authority_tier,
      content_snippet: s.content.slice(0, 300),
      published_date: s.published_date,
    })),
    stats: {
      ...stats,
      sources_cited: sourcesCited,
    },
    research_log: [],
  };
}
