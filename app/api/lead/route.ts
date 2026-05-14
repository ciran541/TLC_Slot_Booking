import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/lead?name=John
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Name parameter is required" }, { status: 400 });
  }

  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("id, name, email, phone")
    .ilike("name", `%${name}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !leads || leads.length === 0) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ lead: leads[0] });
}
