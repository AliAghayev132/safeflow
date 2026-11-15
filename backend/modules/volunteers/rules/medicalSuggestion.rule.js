import { domainEvents } from "#constants";
import { RealtimeService } from "#services";
import { RequestService } from "../services/index.js";
import { EVENTS } from "../constants.js";

/**
 * A medical SOS arrived → if ready medical volunteers are nearby, suggest to
 * dispatchers that they can be called out. Nothing is sent to volunteers
 * without an explicit dispatcher approval (POST /volunteers/medical-sos/:id).
 */
export const medicalSuggestionRule = {
  id: "volunteer-medical-suggestion",
  name: "rule.volunteerMedicalSuggestion",
  events: [domainEvents.SOS_CREATED],
  enabled: true,
  describe: (cfg) =>
    `Tibbi SOS-un ${cfg.volunteers?.medicalSosRadiusMeters ?? "?"} m radiusunda hazır həkim könüllü varsa dispetçerə təklif`,

  async handle({ payload: { sos } }) {
    if (sos.type !== "medical" || sos.spamFlagged) return;
    const nearby = await RequestService.medicalNearbyCount({ lat: sos.lat, lng: sos.lng });
    if (!nearby) return;
    RealtimeService.publish({
      type: EVENTS.MEDICAL_SUGGESTION,
      data: { sosId: sos.id, lat: sos.lat, lng: sos.lng, nearby, at: new Date().toISOString() },
      channel: "volunteers",
    });
  },
};
