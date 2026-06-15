"use client";

import type { DueWord } from "@/services/srs";

interface Props {
  card: DueWord;
  revealed: boolean;
  onReveal: () => void;
}

export function Flashcard({ card, revealed, onReveal }: Props) {
  // Front fallback chain: translation -> definition -> word.
  const meaning = card.translation ?? card.definition ?? card.word;
  // Definition shows as a secondary hint on the front only when the translation
  // is the primary prompt (layout B). Otherwise it is already the primary.
  const hint = card.translation ? card.definition : null;

  function playAudio() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={onReveal}
        aria-label="Reveal the word"
        className="w-full cursor-pointer rounded-lg border border-border/60 bg-card/60 p-8 text-center transition-colors hover:border-foreground/30"
      >
        <p className="font-serif text-2xl italic text-primary/90">{meaning}</p>
        {hint && (
          <p className="mt-3 text-sm text-muted-foreground">&ldquo;{hint}&rdquo;</p>
        )}
        <p className="mt-6 text-[11px] uppercase tracking-widest text-muted-foreground/60">
          Click or press Space to reveal
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-8 text-center">
      <div className="flex items-center justify-center gap-3">
        <p className="text-3xl font-semibold capitalize">{card.word}</p>
        <button
          onClick={playAudio}
          aria-label="Play pronunciation"
          className="cursor-pointer rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ▶ Play
        </button>
      </div>
      {card.translation && (
        <p className="mt-3 font-serif italic text-primary/80">{card.translation}</p>
      )}
      {card.definition && (
        <p className="mt-2 text-sm leading-snug text-muted-foreground">{card.definition}</p>
      )}
      {card.imageHash && (
        <img
          src={`/cache/img/${card.imageHash}.png`}
          alt={card.word}
          className="mx-auto mt-4 rounded-md object-cover"
          style={{ maxHeight: 160 }}
        />
      )}
    </div>
  );
}
