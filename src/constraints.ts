import type { ResearchConstraints } from "./types.js";

export const DEFAULT_CONSTRAINTS: ResearchConstraints = {
  max_page_content_chars: 8000,
  rate_limit_rps: 5,
  dedup_threshold: 0.9,
  blocked_domains: [],
  authority_tiers: {},
};

export function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + "...";
}

export function isDomainBlocked(url: string, blockedDomains: string[]): boolean {
  if (blockedDomains.length === 0) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return blockedDomains.some(
      (d) => hostname === d.toLowerCase() || hostname.endsWith("." + d.toLowerCase()),
    );
  } catch {
    return false;
  }
}

export function deduplicateByUrl(
  existing: Map<string, unknown>,
  url: string,
  threshold: number,
): boolean {
  const normalized = url.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

  for (const [key] of existing) {
    const existingNormalized = key
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (existingNormalized === normalized) return true;

    const overlap = similarity(existingNormalized, normalized);
    if (overlap >= threshold) return true;
  }

  return false;
}

function similarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
