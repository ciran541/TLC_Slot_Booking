import crypto from "crypto";
import {
  addMinutes,
  isAfter,
  isBefore,
  parseISO,
  format,
  addDays,
} from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { TimeSlot } from "@/lib/types";

// ─── Config ───────────────────────────────────────────────────────────────────
const WORKING_HOURS_START = 10; // 10:00 AM
const WORKING_HOURS_END = 18; // 6:00 PM
const MEETING_DURATION = 45; // minutes
const BUFFER = 15; // minutes between slots
const SLOT_INTERVAL = MEETING_DURATION + BUFFER; // 60 minutes
const DAYS_AHEAD = 14; // show 2 weeks of availability
const TIME_ZONE = "Asia/Singapore";

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error("Missing Google Calendar credentials");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const toBase64Url = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const signatureInput = `${toBase64Url(header)}.${toBase64Url(claim)}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signatureInput);
  const signature = sign
    .sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    cache: "no-store", // Force realtime!
  });

  const data = await res.json();
  if (!data.access_token) {
    console.error("Google Auth Error:", data);
    throw new Error("Failed to authenticate with Google");
  }

  return data.access_token;
}

// ─── Get busy intervals from Google Calendar ──────────────────────────────────
export async function getBusySlots(
  timeMin: string,
  timeMax: string
): Promise<Array<{ start: string; end: string }>> {
  const token = await getAccessToken();
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    }),
    cache: "no-store", // Force realtime!
  });

  const data = await response.json();
  const busySlots = data.calendars?.[calendarId]?.busy ?? [];

  return busySlots.map((s: any) => ({
    start: s.start ?? "",
    end: s.end ?? "",
  }));
}

// ─── Generate all candidate slots for a given date ───────────────────────────
function generateDaySlots(dateStr: string): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  
  // Construct ISO string with explicit +08:00 offset to bypass server timezone issues
  const dayStartStr = `${dateStr}T${WORKING_HOURS_START.toString().padStart(2, "0")}:00:00+08:00`;
  const dayEndStr = `${dateStr}T${WORKING_HOURS_END.toString().padStart(2, "0")}:00:00+08:00`;
  
  const dayStart = parseISO(dayStartStr);
  const dayEnd = parseISO(dayEndStr);

  let cursor = dayStart;
  while (isBefore(addMinutes(cursor, MEETING_DURATION), dayEnd) || 
         +addMinutes(cursor, MEETING_DURATION) === +dayEnd) {
    slots.push({ start: cursor, end: addMinutes(cursor, MEETING_DURATION) });
    cursor = addMinutes(cursor, SLOT_INTERVAL);
  }
  return slots;
}

// ─── Check if a candidate slot overlaps any busy period ──────────────────────
function overlaps(
  slotStart: Date,
  slotEnd: Date,
  busySlots: Array<{ start: string; end: string }>
): boolean {
  return busySlots.some((busy) => {
    const busyStart = parseISO(busy.start);
    const busyEnd = parseISO(busy.end);
    // Overlap if slotStart < busyEnd AND slotEnd > busyStart
    return isBefore(slotStart, busyEnd) && isAfter(slotEnd, busyStart);
  });
}

// ─── Public: get available slots for the next DAYS_AHEAD weekdays ─────────────
export async function getAvailableSlots(): Promise<
  Record<string, TimeSlot[]>
> {
  const nowUtc = new Date();
  const nowSgt = toZonedTime(nowUtc, TIME_ZONE);

  const timeMin = nowUtc.toISOString();
  const timeMax = addDays(nowUtc, DAYS_AHEAD + 2).toISOString(); // Add buffer to timeMax just in case

  const busySlots = await getBusySlots(timeMin, timeMax);

  const slotsByDate: Record<string, TimeSlot[]> = {};

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const daySgt = addDays(nowSgt, i);
    const dayOfWeek = daySgt.getDay(); // 0=Sun, 6=Sat

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = format(daySgt, "yyyy-MM-dd");

    const candidates = generateDaySlots(dateStr);
    const available = candidates.filter(({ start, end }) => {
      // Skip past slots (must be at least 1 hour from now)
      if (!isAfter(start, addMinutes(nowUtc, 60))) return false;
      return !overlaps(start, end, busySlots);
    });

    if (available.length > 0) {
      slotsByDate[dateStr] = available.map(({ start, end }) => ({
        start: start.toISOString(),
        end: end.toISOString(),
        label: formatInTimeZone(start, TIME_ZONE, "h:mm a"),
      }));
    }
  }

  return slotsByDate;
}

// ─── Create a Google Calendar event ──────────────────────────────────────────
export async function createCalendarEvent(params: {
  summary: string;
  description: string;
  attendeeEmail: string;
  attendeeName: string;
  startTime: string;
  endTime: string;
}): Promise<{ eventId: string }> {
  const token = await getAccessToken();
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startTime, timeZone: "Asia/Singapore" },
      end: { dateTime: params.endTime, timeZone: "Asia/Singapore" },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 },
          { method: "popup", minutes: 15 },
        ],
      },
    }),
    cache: "no-store",
  });

  const event = await response.json();
  if (event.error) {
    console.error("Event creation error:", event.error);
    throw new Error("Failed to create Google Calendar event");
  }

  return { eventId: event.id! };
}
