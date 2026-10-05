/**
 * Typo-tolerant keyword search, shared by tours and attractions.
 *
 * The catalogue is small enough to score in memory: fetch the candidate rows,
 * score each against the query, keep what clears the threshold.
 */

/** Normalize text before comparing a natural-language search query. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Small, dependency-free edit-distance implementation for typo-tolerant search. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Score how closely a query's words match the searchable tour text.
 * Exact words, prefixes, and small spelling errors all receive useful scores.
 */
export function fuzzyTextScore(query: string, text: string): number {
  const queryTokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const textTokens = normalizeSearchText(text).split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0 || textTokens.length === 0) return 0;

  const tokenScores = queryTokens.map((queryToken) => {
    let best = 0;
    for (const textToken of textTokens) {
      if (textToken === queryToken) {
        best = 1;
        break;
      }
      if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken)) {
        best = Math.max(best, 0.9);
        continue;
      }
      const maxLength = Math.max(queryToken.length, textToken.length);
      if (maxLength >= 3) {
        const similarity =
          1 - levenshteinDistance(queryToken, textToken) / maxLength;
        best = Math.max(best, similarity >= 0.65 ? similarity : 0);
      }
    }
    return best;
  });

  const matchedTokens = tokenScores.filter((score) => score > 0).length;
  const average =
    tokenScores.reduce((sum, score) => sum + score, 0) / queryTokens.length;
  const coverage = matchedTokens / queryTokens.length;
  const normalizedQuery = normalizeSearchText(query);
  const phraseBonus = normalizeSearchText(text).includes(normalizedQuery)
    ? 0.15
    : 0;

  return Math.min(1, average * 0.7 + coverage * 0.3 + phraseBonus);
}
