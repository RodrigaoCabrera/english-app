import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GradeButtons } from "@/components/review/GradeButtons";

describe("GradeButtons", () => {
  it("renders the four grades", () => {
    render(<GradeButtons onGrade={() => {}} />);
    for (const label of ["Again", "Hard", "Good", "Easy"]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("calls onGrade with the matching grade", () => {
    const onGrade = vi.fn();
    render(<GradeButtons onGrade={onGrade} />);
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(onGrade).toHaveBeenCalledWith("good");
  });

  it("disables the buttons when disabled", () => {
    const onGrade = vi.fn();
    render(<GradeButtons onGrade={onGrade} disabled />);
    fireEvent.click(screen.getByRole("button", { name: /easy/i }));
    expect(onGrade).not.toHaveBeenCalled();
  });
});
