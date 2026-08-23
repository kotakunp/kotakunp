import { z } from "zod";

export const postDraftCreateSchema = z.object({
  title: z.string().min(1).max(160),
});

export const postPatchSchema = z
  .object({
    title: z.string().min(1).max(160).optional(),
    slug: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")
      .optional(),
    excerpt: z.string().min(1).max(320).optional(),
    type: z.string().min(1).max(40).optional(),
    bodyMarkdown: z.string().min(1).optional(),
    status: z.enum(["draft", "published"]).optional(),
    coverMediaId: z.string().min(1).max(120).nullable().optional(),
    coverAlt: z.string().min(1).max(300).optional(),
    tags: z
      .array(z.object({ name: z.string().min(1).max(40), slug: z.string().min(1).max(40) }))
      .max(12)
      .optional(),
  })
  .strict();

export type PostPatchInput = z.infer<typeof postPatchSchema>;

export const POST_PUBLISH_REQUIREMENTS = [
  "title",
  "excerpt",
  "type",
  "bodyMarkdown",
] as const;

type PostPublishCheck = {
  title?: string;
  excerpt?: string;
  type?: string;
  bodyMarkdown?: string;
  coverMediaId?: string | null;
  coverAlt?: string | null;
  tags?: { name: string; slug: string }[];
};

export function validatePostForPublish(input: PostPublishCheck): string[] {
  const problems: string[] = [];
  if (!input.title) problems.push("title");
  if (!input.excerpt) problems.push("excerpt");
  if (!input.type) problems.push("type");
  if (!input.bodyMarkdown) problems.push("bodyMarkdown");
  if (!input.coverMediaId) problems.push("cover");
  else if (!input.coverAlt) problems.push("cover alt text");
  if (!input.tags || input.tags.length === 0) problems.push("at least one tag");
  return problems;
}
