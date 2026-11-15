import { rbac } from "#config";
import { resolveRoles, hasPermission, hasAny } from "#engine";

const resolved = resolveRoles(
  Object.fromEntries(Object.entries(rbac.roles).filter(([k]) => !k.startsWith("$"))),
);
const channelPermissions = Object.fromEntries(
  Object.entries(rbac.channels).filter(([k]) => !k.startsWith("$")),
);

/**
 * Config-driven RBAC. Roles, inheritance and channel permissions come from
 * config/rbac.json — no role names are hard-coded in route handlers.
 */
class RbacService {
  static roles() {
    return Object.keys(resolved);
  }

  static isRole(role) {
    return Object.hasOwn(resolved, role);
  }

  static permissionsFor(role) {
    return resolved[role] ?? [];
  }

  static can(principal, permission) {
    return hasPermission(principal?.permissions, permission);
  }

  static canAny(principal, permissions) {
    return hasAny(principal?.permissions, permissions);
  }

  /** Channels this principal may receive realtime events on. */
  static channelsFor(principal) {
    return Object.entries(channelPermissions)
      .filter(([, perm]) => hasPermission(principal?.permissions, perm))
      .map(([name]) => name);
  }

  static canReceive(principal, channel) {
    if (!Object.hasOwn(channelPermissions, channel)) return false;
    return hasPermission(principal?.permissions, channelPermissions[channel]);
  }

  /** Role metadata for clients (labels are translation keys). */
  static describe() {
    return Object.fromEntries(
      Object.entries(rbac.roles)
        .filter(([k]) => !k.startsWith("$"))
        .map(([name, r]) => [name, { label: r.label, permissions: resolved[name] }]),
    );
  }

  // Optional, synchronous device-role resolvers registered by feature modules
  // (e.g. volunteers: a consented volunteer device → role "volunteer").
  static #deviceResolvers = [];

  static registerDeviceRoleResolver(fn) {
    RbacService.#deviceResolvers.push(fn);
  }

  /** Principal for an anonymous citizen device (role may be upgraded by a module). */
  static citizenPrincipal(deviceId) {
    let role = "citizen";
    for (const resolve of RbacService.#deviceResolvers) {
      const r = resolve(deviceId);
      if (r && RbacService.isRole(r)) {
        role = r;
        break;
      }
    }
    return {
      kind: "citizen",
      role,
      deviceId,
      permissions: RbacService.permissionsFor(role),
    };
  }

  /** Principal for a staff operator document. */
  static operatorPrincipal(operator) {
    return {
      kind: "operator",
      role: operator.role,
      operatorId: operator._id.toString(),
      username: operator.username,
      brigadeId: operator.brigade?.toString() ?? null,
      shelterId: operator.shelter?.toString() ?? null,
      permissions: RbacService.permissionsFor(operator.role),
    };
  }
}

export { RbacService };
