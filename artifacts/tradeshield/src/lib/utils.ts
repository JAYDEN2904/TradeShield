import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
