import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import { JournalAudio } from "./journal-audio";

export type MediaEntry = { publicPath: string; kind: "image" | "audio" };

const AUDIO_DIRECTIVE_PATTERN =
  /::audio\[([^\]]*)\]\{[^}]*id="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"[^}]*\}/g;
const TOKEN_PREFIX = "journalaudio-token-";

function preprocess(markdown: string): {
  text: string;
  tokens: Map<string, { id: string; label?: string }>;
} {
  const tokens = new Map<string, { id: string; label?: string }>();
  let index = 0;
  const text = markdown.replace(
    AUDIO_DIRECTIVE_PATTERN,
    (_match, label: string, id: string) => {
      const token = `${TOKEN_PREFIX}${index++}`;
      tokens.set(token, { id, label: label || undefined });
      return `\n\n${token}\n\n`;
    },
  );
  return { text, tokens };
}

function flattenChildren(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children
      .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
      .join("");
  }
  return String(children ?? "");
}

export function JournalMarkdown({
  markdown,
  mediaMap,
}: {
  markdown: string;
  mediaMap?: Map<string, MediaEntry>;
}) {
  const { text, tokens } = preprocess(markdown);

  function resolveAudio(id: string): string | null {
    return mediaMap?.get(id)?.publicPath ?? null;
  }

  function Paragraph({ children }: { children?: ReactNode }) {
    const text = flattenChildren(children);
    if (!text.includes(TOKEN_PREFIX)) return <p>{children}</p>;

    const parts = text.split(/(journalaudio-token-\d+)/g);
    const output: ReactNode[] = [];
    parts.forEach((part, index) => {
      if (part.startsWith(TOKEN_PREFIX)) {
        const token = tokens.get(part);
        const src = token ? resolveAudio(token.id) : null;
        output.push(
          src ? (
            <JournalAudio key={index} src={src} title={token?.label} />
          ) : (
            <p key={index} className="media-unavailable">
              [media unavailable]
            </p>
          ),
        );
        return;
      }
      if (part.trim().length > 0) output.push(<p key={index}>{part}</p>);
    });
    return <>{output}</>;
  }

  return (
    <div className="mdx-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: Paragraph }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
