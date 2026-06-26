import type { MemberRole } from "@/types/domain";

interface PermissionContext {
  actorId: string;
  actorRole: MemberRole;
  targetId: string;
  targetRole: MemberRole;
  ownerId: string;
}

export function canManageRoom(role: MemberRole) {
  return role === "admin";
}

export function canPromoteMember({ actorRole, targetRole, actorId, targetId, ownerId }: PermissionContext) {
  if (actorRole !== "admin") return false;
  if (targetRole !== "member") return false;
  if (actorId === targetId) return false;
  if (targetId === ownerId) return false;

  return true;
}

export function canRemoveMember({ actorRole, actorId, targetId, targetRole, ownerId }: PermissionContext) {
  if (actorRole !== "admin") return false;
  if (targetId === ownerId) return false;
  if (actorId === targetId && actorId !== ownerId) return true;
  if (targetRole === "admin" && actorId !== ownerId) return false;

  return actorId !== targetId;
}

export function canViewPrivateRoom(isMember: boolean, isPublic: boolean) {
  return isPublic || isMember;
}
