"use client";

import type { Grade } from "@/lib/sm2";

interface Props {
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: "again", label: "Again", hint: "1" },
  { grade: "hard", label: "Hard", hint: "2" },
  { grade: "good", label: "Good", hint: "3" },
  { grade: "easy", label: "Easy", hint: "4" },
];

export function GradeButtons({ onGrade, disabled = false }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map(({ grade, label, hint }) => (
        <button
          key={grade}
          onClick={() => onGrade(grade)}
          disabled={disabled}
          className="cursor-pointer rounded-md border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {label}
          <span className="ml-1 text-[10px] text-muted-foreground/60">{hint}</span>
        </button>
      ))}
    </div>
  );
}
