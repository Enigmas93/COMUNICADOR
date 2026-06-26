import {
  canManageRoom,
  canPromoteMember,
  canRemoveMember,
  canViewPrivateRoom,
} from "@/lib/permissions";

describe("permissions", () => {
  const base = {
    actorId: "admin_1",
    actorRole: "admin" as const,
    targetId: "member_1",
    targetRole: "member" as const,
    ownerId: "owner_1",
  };

  it("permite gestao apenas para admins", () => {
    expect(canManageRoom("admin")).toBe(true);
    expect(canManageRoom("member")).toBe(false);
  });

  it("promove membros comuns, mas nunca o proprio ator", () => {
    expect(canPromoteMember(base)).toBe(true);
    expect(canPromoteMember({ ...base, actorId: "member_1" })).toBe(false);
  });

  it("impede remocao do owner e restringe admins secundarios", () => {
    expect(canRemoveMember(base)).toBe(true);
    expect(canRemoveMember({ ...base, targetId: "owner_1" })).toBe(false);
    expect(
      canRemoveMember({ ...base, targetRole: "admin", targetId: "admin_2", actorId: "admin_3", ownerId: "owner_1" }),
    ).toBe(false);
  });

  it("libera acesso quando a sala e publica ou o usuario e membro", () => {
    expect(canViewPrivateRoom(false, true)).toBe(true);
    expect(canViewPrivateRoom(true, false)).toBe(true);
    expect(canViewPrivateRoom(false, false)).toBe(false);
  });
});
