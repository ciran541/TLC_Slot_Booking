import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/lead?phone=6591234567
export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  // Normalize: strip spaces, dashes, and ensure it starts with a +
  let normalized = phone.replace(/[\s\-\(\)]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, name, email, phone")
    .eq("phone", normalized)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ lead });
}
