import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/calendar";

export const dynamic = 'force-dynamic';

// GET /api/slots
// Returns available booking slots grouped by date for the next 14 weekdays
export async function GET() {
  try {
    const slots = await getAvailableSlots();
    return NextResponse.json({ slots });
  } catch (err) {
    console.error("[slots] Error fetching available slots:", err);
    return NextResponse.json(
      { error: "Failed to load available slots" },
      { status: 500 }
    );
  }
}
