"use client";

interface ConfirmButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function ConfirmButton({ onClick, isLoading, disabled }: ConfirmButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={[
        "w-full py-3.5 rounded-lg text-sm font-semibold tracking-wide transition-all duration-150",
        disabled || isLoading
          ? "bg-[#e8e8e2] text-[#a8a8a0] cursor-not-allowed"
          : "bg-[#0f0f0e] text-white hover:bg-[#2e2e2a] active:scale-[0.99] cursor-pointer",
      ].join(" ")}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Confirming…
        </span>
      ) : (
        "Confirm Booking"
      )}
    </button>
  );
}
