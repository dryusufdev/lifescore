const TIME_ZONE = "America/New_York";
const SLOT_MINUTES = 60;
const CONSULTATION_TOPICS = [
  "Portfolio review",
  "Investing starter plan",
  "Roth IRA / brokerage setup",
  "Credit card wallet audit",
  "Credit score setup",
  "Tax filing after investing",
  "Budget / money plan",
  "Other",
];
const CONSULTATION_METHODS = ["Discord", "Zoom", "No preference"];
const BOOKING_INDEX_KEY = "lifescore:consultations:index";

// Production scheduling requires:
// KV_REST_API_URL or UPSTASH_REDIS_REST_URL
// KV_REST_API_TOKEN or UPSTASH_REDIS_REST_TOKEN
// RESEND_API_KEY
// LIFESCORE_FROM_EMAIL
// LIFESCORE_ADMIN_EMAIL=may23@fsu.edu
// Optional: LIFESCORE_ADVISOR_EMAILS
function storageConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function emailConfig() {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.LIFESCORE_FROM_EMAIL;
  const admin = process.env.LIFESCORE_ADMIN_EMAIL || "may23@fsu.edu";
  const advisors = String(process.env.LIFESCORE_ADVISOR_EMAILS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return resendKey && from && admin ? { resendKey, from, admin, advisors } : null;
}

function unavailableReason() {
  if (!storageConfig() || !emailConfig()) {
    console.warn("Consultation booking disabled: missing storage or email env vars.");
    return "Booking is almost ready, but scheduling is not enabled yet. You can still ask Score questions here. Once LifeScore scheduling is enabled, this flow will reserve your slot and send confirmation.";
  }
  return null;
}

async function redisCommand(args) {
  const config = storageConfig();
  if (!config) throw new Error("Persistent storage is not configured.");
  const result = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await result.json().catch(() => ({}));
  if (!result.ok || body.error) throw new Error(body.error || `Storage request failed with ${result.status}.`);
  return body.result;
}

function sendJson(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(body);
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function etParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    weekday: map.weekday,
  };
}

function zonedTimeToUtc(year, month, day, hour, minute = 0) {
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(targetUtc);
  for (let index = 0; index < 3; index += 1) {
    const parts = etParts(guess);
    const guessAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess = new Date(guess.getTime() + targetUtc - guessAsUtc);
  }
  return guess;
}

function todayEtDate() {
  const parts = etParts(new Date());
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatSlotLabel(slotIso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(slotIso));
}

function slotWindowForEtDate(year, month, day) {
  const noon = zonedTimeToUtc(year, month, day, 12);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(noon);
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  return { start: isWeekend ? 10 : 16, end: 23 };
}

function isValidSlotIso(slotIso) {
  const date = new Date(slotIso);
  if (Number.isNaN(date.getTime())) return { valid: false, reason: "Choose a valid date and time." };
  if (date <= new Date()) return { valid: false, reason: "That time has already passed." };
  const parts = etParts(date);
  if (parts.minute !== 0) return { valid: false, reason: "Consultations start on the hour only." };
  const window = slotWindowForEtDate(parts.year, parts.month, parts.day);
  if (parts.hour < window.start || parts.hour > window.end) {
    return { valid: false, reason: "That time is outside our current availability. Pick one of these open slots." };
  }
  return { valid: true, slotIso: date.toISOString() };
}

function nextWeekdayDate(targetName) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fullNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const target = fullNames.indexOf(targetName.toLowerCase());
  if (target < 0) return null;
  const today = todayEtDate();
  const todayName = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(new Date());
  const todayIndex = names.indexOf(todayName);
  let offset = (target - todayIndex + 7) % 7;
  if (offset === 0) offset = 7;
  return addDays(today, offset);
}

function parseSlotText(slotText) {
  const text = cleanText(slotText, 160).toLowerCase();
  const weekdayMatch = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!weekdayMatch || !timeMatch) return null;
  const base = nextWeekdayDate(weekdayMatch[1]);
  if (!base) return null;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || 0);
  const meridiem = timeMatch[3];
  if (hour === 12) hour = 0;
  if (meridiem === "pm") hour += 12;
  const slot = zonedTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute);
  return slot.toISOString();
}

async function bookedSlotSet() {
  const members = await redisCommand(["SMEMBERS", BOOKING_INDEX_KEY]).catch(() => []);
  return new Set(Array.isArray(members) ? members : []);
}

async function upcomingBookings() {
  const members = await redisCommand(["SMEMBERS", BOOKING_INDEX_KEY]).catch(() => []);
  if (!Array.isArray(members) || !members.length) return [];
  const bookings = [];
  for (const slotIso of members) {
    const raw = await redisCommand(["GET", `lifescore:consultations:slot:${slotIso}`]).catch(() => null);
    if (!raw) continue;
    try {
      const booking = JSON.parse(raw);
      if (new Date(booking.slotIso) > new Date()) bookings.push(booking);
    } catch {
      continue;
    }
  }
  return bookings.sort((a, b) => new Date(a.slotIso) - new Date(b.slotIso));
}

async function openSlots(limit = 8) {
  const booked = await bookedSlotSet();
  const now = new Date();
  const today = todayEtDate();
  const slots = [];
  for (let offset = 0; offset <= 14 && slots.length < limit; offset += 1) {
    const day = addDays(today, offset);
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const date = day.getUTCDate();
    const window = slotWindowForEtDate(year, month, date);
    for (let hour = window.start; hour <= window.end && slots.length < limit; hour += 1) {
      const slot = zonedTimeToUtc(year, month, date, hour, 0);
      const iso = slot.toISOString();
      if (slot <= now || booked.has(iso)) continue;
      slots.push({ iso, label: formatSlotLabel(iso) });
    }
  }
  return slots;
}

async function sendResendEmail({ to, subject, text }) {
  const config = emailConfig();
  if (!config) throw new Error("Email is not configured.");
  const recipients = Array.isArray(to) ? to : [to];
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: recipients,
      subject,
      text,
    }),
  });
  const body = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(body.message || `Resend request failed with ${result.status}.`);
  return body;
}

module.exports = {
  BOOKING_INDEX_KEY,
  CONSULTATION_METHODS,
  CONSULTATION_TOPICS,
  SLOT_MINUTES,
  TIME_ZONE,
  cleanText,
  emailConfig,
  formatSlotLabel,
  isValidEmail,
  isValidSlotIso,
  openSlots,
  parseSlotText,
  redisCommand,
  sendJson,
  sendResendEmail,
  storageConfig,
  unavailableReason,
  upcomingBookings,
};
