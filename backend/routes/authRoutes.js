import { Router } from "#constants";
import { authController } from "#controllers";
import { authenticate, rateLimitFor } from "#middlewares";

const AuthRouter = Router();

AuthRouter.post("/login", ...rateLimitFor("auth.login"), authController.login);
AuthRouter.get("/me", authenticate, authController.me);

export { AuthRouter };
