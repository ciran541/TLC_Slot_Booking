// ─── Shared TypeScript types ──────────────────────────────────────────────────

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  lead_id: string;
  slot_start: string; // ISO 8601
  slot_end: string; // ISO 8601
  status: "confirmed" | "cancelled";
  calendar_event_id?: string;
  created_at: string;
}

export interface TimeSlot {
  start: string; // ISO 8601
  end: string; // ISO 8601
  label: string; // e.g. "10:00 AM"
}

export interface BookingPayload {
  phone: string;
  slot_start: string;
  slot_end: string;
}

export interface SyncLeadPayload {
  name: string;
  email: string;
  phone: string;
  source?: string;
}
