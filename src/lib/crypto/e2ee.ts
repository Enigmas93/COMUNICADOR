export interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface CipherEnvelope {
  ciphertext: string;
  nonce: string;
}

const PRIVATE_KEY_CONTEXT = "aurora-private-key";

function getCryptoApi() {
  if (typeof globalThis.crypto !== "undefined") {
    return globalThis.crypto;
  }

  throw new Error("Web Crypto API indisponivel neste ambiente.");
}

function toBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function fromBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function utf8Encode(value: string) {
  return new TextEncoder().encode(value);
}

function utf8Decode(bytes: ArrayBuffer) {
  return new TextDecoder().decode(bytes);
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function normalizeBytes(bytes: Uint8Array) {
  return new Uint8Array(toArrayBuffer(bytes));
}

async function derivePasswordKey(password: string, salt: Uint8Array) {
  const crypto = getCryptoApi();
  const material = await crypto.subtle.importKey("raw", utf8Encode(password), "PBKDF2", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: normalizeBytes(salt),
      iterations: 600_000,
    },
    material,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const crypto = getCryptoApi();
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  const publicKey = await crypto.subtle.exportKey("spki", pair.publicKey);
  const privateKey = await crypto.subtle.exportKey("pkcs8", pair.privateKey);

  return {
    publicKey: toBase64(new Uint8Array(publicKey)),
    privateKey: toBase64(new Uint8Array(privateKey)),
  };
}

export async function generateRoomKey() {
  const crypto = getCryptoApi();
  const roomKey = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(roomKey);
}

export async function sealRoomKeyForMember(roomKey: string, memberPublicKey: string) {
  const crypto = getCryptoApi();
  const publicKey = await crypto.subtle.importKey(
    "spki",
    fromBase64(memberPublicKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, fromBase64(roomKey));

  return toBase64(new Uint8Array(encrypted));
}

export async function openRoomKeyEnvelope(
  encryptedRoomKey: string,
  _memberPublicKey: string,
  memberPrivateKey: string,
) {
  const crypto = getCryptoApi();
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64(memberPrivateKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, fromBase64(encryptedRoomKey));

  return toBase64(new Uint8Array(decrypted));
}

export async function encryptMessage(plaintext: string, roomKey: string): Promise<CipherEnvelope> {
  const crypto = getCryptoApi();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const secretKey = await crypto.subtle.importKey(
    "raw",
    fromBase64(roomKey),
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    secretKey,
    utf8Encode(plaintext),
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    nonce: toBase64(iv),
  };
}

export async function decryptMessage(payload: CipherEnvelope, roomKey: string) {
  const crypto = getCryptoApi();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    fromBase64(roomKey),
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["decrypt"],
  );
  const cleartext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(payload.nonce),
    },
    secretKey,
    fromBase64(payload.ciphertext),
  );

  return utf8Decode(cleartext);
}

export async function encryptPrivateKeyForBackup(privateKey: string, password: string) {
  const crypto = getCryptoApi();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const derivedKey = await derivePasswordKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    derivedKey,
    fromBase64(privateKey),
  );

  return {
    context: PRIVATE_KEY_CONTEXT,
    salt: toBase64(salt),
    nonce: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptPrivateKeyBackup(
  payload: { salt: string; nonce: string; ciphertext: string },
  password: string,
) {
  const crypto = getCryptoApi();
  const derivedKey = await derivePasswordKey(password, fromBase64(payload.salt));
  const cleartext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(payload.nonce),
    },
    derivedKey,
    fromBase64(payload.ciphertext),
  );

  return toBase64(new Uint8Array(cleartext));
}
