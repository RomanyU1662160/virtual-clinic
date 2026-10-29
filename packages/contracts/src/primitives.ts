import { z } from 'zod';

export const id = z.uuid();
export const isoDateTime = z.iso.datetime();
export const email = z.email();
/** International phone format, e.g. +447700900123 */
export const phone = z.e164();
/** Required, non-empty text */
export const text = z.string().min(1);

/** Refinement predicate: compares real instants, not strings (precision-safe). */
export const endsAfterStart = (v: { startTime: string; endTime: string }) =>
  Date.parse(v.endTime) > Date.parse(v.startTime);

export const endsAfterStartError = {
  error: 'endTime must be after startTime',
  path: ['endTime'],
};
