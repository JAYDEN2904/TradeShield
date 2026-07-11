import { useEffect, useState } from "react";

export type CountdownResult = {
  totalMs: number;
  remainingMs: number;
  /** 0–100 */
  progressPercent: number;
  isExpired: boolean;
  /** Human-readable e.g. "2d 5h 12m" or "45m 30s" */
  label: string;
};

function formatDuration(ms: number): string {
  if (ms <= 0) return "Expired";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function useCountdown(
  endAt: string | Date | null | undefined,
  /** Total window duration for progress bar — defaults to 72h for auto-release */
  windowMs = 72 * 60 * 60 * 1000,
): CountdownResult | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endAt]);

  if (!endAt) return null;

  const endMs = new Date(endAt).getTime();
  const remainingMs = Math.max(0, endMs - now);
  const totalMs = windowMs;
  const elapsed = totalMs - remainingMs;
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalMs) * 100));

  return {
    totalMs,
    remainingMs,
    progressPercent,
    isExpired: remainingMs <= 0,
    label: formatDuration(remainingMs),
  };
}
