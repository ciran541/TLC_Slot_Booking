"use client";

import { format, parseISO } from "date-fns";
import { TimeSlot } from "@/lib/types";

interface DateCardProps {
  dateKey: string; // "yyyy-MM-dd"
  slots: TimeSlot[];
  isSelected: boolean;
  onSelect: () => void;
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DateCard({ dateKey, slots, isSelected, onSelect }: DateCardProps) {
  const date = parseISO(dateKey);
  const dayName = DAY_ABBR[date.getDay()];
  const dayNum = format(date, "d");
  const monthAbbr = format(date, "MMM");

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${dayName} ${dayNum} ${monthAbbr}, ${slots.length} slot${slots.length !== 1 ? "s" : ""} available`}
      className={[
        "flex flex-col items-center gap-0.5 rounded-lg px-3 py-3 min-w-[60px] transition-all duration-150 select-none",
        "border text-sm font-medium cursor-pointer",
        isSelected
          ? "bg-[#052d4a] border-[#052d4a] text-white"
          : "bg-white border-[#e8e8e2] text-[#052d4a] hover:border-[#03a9e7] hover:text-[#03a9e7]",
      ].join(" ")}
    >
      <span className={`text-[10px] font-semibold tracking-widest uppercase ${isSelected ? "opacity-60" : "text-[#a8a8a0]"}`}>
        {dayName}
      </span>
      <span className="text-xl font-semibold leading-none">{dayNum}</span>
      <span className={`text-[11px] ${isSelected ? "opacity-70" : "text-[#6b6b63]"}`}>
        {monthAbbr}
      </span>
    </button>
  );
}
