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

  /** Principal for an anonymous citizen device. */
  static citizenPrincipal(deviceId) {
    return {
      kind: "citizen",
      role: "citizen",
      deviceId,
      permissions: RbacService.permissionsFor("citizen"),
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
