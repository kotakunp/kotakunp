import { z } from "zod";

export const releaseTypeSchema = z.enum(["single", "ep", "album", "ost"]);

export const releaseDraftCreateSchema = z.object({
  title: z.string().min(1).max(160),
  englishTitle: z.string().min(1).max(160).optional(),
});

export const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "Must be an HTTPS URL");

export const releasePatchSchema = z
  .object({
    title: z.string().min(1).max(160).optional(),
    englishTitle: z.string().min(1).max(160).optional(),
    slug: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")
      .optional(),
    type: releaseTypeSchema.optional(),
    descriptionMarkdown: z.string().min(1).max(2000).optional(),
    status: z.enum(["draft", "published"]).optional(),
    coverMediaId: z.string().min(1).max(120).nullable().optional(),
    coverAlt: z.string().min(1).max(300).optional(),
    releaseDate: z.string().datetime().nullable().optional(),
    duuToUrl: httpsUrl.nullable().optional(),
    youtubeUrl: httpsUrl.nullable().optional(),
    spotifyUrl: httpsUrl.nullable().optional(),
    appleMusicUrl: httpsUrl.nullable().optional(),
  })
  .strict();

export type ReleasePatchInput = z.infer<typeof releasePatchSchema>;

export const trackCreateSchema = z
  .object({
    title: z.string().min(1).max(160),
    englishTitle: z.string().min(1).max(160).nullable().optional(),
    lyricsMarkdown: z.string().max(20_000).nullable().optional(),
    audioMediaId: z.string().min(1).max(120).nullable().optional(),
    audioKind: z.enum(["none", "preview", "full"]).optional(),
  })
  .strict();

export const trackPatchSchema = trackCreateSchema.partial();

export const trackReorderSchema = z
  .object({
    trackIds: z.array(z.string().uuid()).min(1),
  })
  .strict();

export function validateReleaseForPublish(input: {
  title?: string;
  englishTitle?: string;
  slug: string;
  type?: "single" | "ep" | "album" | "ost" | null;
  releaseDate?: string | Date | null;
  descriptionMarkdown?: string;
  coverMediaId?: string | null;
  coverAlt?: string | null;
}): string[] {
  const problems: string[] = [];
  if (!input.title) problems.push("title");
  if (!input.englishTitle) problems.push("englishTitle");
  if (!input.slug) problems.push("slug");
  if (!input.type) problems.push("type");
  if (!input.releaseDate) problems.push("releaseDate");
  if (!input.descriptionMarkdown) problems.push("descriptionMarkdown");
  if (!input.coverMediaId) problems.push("cover");
  else if (!input.coverAlt) problems.push("cover alt text");
  return problems;
}

export function validateTrackAudioConsistency(
  audioKind: "none" | "preview" | "full",
  audioMediaId: string | null | undefined,
): boolean {
  if (audioKind === "none") return !audioMediaId;
  return Boolean(audioMediaId);
}
