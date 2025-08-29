import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines and merges class names with Tailwind classes
 */
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
} 