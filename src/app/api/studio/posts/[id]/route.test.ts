import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

process.env.STUDIO_SESSION_SECRET = Buffer.alloc(32, 7).toString("base64");
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

import { openContentDatabase, closeContentDatabase } from "@/db/client";
import { applyMigrations } from "@/db/migrate";
import { createSessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME_DEVELOPMENT } from "@/lib/auth/request";
import { DELETE, GET, PATCH } from "@/app/api/studio/posts/[id]/route";
import { POST as POST_COLLECTION } from "@/app/api/studio/posts/route";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kotakunp-post-route-"));
process.env.CONTENT_DATABASE_PATH = path.join(tempDir, "content.sqlite");

beforeAll(() => {
  const sqlite = openContentDatabase(process.env.CONTENT_DATABASE_PATH!, {
    allowCreate: true,
  });
  applyMigrations(sqlite);
  sqlite.close();
});

afterAll(() => {
  closeContentDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { origin: process.env.NEXT_PUBLIC_SITE_URL!, ...extra };
}

async function withAuth<T>(run: (cookie: string) => Promise<T>): Promise<T> {
  const token = await createSessionToken();
  return run(`${SESSION_COOKIE_NAME_DEVELOPMENT}=${token}`);
}

async function seedPost(): Promise<{ id: string; title: string }> {
  return withAuth(async (cookie) => {
    const title = `Seed post ${crypto.randomUUID().slice(0, 8)}`;
    const response = await POST_COLLECTION(
      new Request("http://localhost:3000/api/studio/posts", {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json", cookie }),
        body: JSON.stringify({ title }),
      }),
    );
    const body = (await response.json()) as {
      data: { post: { id: string } | null };
    };
    if (!body.data) throw new Error(`seed failed: ${JSON.stringify(body)}`);
    return { id: body.data.post!.id, title };
  });
}

function patchRequest(postId: string, cookie: string, payload: unknown): Request {
  return new Request(`http://localhost:3000/api/studio/posts/${postId}`, {
    method: "PATCH",
    headers: authHeaders({ "content-type": "application/json", cookie }),
    body: JSON.stringify(payload),
  });
}

describe("post route handlers", () => {
  let seeded: { id: string; title: string };

  beforeEach(async () => {
    seeded = await seedPost();
  });

  it("patches a post through the synchronous transaction and persists tags", async () => {
    await withAuth(async (cookie) => {
      const response = await PATCH(
        patchRequest(seeded.id, cookie, {
          excerpt: "Now has an excerpt",
          type: "studio note",
          bodyMarkdown: "Body text with words",
          tags: [{ name: "process", slug: "process" }],
        }),
        { params: Promise.resolve({ id: seeded.id }) },
      );
      expect(response.status).toBe(200);

      const detail = await GET(
        new Request(`http://localhost:3000/api/studio/posts/${seeded.id}`, {
          headers: { cookie },
        }),
        { params: Promise.resolve({ id: seeded.id }) },
      );
      const payload = (await detail.json()) as {
        data: { post: { excerpt: string }; tags: { slug: string }[] };
      };
      expect(payload.data.post.excerpt).toBe("Now has an excerpt");
      expect(payload.data.tags.map((tag) => tag.slug)).toEqual(["process"]);
    });
  });

  it("syncs markdown-referenced media into journal_post_media", async () => {
    await withAuth(async (cookie) => {
      const mediaId = "11111111-2222-4333-8444-555555555555";
      const { getDb: getDbEarly } = await import("@/db/client");
      getDbEarly().insert((await import("@/db/schema")).media)
        .values({
          id: mediaId,
          kind: "image",
          originalName: "shot.png",
          storageKey: `images/${mediaId}.png`,
          publicPath: `/media/${mediaId}/shot.png`,
          mimeType: "image/png",
          byteSize: 10,
          source: "upload",
          createdAt: new Date(),
        })
        .run();
      const response = await PATCH(
        patchRequest(seeded.id, cookie, {
          bodyMarkdown: `![shot](/media/${mediaId}/shot.png)\n::audio[Take]{id="${mediaId}"}`,
        }),
        { params: Promise.resolve({ id: seeded.id }) },
      );
      expect(response.status).toBe(200);

      const { getDb } = await import("@/db/client");
      const joined = getDb()
        .select()
        .from((await import("@/db/schema")).journalPostMedia)
        .all() as unknown as { postId: string; mediaId: string }[];
      expect(joined).toHaveLength(1);
      expect(joined[0].mediaId).toBe(mediaId);
    });
  });

  it("rejects publishing an incomplete draft with field-level problems", async () => {
    await withAuth(async (cookie) => {
      const response = await PATCH(
        patchRequest(seeded.id, cookie, { status: "published" }),
        { params: Promise.resolve({ id: seeded.id }) },
      );
      expect(response.status).toBe(422);
      const payload = (await response.json()) as {
        error: { code: string; fields: Record<string, string> };
      };
      expect(payload.error.code).toBe("publish_requirements");
      expect(payload.error.fields.excerpt).toBeTruthy();
    });
  });

  it("re-validates a published post when a later patch removes required fields", async () => {
    await withAuth(async (cookie) => {
      const coverId = "22222222-3333-4333-8444-666666666666";
      const { getDb: getDbEarly } = await import("@/db/client");
      getDbEarly().insert((await import("@/db/schema")).media)
        .values({
          id: coverId,
          kind: "image",
          originalName: "cover.webp",
          storageKey: `images/${coverId}.webp`,
          publicPath: `/media/${coverId}/cover.webp`,
          mimeType: "image/webp",
          byteSize: 10,
          alt: "Cover art",
          source: "upload",
          createdAt: new Date(),
        })
        .run();
      const first = await PATCH(
        patchRequest(seeded.id, cookie, {
          excerpt: "Complete",
          type: "studio note",
          bodyMarkdown: "Full body",
          coverMediaId: coverId,
          tags: [{ name: "x", slug: "x" }],
          status: "published",
        }),
        { params: Promise.resolve({ id: seeded.id }) },
      );
      if (first.status !== 200) console.log("FIRST:", await first.clone().text());
      expect(first.status).toBe(200);

      const second = await PATCH(
        patchRequest(seeded.id, cookie, { excerpt: "" }),
        { params: Promise.resolve({ id: seeded.id }) },
      );
      expect(second.status).toBe(400);
    });
  });

  it("requires matching confirmTitle on delete", async () => {
    await withAuth(async (cookie) => {
      const wrong = await DELETE(
        new Request(`http://localhost:3000/api/studio/posts/${seeded.id}`, {
          method: "DELETE",
          headers: authHeaders({ "content-type": "application/json", cookie }),
          body: JSON.stringify({ confirmTitle: "nope" }),
        }),
        { params: Promise.resolve({ id: seeded.id }) },
      );
      expect(wrong.status).toBe(422);

      const right = await DELETE(
        new Request(`http://localhost:3000/api/studio/posts/${seeded.id}`, {
          method: "DELETE",
          headers: authHeaders({ "content-type": "application/json", cookie }),
          body: JSON.stringify({ confirmTitle: seeded.title }),
        }),
        { params: Promise.resolve({ id: seeded.id }) },
      );
      expect(right.status).toBe(200);
    });
  });
});
