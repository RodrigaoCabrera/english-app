"use client";

import { useMemo, type ElementType } from "react";
import { WordTooltip } from "@/components/WordTooltip";
import type { CefrLevel } from "@/lib/cefr";

interface Props {
  markdown: string;
  keyWords: string[];
  level: CefrLevel;
}

type Block =
  | { type: "heading"; depth: 1 | 2 | 3 | 4 | 5 | 6; tokens: string[] }
  | { type: "paragraph"; tokens: string[] };

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1");
}

// Splits text into word-tokens and separator-tokens (whitespace, punctuation)
function tokenize(text: string): string[] {
  return text.split(/(\s+|[,;:!?.'"()[\]–—-]+)/);
}

function normalizeWord(token: string): string {
  return token.toLowerCase().replace(/[^a-z]/g, "");
}

function parseBlocks(markdown: string): Block[] {
  return markdown
    .split(/\n\n+/)
    .map((para): Block | null => {
      const trimmed = para.trim();
      if (!trimmed) return null;

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        const depth = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
        const content = stripInlineMarkdown(headingMatch[2]);
        return { type: "heading", depth, tokens: tokenize(content) };
      }

      const content = stripInlineMarkdown(trimmed);
      return { type: "paragraph", tokens: tokenize(content) };
    })
    .filter((b): b is Block => b !== null);
}

function renderTokens(
  tokens: string[],
  keyWordSet: Set<string>,
  level: CefrLevel
) {
  return tokens.map((token, i) => {
    const norm = normalizeWord(token);
    if (norm && keyWordSet.has(norm)) {
      return (
        <WordTooltip key={i} word={norm} displayWord={token} level={level} />
      );
    }
    return <span key={i}>{token}</span>;
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-2xl font-bold mt-4 mb-2",
  2: "text-xl font-semibold mt-4 mb-2",
  3: "text-lg font-semibold mt-3 mb-1",
  4: "text-base font-semibold mt-2",
  5: "text-sm font-semibold mt-2",
  6: "text-sm font-medium mt-2",
};

const HEADING_TAGS: Record<number, ElementType> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
};

export function HoverableText({ markdown, keyWords, level }: Props) {
  const keyWordSet = useMemo(
    () => new Set(keyWords.map((w) => w.toLowerCase())),
    [keyWords]
  );

  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);

  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const Tag = HEADING_TAGS[block.depth];
          return (
            <Tag key={i} className={HEADING_CLASS[block.depth]}>
              {renderTokens(block.tokens, keyWordSet, level)}
            </Tag>
          );
        }
        return (
          <p key={i} className="text-base">
            {renderTokens(block.tokens, keyWordSet, level)}
          </p>
        );
      })}
    </div>
  );
}
