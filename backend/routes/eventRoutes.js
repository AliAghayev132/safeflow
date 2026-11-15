import { Router } from "#constants";
import { eventsController } from "#controllers";
import { authenticateAny, rateLimitFor } from "#middlewares";

/** Realtime polling fallback (staff token or citizen device id). */
const EventRouter = Router();

EventRouter.get("/", authenticateAny, ...rateLimitFor("events.poll"), eventsController.pollEvents);

export { EventRouter };
