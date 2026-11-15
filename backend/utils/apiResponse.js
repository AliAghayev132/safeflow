/**
 * Standard response envelope: { success, code?, message?, data?, errors? }
 * `code` is a stable machine-readable key the clients translate (i18n);
 * `message` is the Azerbaijani fallback.
 */
const ok = (res, data = null, message, status = 200, code) => {
  const body = { success: true };
  if (code) body.code = code;
  if (message) body.message = message;
  if (data !== null) body.data = data;
  return res.status(status).json(body);
};

const fail = (res, message, status = 400, errors, code) => {
  const body = { success: false, message };
  if (code) body.code = code;
  if (errors) body.errors = errors;
  return res.status(status).json(body);
};

export { ok, fail };
