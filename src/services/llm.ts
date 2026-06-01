import OpenAI from "openai";
import type { LLMProvider } from "../types.js";
import type { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export class OpenAILLMProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateStructured<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(schema, "output"),
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty response");

    const parsed = JSON.parse(content) as Record<string, unknown>;

    if (parsed.output !== undefined) {
      return schema.parse(parsed.output);
    }

    return schema.parse(parsed);
  }

  async generateText(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content ?? "";
  }
}
