import { google } from "googleapis";
import {
  addMinutes,
  startOfDay,
  setHours,
  setMinutes,
  isAfter,
  isBefore,
  parseISO,
  format,
  addDays,
  getDay,
} from "date-fns";
import { TimeSlot } from "@/lib/types";

// ─── Config ───────────────────────────────────────────────────────────────────
const WORKING_HOURS_START = 10; // 10:00 AM
const WORKING_HOURS_END = 18; // 6:00 PM
const MEETING_DURATION = 45; // minutes
const BUFFER = 15; // minutes between slots
const SLOT_INTERVAL = MEETING_DURATION + BUFFER; // 60 minutes
const DAYS_AHEAD = 14; // show 2 weeks of availability

// ─── Auth ─────────────────────────────────────────────────────────────────────
function getCalendarAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });
  return auth;
}

// ─── Get busy intervals from Google Calendar ──────────────────────────────────
export async function getBusySlots(
  timeMin: string,
  timeMax: string
): Promise<Array<{ start: string; end: string }>> {
  const auth = getCalendarAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: process.env.GOOGLE_CALENDAR_ID! }],
    },
  });

  const busySlots =
    response.data.calendars?.[process.env.GOOGLE_CALENDAR_ID!]?.busy ?? [];

  return busySlots.map((s) => ({
    start: s.start ?? "",
    end: s.end ?? "",
  }));
}

// ─── Generate all candidate slots for a given date ───────────────────────────
function generateDaySlots(date: Date): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  const dayStart = setMinutes(
    setHours(startOfDay(date), WORKING_HOURS_START),
    0
  );
  const dayEnd = setMinutes(setHours(startOfDay(date), WORKING_HOURS_END), 0);

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
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = addDays(now, DAYS_AHEAD).toISOString();

  const busySlots = await getBusySlots(timeMin, timeMax);

  const slotsByDate: Record<string, TimeSlot[]> = {};

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = addDays(now, i);
    const dayOfWeek = getDay(day); // 0=Sun, 6=Sat

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const candidates = generateDaySlots(day);
    const available = candidates.filter(({ start, end }) => {
      // Skip past slots (with 15 min buffer)
      if (!isAfter(start, addMinutes(now, 15))) return false;
      return !overlaps(start, end, busySlots);
    });

    if (available.length > 0) {
      const dateKey = format(day, "yyyy-MM-dd");
      slotsByDate[dateKey] = available.map(({ start, end }) => ({
        start: start.toISOString(),
        end: end.toISOString(),
        label: format(start, "h:mm a"),
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
  const auth = getCalendarAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const event = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    requestBody: {
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
    },
  });

  const eventId = event.data.id!;
  
  return { eventId };
}
