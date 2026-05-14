import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/calendar";

// GET /api/slots
// Returns available booking slots grouped by date for the next 14 weekdays
export async function GET() {
  try {
    const slots = await getAvailableSlots();
    return NextResponse.json({ slots }, {
      headers: {
        // Cache for 2 minutes — short enough to stay fresh, long enough for perf
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[slots] Error fetching available slots:", err);
    return NextResponse.json(
      { error: "Failed to load available slots" },
      { status: 500 }
    );
  }
}
