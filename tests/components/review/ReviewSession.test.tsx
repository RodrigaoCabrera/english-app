import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewSession } from "@/components/review/ReviewSession";
import type { DueWord } from "@/services/srs";

function card(word: string): DueWord {
  return {
    word,
    level: "B2",
    dueDate: new Date(),
    definition: `${word} definition`,
    translation: `${word}-es`,
    imageHash: null,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: vi.fn() });
  vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; constructor(public text: string) {} });
});

describe("ReviewSession", () => {
  it("shows the empty state when there are no due words", () => {
    render(<ReviewSession initialWords={[]} />);
    expect(screen.getByText(/no words due/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reading/i })).toHaveAttribute("href", "/reading");
  });

  it("shows progress and reveals the answer, then the grade buttons", () => {
    render(<ReviewSession initialWords={[card("alpha"), card("beta")]} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /good/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    expect(screen.getByRole("button", { name: /good/i })).toBeInTheDocument();
  });

  it("POSTs the grade and advances to the next card", async () => {
    render(<ReviewSession initialWords={[card("alpha"), card("beta")]} />);
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/srs/review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ word: "alpha", grade: "good" }),
      })
    );
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
  });

  it("shows the completion screen after the last card", async () => {
    render(<ReviewSession initialWords={[card("alpha")]} />);
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(await screen.findByText(/reviewed 1 word/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
  });

  it("keeps the card and shows an error when the POST fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ success: false }) });
    render(<ReviewSession initialWords={[card("alpha"), card("beta")]} />);
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("advances on a 404 (word already out of the queue)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ success: false }) });
    render(<ReviewSession initialWords={[card("alpha"), card("beta")]} />);
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
  });
});
