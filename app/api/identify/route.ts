import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/identify
 * Public endpoint — called from the booking page walk-in flow.
 * Upserts a lead by phone so the user can proceed to book without a pre-filled URL.
 */
export async function POST(request: NextRequest) {
  let body: { name: string; email: string; phone: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, phone } = body;

  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return NextResponse.json(
      { error: "Name, email and phone are all required." },
      { status: 400 }
    );
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Normalise phone: strip spaces/dashes/parens
  let normalizedPhone = phone.trim().replace(/[\s\-\(\)]/g, "");
  if (!normalizedPhone.startsWith("+")) {
    normalizedPhone = "+" + normalizedPhone;
  }

  // 1. Check if lead already exists
  const { data: existingLeads, error: searchError } = await supabaseAdmin
    .from("leads")
    .select("id, name, email, phone")
    .eq("phone", normalizedPhone)
    .order("created_at", { ascending: false })
    .limit(1);

  if (searchError) {
    console.error("[identify] Supabase search error:", searchError);
    return NextResponse.json({ error: "Failed to verify details. Please try again." }, { status: 500 });
  }

  if (existingLeads && existingLeads.length > 0) {
    return NextResponse.json({ lead: existingLeads[0] });
  }

  // 2. If no lead exists, insert new lead
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .insert(
      {
        name:   name.trim(),
        email:  email.trim().toLowerCase(),
        phone:  normalizedPhone,
        source: "direct_booking",
      }
    )
    .select("id, name, email, phone")
    .single();

  if (error || !lead) {
    console.error("[identify] Supabase error:", error);
    return NextResponse.json({ error: "Failed to save your details. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ lead });
}
