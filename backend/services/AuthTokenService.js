import { jwt } from "#lib";
import { config } from "#config";

/**
 * JWT helpers for dispatcher operators.
 */
class AuthTokenService {
  static sign(operator) {
    return jwt.sign(
      { id: operator._id.toString(), role: operator.role },
      config.accessSecretKey,
      { expiresIn: config.accessTokenExpiresIn },
    );
  }

  /** Throws JsonWebTokenError / TokenExpiredError on failure. */
  static verify(token) {
    return jwt.verify(token, config.accessSecretKey);
  }
}

export { AuthTokenService };
