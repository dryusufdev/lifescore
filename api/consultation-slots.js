const {
  openSlots,
  sendJson,
  unavailableReason,
} = require("./consultation-utils");

module.exports = async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "Use GET or POST for consultation slots." });
  }

  const unavailable = unavailableReason();
  if (unavailable) {
    return sendJson(response, 503, {
      available: false,
      error: unavailable,
    });
  }

  try {
    const slots = await openSlots(8);
    return sendJson(response, 200, {
      available: true,
      timezone: "America/New_York",
      durationMinutes: 60,
      slots,
    });
  } catch (error) {
    console.error("[Consultation slots] Failed to load slots.", {
      message: error?.message || "Unknown error",
    });
    return sendJson(response, 500, {
      available: false,
      error: "Score could not load consultation times right now.",
    });
  }
};
