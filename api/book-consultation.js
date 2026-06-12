const crypto = require("crypto");
const {
  BOOKING_INDEX_KEY,
  CONSULTATION_METHODS,
  CONSULTATION_TOPICS,
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
  unavailableReason,
  upcomingBookings,
} = require("./consultation-utils");

function normalizeTopic(value) {
  const topic = cleanText(value, 80);
  return CONSULTATION_TOPICS.includes(topic) ? topic : "Other";
}

function normalizeMethod(value) {
  const method = cleanText(value, 40);
  return CONSULTATION_METHODS.includes(method) ? method : "No preference";
}

function scheduleText(bookings) {
  if (!bookings.length) return "No upcoming bookings after this one.";
  return bookings
    .map((booking) => `- ${formatSlotLabel(booking.slotIso)} ET: ${booking.fullName} (${booking.topic}, ${booking.callMethod})`)
    .join("\n");
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Use POST to book a LifeScore consultation." });
  }

  const unavailable = unavailableReason();
  if (unavailable) {
    return sendJson(response, 503, { booked: false, error: unavailable });
  }

  const fullName = cleanText(request.body?.fullName, 90);
  const email = cleanText(request.body?.email, 120).toLowerCase();
  const topic = normalizeTopic(request.body?.topic);
  const callMethod = normalizeMethod(request.body?.callMethod);
  const discordHandle = cleanText(request.body?.discordHandle, 80);
  const notes = cleanText(request.body?.notes, 700);
  const rawSlotIso = cleanText(request.body?.slotIso, 80);
  const rawSlotText = cleanText(request.body?.slotText, 160);

  if (fullName.length < 2) return sendJson(response, 400, { booked: false, error: "Can you send your full name first?" });
  if (!isValidEmail(email)) return sendJson(response, 400, { booked: false, error: "That email doesn't look right. Try typing it again." });
  if (callMethod === "Discord" && !discordHandle) {
    return sendJson(response, 400, { booked: false, error: "Send your Discord handle, or choose Zoom / No preference." });
  }

  const slotIso = rawSlotIso || parseSlotText(rawSlotText);
  if (!slotIso) {
    return sendJson(response, 400, {
      booked: false,
      error: "Pick one of these open slots, or type a clear time like Saturday at 11am.",
      openSlots: await openSlots(8).catch(() => []),
    });
  }

  const slotCheck = isValidSlotIso(slotIso);
  if (!slotCheck.valid) {
    return sendJson(response, 400, {
      booked: false,
      error: slotCheck.reason,
      openSlots: await openSlots(8).catch(() => []),
    });
  }

  const booking = {
    id: crypto.randomUUID(),
    fullName,
    email,
    topic,
    callMethod,
    discordHandle: callMethod === "Discord" ? discordHandle : "",
    slotIso: slotCheck.slotIso,
    slotLabel: formatSlotLabel(slotCheck.slotIso),
    notes,
    createdAt: new Date().toISOString(),
  };

  const slotKey = `lifescore:consultations:slot:${booking.slotIso}`;

  try {
    const created = await redisCommand(["SET", slotKey, JSON.stringify(booking), "NX"]);
    if (created !== "OK") {
      return sendJson(response, 409, {
        booked: false,
        error: "That slot was just taken. Pick another open time.",
        openSlots: await openSlots(8).catch(() => []),
      });
    }
    await redisCommand(["SADD", BOOKING_INDEX_KEY, booking.slotIso]);

    const bookings = await upcomingBookings();
    const emailSettings = emailConfig();
    const adminRecipients = [emailSettings.admin, ...emailSettings.advisors];
    const userBody = `Hi ${booking.fullName}, thank you for booking a free LifeScore consultation. Confirmed: ${booking.slotLabel} ET via ${booking.callMethod}. Amir will reply with next steps and the final link. Reply to this email if anything changes.`;
    const adminBody = [
      `Name: ${booking.fullName}`,
      `Email: ${booking.email}`,
      `Topic: ${booking.topic}`,
      `Preferred method: ${booking.callMethod}`,
      `Discord handle: ${booking.discordHandle || "N/A"}`,
      `Selected time: ${booking.slotLabel} ET`,
      `Notes: ${booking.notes || "N/A"}`,
      `Booking ID: ${booking.id}`,
      `Created: ${booking.createdAt}`,
      "",
      "Upcoming booking schedule:",
      scheduleText(bookings),
      "",
      "Reminder: do not treat this as tax/legal/financial advice; it is an educational session.",
    ].join("\n");

    try {
      await sendResendEmail({
        to: adminRecipients,
        subject: `New LifeScore Consultation: ${booking.fullName} - ${booking.slotLabel} ET`,
        text: adminBody,
      });
      await sendResendEmail({
        to: booking.email,
        subject: `LifeScore Consultation Confirmed - ${booking.slotLabel} ET`,
        text: userBody,
      });
    } catch (error) {
      await redisCommand(["DEL", slotKey]).catch(() => null);
      await redisCommand(["SREM", BOOKING_INDEX_KEY, booking.slotIso]).catch(() => null);
      console.error("[Book consultation] Email failed; booking rolled back.", {
        message: error?.message || "Unknown email error",
      });
      return sendJson(response, 502, {
        booked: false,
        error: "The slot was open, but confirmation email could not be sent. Try again later.",
      });
    }

    return sendJson(response, 200, {
      booked: true,
      booking: {
        id: booking.id,
        slotIso: booking.slotIso,
        slotLabel: booking.slotLabel,
        topic: booking.topic,
        callMethod: booking.callMethod,
      },
      message:
        "Perfect - you're booked. You'll get a confirmation email now, and Amir will reply with next steps and the final Discord or Zoom link. Educational only - don't send SSNs, passwords, or full account numbers.",
    });
  } catch (error) {
    console.error("[Book consultation] Failed to book.", {
      message: error?.message || "Unknown booking error",
    });
    return sendJson(response, 500, {
      booked: false,
      error: "Score could not reserve that consultation right now.",
    });
  }
};
