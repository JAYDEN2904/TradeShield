import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message?.trim();
  if (!msg) return fallback;
  // customFetch prefixes API bodies as "HTTP 502 Bad Gateway: <message>"
  const stripped = msg.match(/^HTTP \d+\s+[^:]+:\s*(.+)$/s)?.[1]?.trim();
  return stripped || msg;
}
