import { Suspense } from "react";
import BookingPage from "./page";
import { BookingSkeleton } from "@/components/BookingSkeleton";

export const metadata = {
  title: "Book a Consultation — The Loan Connection",
  description: "Schedule your complimentary mortgage consultation.",
};

export default function BookLayout() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#fafaf8] flex flex-col items-center justify-start px-5 py-12 md:py-16">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#a8a8a0]">TLC</span>
            </div>
            <BookingSkeleton />
          </div>
        </main>
      }
    >
      <BookingPage />
    </Suspense>
  );
}
