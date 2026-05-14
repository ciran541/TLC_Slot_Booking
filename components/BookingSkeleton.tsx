// Skeleton loader that matches the booking page layout
export function BookingSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Greeting */}
      <div className="space-y-2">
        <div className="h-4 w-16 rounded bg-[#e8e8e2]" />
        <div className="h-7 w-40 rounded bg-[#e8e8e2]" />
      </div>

      {/* Date row */}
      <div className="space-y-3">
        <div className="h-3 w-12 rounded bg-[#e8e8e2]" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[72px] w-[60px] rounded-lg bg-[#e8e8e2]" />
          ))}
        </div>
      </div>

      {/* Time slots */}
      <div className="space-y-3">
        <div className="h-3 w-10 rounded bg-[#e8e8e2]" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-24 rounded-lg bg-[#e8e8e2]" />
          ))}
        </div>
      </div>

      {/* Button */}
      <div className="h-12 w-full rounded-lg bg-[#e8e8e2]" />
    </div>
  );
}
