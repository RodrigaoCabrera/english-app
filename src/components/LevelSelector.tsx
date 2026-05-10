"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";

const STORAGE_KEY = "english-app:level";

interface Props {
  onChange?: (level: CefrLevel) => void;
}

export function LevelSelector({ onChange }: Props) {
  const [level, setLevel] = useState<CefrLevel>("B1");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as CefrLevel | null;
    if (stored && (CEFR_LEVELS as readonly string[]).includes(stored)) {
      setLevel(stored);
      onChange?.(stored);
    }
  }, []);

  function handleChange(value: string) {
    const newLevel = value as CefrLevel;
    setLevel(newLevel);
    localStorage.setItem(STORAGE_KEY, newLevel);
    onChange?.(newLevel);
  }

  return (
    <Select value={level} onValueChange={handleChange}>
      <SelectTrigger className="w-24">
        <SelectValue placeholder="Level" />
      </SelectTrigger>
      <SelectContent>
        {CEFR_LEVELS.map((l) => (
          <SelectItem key={l} value={l}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
