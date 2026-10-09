// Plain-text excerpt of a news body: strips HTML tags, collapses whitespace
// and cuts at a word boundary.
export function excerpt(body: string, max = 180): string {
  const text = body
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : max)}…`;
}
