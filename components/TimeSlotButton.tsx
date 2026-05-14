"use client";

import { TimeSlot } from "@/lib/types";

interface TimeSlotButtonProps {
  slot: TimeSlot;
  isSelected: boolean;
  onSelect: () => void;
}

export function TimeSlotButton({ slot, isSelected, onSelect }: TimeSlotButtonProps) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`Select ${slot.label}`}
      className={[
        "px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 select-none cursor-pointer",
        isSelected
          ? "bg-[#052d4a] border-[#052d4a] text-white"
          : "bg-white border-[#e8e8e2] text-[#052d4a] hover:border-[#03a9e7] hover:text-[#03a9e7]",
      ].join(" ")}
    >
      {slot.label}
    </button>
  );
}
