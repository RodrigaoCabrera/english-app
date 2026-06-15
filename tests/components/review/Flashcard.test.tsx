import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Flashcard } from "@/components/review/Flashcard";
import type { DueWord } from "@/services/srs";

function card(overrides: Partial<DueWord> = {}): DueWord {
  return {
    word: "resilient",
    level: "B2",
    dueDate: new Date(),
    definition: "able to recover quickly from difficulties",
    translation: "resiliente",
    imageHash: "abc123",
    ...overrides,
  };
}

const speak = vi.fn();

beforeEach(() => {
  speak.mockReset();
  vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      lang = "";
      constructor(public text: string) {}
    }
  );
});

describe("Flashcard", () => {
  it("shows the translation on the front and hides the word before reveal", () => {
    render(<Flashcard card={card()} revealed={false} onReveal={() => {}} />);
    expect(screen.getByText("resiliente")).toBeInTheDocument();
    expect(screen.getByText(/able to recover quickly/i)).toBeInTheDocument();
    expect(screen.queryByText("resilient")).not.toBeInTheDocument();
  });

  it("falls back to the definition on the front when translation is null", () => {
    render(<Flashcard card={card({ translation: null })} revealed={false} onReveal={() => {}} />);
    expect(screen.getByText(/able to recover quickly/i)).toBeInTheDocument();
    expect(screen.queryByText("resilient")).not.toBeInTheDocument();
  });

  it("falls back to the word on the front when translation and definition are null", () => {
    render(
      <Flashcard
        card={card({ translation: null, definition: null })}
        revealed={false}
        onReveal={() => {}}
      />
    );
    expect(screen.getByText("resilient")).toBeInTheDocument();
  });

  it("reveals the word and the image when revealed", () => {
    render(<Flashcard card={card()} revealed onReveal={() => {}} />);
    expect(screen.getByText("resilient")).toBeInTheDocument();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/cache/img/abc123.png");
  });

  it("renders no image when imageHash is null", () => {
    render(<Flashcard card={card({ imageHash: null })} revealed onReveal={() => {}} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("plays audio via speechSynthesis when the audio button is clicked", () => {
    render(<Flashcard card={card()} revealed onReveal={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("calls onReveal when the front is clicked", () => {
    const onReveal = vi.fn();
    render(<Flashcard card={card()} revealed={false} onReveal={onReveal} />);
    fireEvent.click(screen.getByText("resiliente"));
    expect(onReveal).toHaveBeenCalled();
  });
});
