import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createCalendarEvent, getBusySlots } from "@/lib/calendar";
import { sendBookingConfirmation } from "@/lib/email";
import { parseISO, addMinutes, isAfter } from "date-fns";
import { BookingPayload } from "@/lib/types";

// POST /api/book
export async function POST(request: NextRequest) {
  let body: BookingPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { phone, slot_start, slot_end } = body;

  if (!phone || !slot_start || !slot_end) {
    return NextResponse.json(
      { error: "phone, slot_start and slot_end are required" },
      { status: 400 }
    );
  }

  // Normalize: strip spaces, dashes, etc.
  const normalized = phone.replace(/[\s\-\(\)]/g, "");
  const withPlus = normalized.startsWith("+") ? normalized : "+" + normalized;
  const withoutPlus = normalized.startsWith("+") ? normalized.substring(1) : normalized;

  const { data: leads, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("id, name, email, phone, source")
    .in("phone", [withPlus, withoutPlus])
    .order("created_at", { ascending: false })
    .limit(1);

  if (leadError || !leads || leads.length === 0) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const lead = leads[0];

  // ─── 2. Revalidate slot availability (prevent double booking) ───────────────
  const slotStart = parseISO(slot_start);
  const slotEnd = parseISO(slot_end);

  // Check a 1-min padded window to catch concurrent bookings
  const checkStart = addMinutes(slotStart, -1).toISOString();
  const checkEnd = addMinutes(slotEnd, 1).toISOString();

  const busySlots = await getBusySlots(checkStart, checkEnd);
  const isConflict = busySlots.some((busy) => {
    const bs = parseISO(busy.start);
    const be = parseISO(busy.end);
    return isAfter(slotEnd, bs) && isAfter(be, slotStart);
  });

  if (isConflict) {
    return NextResponse.json(
      { error: "This slot was just booked. Please choose another." },
      { status: 409 }
    );
  }

  // ─── 3. Create Google Calendar event ────────────────────────────────────────
  const { eventId } = await createCalendarEvent({
    summary: `Mortgage Consultation — ${lead.name}`,
    description: `Complimentary mortgage consultation with ${lead.name}.\n\nContact: ${lead.email} | ${lead.phone}\nSource: ${lead.source || "Unknown"}`,
    attendeeEmail: lead.email,
    attendeeName: lead.name,
    startTime: slot_start,
    endTime: slot_end,
  });

  // ─── 4. Store booking in Supabase ───────────────────────────────────────────
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .insert({
      lead_id: lead.id,
      slot_start,
      slot_end,
      status: "confirmed",
      calendar_event_id: eventId,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    console.error("[book] Failed to insert booking:", bookingError);
    return NextResponse.json(
      { error: "Failed to save booking" },
      { status: 500 }
    );
  }

  // ─── 5. Send confirmation email ─────────────────────────────────────────────
  try {
    await sendBookingConfirmation({
      to: lead.email,
      name: lead.name,
      slotStart: slot_start,
      slotEnd: slot_end,
    });
  } catch (emailErr) {
    // Non-fatal — booking still succeeded
    console.error("[book] Email send failed:", emailErr);
  }

  return NextResponse.json({
    success: true,
    bookingId: booking.id,
  });
}
