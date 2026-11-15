/**
 * Config-driven RBAC resolution — pure.
 */

/** Expand `inherits` recursively into a flat permission set per role. */
export const resolveRoles = (rolesConfig) => {
  const resolved = {};
  const visit = (name, stack = []) => {
    if (resolved[name]) return resolved[name];
    const role = rolesConfig[name];
    if (!role) throw new Error(`RBAC: unknown role "${name}"`);
    if (stack.includes(name)) throw new Error(`RBAC: inheritance cycle at "${name}"`);
    const perms = new Set(role.permissions ?? []);
    for (const parent of role.inherits ?? []) {
      visit(parent, [...stack, name]).forEach((p) => perms.add(p));
    }
    resolved[name] = perms;
    return perms;
  };
  Object.keys(rolesConfig).forEach((name) => visit(name));
  return Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, [...v]]));
};

/** `sos:*` matches `sos:read`; `*` matches everything. */
export const hasPermission = (granted = [], required) => {
  if (!required) return true;
  return granted.some((p) => {
    if (p === "*" || p === required) return true;
    if (p.endsWith(":*")) return required.startsWith(p.slice(0, -1));
    return false;
  });
};

export const hasAny = (granted, required) => required.some((r) => hasPermission(granted, r));
