import {
  decryptBinary,
  decryptMessage,
  decryptPrivateKeyBackup,
  decryptInviteRoomKey,
  encryptBinary,
  encryptRoomKeyForInvite,
  encryptMessage,
  encryptPrivateKeyForBackup,
  generateIdentityKeyPair,
  generateInviteSecret,
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

  it("cifra e decifra binarios com a chave da sala", async () => {
    const roomKey = await generateRoomKey();
    const source = new Uint8Array([10, 20, 30, 40, 50]).buffer;
    const encrypted = await encryptBinary(source, roomKey, "application/octet-stream");
    const decrypted = await decryptBinary(encrypted, roomKey);

    expect(Array.from(new Uint8Array(decrypted))).toEqual([10, 20, 30, 40, 50]);
  });

  it("abre a chave da sala via segredo de convite", async () => {
    const roomKey = await generateRoomKey();
    const inviteSecret = await generateInviteSecret();
    const wrapped = await encryptRoomKeyForInvite(roomKey, inviteSecret);
    const opened = await decryptInviteRoomKey(wrapped, inviteSecret);

    expect(opened).toBe(roomKey);
  });
});
