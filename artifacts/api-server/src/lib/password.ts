import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}
