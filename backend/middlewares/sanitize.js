/**
 * NoSQL injection sanitizer — strips keys starting with "$" from user input.
 */
const sanitize = (value) => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitize);

  const clean = {};
  for (const key of Object.keys(value)) {
    if (key.startsWith("$")) continue;
    clean[key] = sanitize(value[key]);
  }
  return clean;
};

const sanitizeInPlace = (obj) => {
  if (!obj || typeof obj !== "object") return;
  const clean = sanitize(obj);
  for (const key of Object.keys(obj)) delete obj[key];
  Object.assign(obj, clean);
};

const sanitizeInput = (req, _res, next) => {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params);
  // Express 5: req.query is a getter — replace it with a sanitized copy.
  const query = sanitize({ ...req.query });
  Object.defineProperty(req, "query", { value: query, writable: true });
  next();
};

export { sanitizeInput };
