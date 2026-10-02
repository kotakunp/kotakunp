const READING_TIME_WPM = 220;

export function countMarkdownWords(markdown: string): number {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, " ");
  const withoutDirectives = withoutFences.replace(
    /::[a-z]+\[[^\]]*\]\{[^}]*\}/g,
    " ",
  );
  const withoutImages = withoutDirectives.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  const withoutLinkSyntax = withoutImages.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const matches = withoutLinkSyntax.match(/[^\s]+/g);
  return matches ? matches.length : 0;
}

export function readingTimeMinutes(markdown: string): number {
  const words = countMarkdownWords(markdown);
  return Math.max(1, Math.ceil(words / READING_TIME_WPM));
}