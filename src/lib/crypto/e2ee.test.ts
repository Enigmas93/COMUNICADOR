import {
  decryptMessage,
  decryptPrivateKeyBackup,
  encryptMessage,
  encryptPrivateKeyForBackup,
  generateIdentityKeyPair,
  generateRoomKey,
  openRoomKeyEnvelope,
  sealRoomKeyForMember,
} from "@/lib/crypto/e2ee";

describe("e2ee helpers", () => {
  it("gera identidade e envelope de sala por membro", async () => {
    const alice = await generateIdentityKeyPair();
    const roomKey = await generateRoomKey();
    const sealed = await sealRoomKeyForMember(roomKey, alice.publicKey);
    const opened = await openRoomKeyEnvelope(sealed, alice.publicKey, alice.privateKey);

    expect(opened).toBe(roomKey);
  });

  it("cifra e decifra mensagens com a chave simetrica da sala", async () => {
    const roomKey = await generateRoomKey();
    const encrypted = await encryptMessage("mensagem ultrassecreta", roomKey);
    const cleartext = await decryptMessage(encrypted, roomKey);

    expect(cleartext).toBe("mensagem ultrassecreta");
  });

  it("protege o backup da chave privada com senha", async () => {
    const identity = await generateIdentityKeyPair();
    const backup = await encryptPrivateKeyForBackup(identity.privateKey, "senha-super-forte");
    const restored = await decryptPrivateKeyBackup(backup, "senha-super-forte");

    expect(restored).toBe(identity.privateKey);
  });
});
