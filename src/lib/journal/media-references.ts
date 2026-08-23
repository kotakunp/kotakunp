const IMAGE_URL_PATTERN = /!\[[^\]]*\]\(\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[^)]*\)/gi;
const AUDIO_DIRECTIVE_PATTERN = /::audio\[[^\]]*\]\{[^}]*id="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"[^}]*\}/gi;

/**
 * Extract every media UUID referenced by post Markdown — inline images pointing
 * at /media/<uuid>/... and ::audio directives with an id attribute.
 */
export function extractReferencedMediaIds(markdown: string): string[] {
  const ids = new Set<string>();
  for (const match of markdown.matchAll(IMAGE_URL_PATTERN)) {
    ids.add(match[1].toLowerCase());
  }
  for (const match of markdown.matchAll(AUDIO_DIRECTIVE_PATTERN)) {
    ids.add(match[1].toLowerCase());
  }
  return [...ids];
}
