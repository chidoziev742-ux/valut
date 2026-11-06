import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const passwordSaltBytes = 16;
const passwordKeyBytes = 64;
const passwordScryptOptions = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
});

export async function hashPassword(password) {
  const salt = randomBytes(passwordSaltBytes);
  const key = await scrypt(password, salt, passwordKeyBytes, passwordScryptOptions);
  return `scrypt$${passwordScryptOptions.N}$${passwordScryptOptions.r}$${passwordScryptOptions.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password, encodedHash) {
  if (typeof encodedHash !== "string") {
    await performDummyPasswordCheck(password);
    return false;
  }

  const [algorithm, n, r, p, saltText, keyText, extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    n !== String(passwordScryptOptions.N) ||
    r !== String(passwordScryptOptions.r) ||
    p !== String(passwordScryptOptions.p) ||
    extra !== undefined ||
    !/^[A-Za-z0-9_-]+$/.test(saltText ?? "") ||
    !/^[A-Za-z0-9_-]+$/.test(keyText ?? "")
  ) {
    await performDummyPasswordCheck(password);
    return false;
  }

  const salt = Buffer.from(saltText, "base64url");
  const expectedKey = Buffer.from(keyText, "base64url");
  if (salt.length !== passwordSaltBytes || expectedKey.length !== passwordKeyBytes) {
    await performDummyPasswordCheck(password);
    return false;
  }

  const actualKey = await scrypt(password, salt, passwordKeyBytes, passwordScryptOptions);
  return timingSafeEqual(actualKey, expectedKey);
}

export async function performDummyPasswordCheck(password) {
  await scrypt(password, randomBytes(passwordSaltBytes), passwordKeyBytes, passwordScryptOptions);
}
