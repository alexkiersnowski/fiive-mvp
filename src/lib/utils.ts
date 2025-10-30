import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Escapes special characters for use in SQL ILIKE patterns
// % and _ are wildcards; they must be escaped to match literally
export function escapeForILike(input: string): string {
  if (!input) return '';
  // Escape backslash first, then % and _
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
