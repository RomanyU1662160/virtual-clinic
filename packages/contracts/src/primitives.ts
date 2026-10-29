import { z } from 'zod';

export const id = z.uuid();
export const isoDateTime = z.iso.datetime();
export const email = z.email();
