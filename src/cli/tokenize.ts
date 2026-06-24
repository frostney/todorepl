type QuoteChar = "'" | '"';

const isWhitespace = (ch: string): boolean => ch === " " || ch === "\t";
const isQuote = (ch: string): ch is QuoteChar => ch === "'" || ch === '"';

export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let buffer = "";
  let hasToken = false;
  let quote: QuoteChar | null = null;

  for (const ch of line) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        buffer += ch;
      }
      continue;
    }

    if (isQuote(ch)) {
      quote = ch;
      hasToken = true;
      continue;
    }

    if (isWhitespace(ch)) {
      if (hasToken) {
        tokens.push(buffer);
        buffer = "";
        hasToken = false;
      }
      continue;
    }

    buffer += ch;
    hasToken = true;
  }

  if (hasToken) {
    tokens.push(buffer);
  }

  return tokens;
}
