export const PROFESSIONS = [
  "doctor",
  "nurse",
  "paramedic",
  "engineer",
  "electrician",
  "psychologist",
  "rescuer",
  "interpreter",
  "other",
];

/** Professions that require document verification (and receive medical-SOS calls). */
export const MEDICAL_PROFESSIONS = ["doctor", "nurse", "paramedic"];

export const AVAILABILITY = ["ready", "not_ready"];
export const VERIFICATION = ["not_required", "unverified", "pending", "verified", "rejected"];
export const REQUEST_STATUS = ["open", "filled", "cancelled", "expired"];
export const REQUEST_KINDS = ["shelter", "medical_sos"];
export const URGENCY = ["urgent", "normal"];

/** Allowed document types → leading magic bytes. */
export const DOCUMENT_TYPES = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

/** Realtime event types (staff channel "volunteers" + volunteer device rooms). */
export const EVENTS = {
  VOLUNTEER_UPDATED: "volunteer:updated",
  REQUEST_UPDATED: "volunteer_request:updated",
  MEDICAL_SUGGESTION: "volunteer:medical_suggestion",
  // → the volunteer's device
  REQUEST_INCOMING: "volunteer:request",
  REQUEST_CLOSED: "volunteer:request_closed",
  REQUEST_ACCEPTED: "volunteer:request_accepted",
};
