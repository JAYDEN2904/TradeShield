import crypto from "node:crypto";

function sessionSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET is required for WebSocket tokens");
  }
  return secret;
}

/** Short-lived HMAC token so the browser can open a WS to the API host directly. */
export function createNotificationWsToken(userId: number, ttlSeconds = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${exp}`;
  const sig = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyNotificationWsToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userIdRaw, expRaw, sig] = parts;
  if (!userIdRaw || !expRaw || !sig) return null;

  const payload = `${userIdRaw}.${expRaw}`;
  const expected = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  const exp = Number(expRaw);
  const userId = Number(userIdRaw);
  if (!Number.isFinite(exp) || !Number.isInteger(userId) || userId <= 0) {
    return null;
  }
  if (exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return userId;
}
