export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchText(query)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

export function scoreSearchFields({
  tokens,
  fields,
  primaryFields = [],
}: {
  tokens: string[];
  fields: unknown[];
  primaryFields?: unknown[];
}): number {
  if (tokens.length === 0) return 1;

  const normalizedFields = fields
    .map(normalizeSearchText)
    .filter(Boolean);
  const normalizedPrimaryFields = primaryFields
    .map(normalizeSearchText)
    .filter(Boolean);
  const haystack = normalizedFields.join(' ');
  const compactHaystack = haystack.replace(/\s+/g, '');

  let score = 0;
  for (const token of tokens) {
    const compactToken = token.replace(/\s+/g, '');
    const matchesToken =
      haystack.includes(token) ||
      (!!compactToken && compactHaystack.includes(compactToken));

    if (!matchesToken) return -1;

    if (normalizedPrimaryFields.some((field) => field === token)) {
      score += 100;
    } else if (normalizedPrimaryFields.some((field) => field.startsWith(token))) {
      score += 70;
    } else if (normalizedPrimaryFields.some((field) => field.includes(token))) {
      score += 45;
    } else if (normalizedFields.some((field) => field.startsWith(token))) {
      score += 30;
    } else {
      score += 15;
    }
  }

  return score;
}

export function filterBySearchScore<T>(
  items: T[],
  query: string,
  buildFields: (item: T) => { fields: unknown[]; primaryFields?: unknown[] }
): T[] {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return items;

  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreSearchFields({ tokens, ...buildFields(item) }),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
