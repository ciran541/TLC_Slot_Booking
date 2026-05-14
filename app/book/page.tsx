"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Lead, TimeSlot } from "@/lib/types";
import { DateCard } from "@/components/DateCard";
import { TimeSlotButton } from "@/components/TimeSlotButton";
import { BookingSkeleton } from "@/components/BookingSkeleton";

// ─── Stage machine ────────────────────────────────────────────────────────────
// "identify"  → no phone in URL, show name/email/phone form
// "loading"   → fetching lead + slots
// "ready"     → slot picker
// "confirmed" → booking complete
// "error"     → unrecoverable error
type Stage = "identify" | "loading" | "ready" | "confirmed" | "error";

interface BookingState {
  lead: Lead | null;
  slotsByDate: Record<string, TimeSlot[]>;
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  stage: Stage;
  errorMessage: string;
  isBooking: boolean;
}

// ─── Walk-in form state ───────────────────────────────────────────────────────
interface IdentifyForm {
  name: string;
  email: string;
  phone: string;
  error: string;
  loading: boolean;
}

export default function BookingPage() {
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";

  const [state, setState] = useState<BookingState>({
    lead: null,
    slotsByDate: {},
    selectedDate: null,
    selectedSlot: null,
    stage: "loading",
    errorMessage: "",
    isBooking: false,
  });

  const [form, setForm] = useState<IdentifyForm>({
    name: "",
    email: "",
    phone: "",
    error: "",
    loading: false,
  });

  // ─── Fetch data ────────────────────────────────────────────────────────────
  const loadData = useCallback((phoneNumber: string) => {
    setState((s) => ({ ...s, stage: "loading" }));

    if (phoneNumber) {
      Promise.all([
        fetch(`/api/lead?phone=${encodeURIComponent(phoneNumber)}`)
          .then((r) => r.json())
          .catch(() => ({ error: "Network error" })),
        fetch("/api/slots").then((r) => r.json()),
      ])
        .then(([leadRes, slotsRes]) => {
          const dates = Object.keys(slotsRes.slots ?? {});

          if (leadRes.error || !leadRes.lead) {
            // Gracefully fallback to walk-in flow but pre-fill phone
            setForm((f) => ({ ...f, phone: phoneNumber }));
            setState((s) => ({
              ...s,
              lead: null,
              slotsByDate: slotsRes.slots ?? {},
              selectedDate: dates[0] ?? null,
              stage: "ready",
            }));
            return;
          }

          // Valid lead found, pre-fill form
          setForm((f) => ({
            ...f,
            name: leadRes.lead.name ?? "",
            email: leadRes.lead.email ?? "",
            phone: leadRes.lead.phone ?? phoneNumber,
          }));

          setState((s) => ({
            ...s,
            lead: leadRes.lead,
            slotsByDate: slotsRes.slots ?? {},
            selectedDate: dates[0] ?? null,
            stage: "ready",
          }));
        })
        .catch(() => {
          setState((s) => ({
            ...s,
            stage: "error",
            errorMessage: "Something went wrong. Please try again or contact us directly.",
          }));
        });
    } else {
      fetch("/api/slots")
        .then((r) => r.json())
        .then((slotsRes) => {
          const dates = Object.keys(slotsRes.slots ?? {});
          setState((s) => ({
            ...s,
            lead: null,
            slotsByDate: slotsRes.slots ?? {},
            selectedDate: dates[0] ?? null,
            stage: "ready",
          }));
        })
        .catch(() => {
          setState((s) => ({
            ...s,
            stage: "error",
            errorMessage: "Failed to load available slots. Please try again.",
          }));
        });
    }
  }, []);

  // ─── Auto-load ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadData(phone);
  }, [phone, loadData]);

  // ─── Walk-in form submit ───────────────────────────────────────────────────
  const handleWalkInSubmit = useCallback(async () => {
    if (!state.selectedSlot) return;

    setForm((f) => ({ ...f, error: "", loading: true }));

    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setForm((f) => ({ ...f, loading: false, error: data.error ?? "Please check your details and try again." }));
        return;
      }

      const newLead = data.lead;
      setState((s) => ({ ...s, lead: newLead }));

      // Immediately book the slot
      const bookRes = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newLead.phone,
          slot_start: state.selectedSlot!.start,
          slot_end: state.selectedSlot!.end,
        }),
      });

      const bookData = await bookRes.json();

      if (!bookRes.ok) {
        setForm((f) => ({ ...f, loading: false, error: bookData.error ?? "Booking failed. The slot may have been taken." }));
        return;
      }

      setForm((f) => ({ ...f, loading: false }));
      setState((s) => ({
        ...s,
        stage: "confirmed",
      }));
    } catch {
      setForm((f) => ({
        ...f,
        loading: false,
        error: "Network error. Please check your connection and try again.",
      }));
    }
  }, [form.name, form.email, form.phone, state.selectedSlot]);

  // ─── Slot selection ────────────────────────────────────────────────────────
  const selectDate = useCallback((dateKey: string) => {
    setState((s) => ({ ...s, selectedDate: dateKey, selectedSlot: null }));
  }, []);

  const selectSlot = useCallback((slot: TimeSlot) => {
    setState((s) => ({ ...s, selectedSlot: slot }));
  }, []);



  const {
    lead, slotsByDate, selectedDate, selectedSlot,
    stage, errorMessage, isBooking,
  } = state;
  const firstName = lead?.name?.split(" ")[0] ?? "";
  const availableDates = Object.keys(slotsByDate);
  const slotsForSelectedDate = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];

  // ─── RENDER: Confirmed ─────────────────────────────────────────────────────
  if (stage === "confirmed" && selectedSlot) {
    return (
      <Shell>
        <div className="space-y-8">
          <div className="w-10 h-10 rounded-full bg-[#052d4a] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3.5 9.5L7 13L14.5 5.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold tracking-widest text-[#a8a8a0] uppercase">Booking Confirmed</p>
            <h1 className="text-2xl font-semibold text-[#052d4a] tracking-tight text-balance">
              You&rsquo;re all set{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="text-[15px] text-[#39353d] leading-relaxed">
              A confirmation has been sent to your email.
            </p>
          </div>

          <div className="rounded-xl border border-[#e8e8e2] bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0ea]">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[#a8a8a0] mb-1">Date</p>
              <p className="text-sm font-medium text-[#052d4a]">
                {format(parseISO(selectedSlot.start), "EEEE, d MMMM yyyy")}
              </p>
            </div>
            <div className="px-5 py-4 border-b border-[#f0f0ea]">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[#a8a8a0] mb-1">Time</p>
              <p className="text-sm font-medium text-[#052d4a]">{selectedSlot.label} (Singapore Time)</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[#a8a8a0] mb-1">Duration</p>
              <p className="text-sm font-medium text-[#052d4a]">45 minutes</p>
            </div>
          </div>

          <p className="text-xs text-[#a8a8a0] leading-relaxed">
            To reschedule, please reply to your confirmation email.
          </p>
        </div>
      </Shell>
    );
  }

  // ─── RENDER: Error ─────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <Shell>
        <div className="space-y-6">
          <div className="w-10 h-10 rounded-full border border-[#e8e8e2] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 5v5M9 12.5v.5" stroke="#39353d" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-[#052d4a] tracking-tight">Something went wrong</h1>
            <p className="text-[15px] text-[#39353d] leading-relaxed">{errorMessage}</p>
          </div>
          <button
            onClick={() => setState((s) => ({ ...s, stage: phone ? "loading" : "identify", errorMessage: "" }))}
            className="text-sm text-[#052d4a] underline underline-offset-2 cursor-pointer"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  // ─── RENDER: Loading ───────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <Shell>
        <BookingSkeleton />
      </Shell>
    );
  }

  // ─── RENDER: Identify (walk-in — no phone in URL) ─────────────────────────
  if (stage === "identify") {
    return (
      <Shell>
        <div className="space-y-9">

          {/* Header */}
          <div className="space-y-1 relative">
            <button
              onClick={() => setState((s) => ({ ...s, stage: "ready" }))}
              className="absolute -top-6 -left-2 text-[#39353d] hover:text-[#052d4a] text-sm flex items-center gap-1 transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <p className="text-[11px] font-semibold tracking-widest text-[#a8a8a0] uppercase">
              The Loan Connection
            </p>
            <h1 className="text-2xl font-semibold text-[#052d4a] tracking-tight text-balance">
              {state.lead ? "Confirm Your Details" : "Your Details"}
            </h1>
            <p className="text-[15px] text-[#39353d] leading-relaxed">
              {state.lead
                ? "Please confirm or update your details for the booking."
                : "Please enter your details to confirm your booking."}
            </p>
          </div>

          <div className="h-px bg-[#f0f0ea]" />

          {selectedSlot && (
            <div className="rounded-lg border border-[#e8e8e2] px-4 py-3 bg-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#f0f0ea] flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="#39353d" strokeWidth="1.25" />
                  <path d="M4 1v2M10 1v2M1 5h12" stroke="#39353d" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#052d4a]">
                  {selectedDate && format(parseISO(selectedDate), "EEE, d MMM yyyy")} &middot; {selectedSlot.label}
                </p>
                <p className="text-xs text-[#a8a8a0]">45 min · Singapore Time</p>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="identify-name" className="block text-[11px] font-semibold tracking-widest uppercase text-[#a8a8a0]">
                Full Name
              </label>
              <input
                id="identify-name"
                type="text"
                autoComplete="name"
                placeholder="John Tan"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-[#e8e8e2] bg-white text-[15px] text-[#052d4a] placeholder:text-[#c8c8c0] focus:outline-none focus:border-[#052d4a] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="identify-email" className="block text-[11px] font-semibold tracking-widest uppercase text-[#a8a8a0]">
                Email Address
              </label>
              <input
                id="identify-email"
                type="email"
                autoComplete="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-[#e8e8e2] bg-white text-[15px] text-[#052d4a] placeholder:text-[#c8c8c0] focus:outline-none focus:border-[#052d4a] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="identify-phone" className="block text-[11px] font-semibold tracking-widest uppercase text-[#a8a8a0]">
                Mobile Number
              </label>
              <input
                id="identify-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+65 9123 4567"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleWalkInSubmit(); }}
                className="w-full px-4 py-3 rounded-lg border border-[#e8e8e2] bg-white text-[15px] text-[#052d4a] placeholder:text-[#c8c8c0] focus:outline-none focus:border-[#052d4a] transition-colors"
              />
            </div>

            {form.error && (
              <p className="text-sm text-red-500 leading-relaxed">{form.error}</p>
            )}

            <button
              id="identify-submit"
              onClick={handleWalkInSubmit}
              disabled={form.loading || !form.name.trim() || !form.email.trim() || !form.phone.trim()}
              className={[
                "w-full py-3.5 rounded-lg text-sm font-semibold tracking-wide transition-all duration-150 mt-2",
                form.loading || !form.name.trim() || !form.email.trim() || !form.phone.trim()
                  ? "bg-[#e8e8e2] text-[#a8a8a0] cursor-not-allowed"
                  : "bg-[#052d4a] text-white hover:bg-[#03a9e7] active:scale-[0.99] cursor-pointer",
              ].join(" ")}
            >
              {form.loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Loading…
                </span>
              ) : (
                "Confirm Booking"
              )}
            </button>
          </div>

          <p className="text-xs text-[#a8a8a0] leading-relaxed">
            Your details are used solely to personalise your booking. We do not share them.
          </p>
        </div>
      </Shell>
    );
  }

  // ─── RENDER: Ready (slot picker) ───────────────────────────────────────────
  return (
    <Shell>
      <div className="space-y-9">

        {/* Header */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-widest text-[#a8a8a0] uppercase">
            The Loan Connection
          </p>
          <h1 className="text-2xl font-semibold text-[#052d4a] tracking-tight text-balance">
            Book Your Mortgage Consultation
          </h1>
          <p className="text-[15px] text-[#39353d] leading-relaxed">
            Select a convenient time for your complimentary consultation.
          </p>
        </div>

        <div className="h-px bg-[#f0f0ea]" />

        {/* Personalised greeting */}
        {lead && (
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-[#a8a8a0] uppercase mb-1">For</p>
            <p className="text-[17px] font-semibold text-[#052d4a]">Hi, {firstName} 👋</p>
          </div>
        )}

        {/* Date selector */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-widest text-[#a8a8a0] uppercase">Date</p>
          {availableDates.length === 0 ? (
            <p className="text-sm text-[#39353d]">No available dates. Please check back soon.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide snap-x">
              {availableDates.map((dateKey) => (
                <div key={dateKey} className="snap-start flex-shrink-0">
                  <DateCard
                    dateKey={dateKey}
                    slots={slotsByDate[dateKey]}
                    isSelected={selectedDate === dateKey}
                    onSelect={() => selectDate(dateKey)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Time slot selector */}
        {selectedDate && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-widest text-[#a8a8a0] uppercase">Time</p>
            {slotsForSelectedDate.length === 0 ? (
              <p className="text-sm text-[#39353d]">No slots available for this day.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slotsForSelectedDate.map((slot) => (
                  <TimeSlotButton
                    key={slot.start}
                    slot={slot}
                    isSelected={selectedSlot?.start === slot.start}
                    onSelect={() => selectSlot(slot)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary + confirm */}
        <div className="space-y-4 pt-2">
          {selectedSlot && (
            <div className="rounded-lg border border-[#e8e8e2] px-4 py-3 bg-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#f0f0ea] flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="#39353d" strokeWidth="1.25" />
                  <path d="M4 1v2M10 1v2M1 5h12" stroke="#39353d" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#052d4a]">
                  {selectedDate && format(parseISO(selectedDate), "EEE, d MMM yyyy")} &middot; {selectedSlot.label}
                </p>
                <p className="text-xs text-[#a8a8a0]">45 min · Singapore Time</p>
              </div>
            </div>
          )}

          <button
            onClick={() => setState((s) => ({ ...s, stage: "identify" }))}
            disabled={!selectedSlot}
            className={[
              "w-full py-3.5 rounded-lg text-sm font-semibold tracking-wide transition-all duration-150",
              !selectedSlot
                ? "bg-[#e8e8e2] text-[#a8a8a0] cursor-not-allowed"
                : "bg-[#052d4a] text-white hover:bg-[#03a9e7] active:scale-[0.99] cursor-pointer",
            ].join(" ")}
          >
            Continue →
          </button>
        </div>

        <p className="text-xs text-[#a8a8a0] leading-relaxed">
          A Google Meet link and email confirmation will be sent immediately after booking.
        </p>
      </div>
    </Shell>
  );
}

// ─── Shell layout wrapper ──────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#fafaf8] flex flex-col items-center justify-start px-5 py-12 md:py-16">
      <div className="w-full max-w-md">
        <div className="mb-10">
          <a href="/" aria-label="The Loan Connection" className="inline-block">
            <img src="https://res.cloudinary.com/dheuvrpwd/image/upload/v1750226228/TLC-logo-black_1_smqmjk.svg" alt="The Loan Connection" className="h-10 w-auto" />
          </a>
        </div>
        {children}
        <div className="h-16" />
      </div>
    </main>
  );
}
