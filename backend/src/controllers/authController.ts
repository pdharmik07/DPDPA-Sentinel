/**
 * Authentication endpoints.
 *
 * Express 5 forwards rejected promises from handlers to the error middleware
 * automatically, so these do not need a try/catch wrapper.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService.js';
import { AppError } from '../utils/errors.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters.')
    .max(200, 'Password must be at most 200 characters.')
    // Deliberately a length-and-variety rule rather than a maze of classes:
    // length is what actually matters, but a single repeated character is not
    // a password.
    .refine((p) => new Set(p).size >= 5, 'Password is too repetitive.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Enter your password.').max(200),
});

export async function register(req: Request, res: Response): Promise<void> {
  const { user, token } = await authService.register(
    req.body as z.infer<typeof registerSchema>,
  );
  res.status(201).json({ user, token });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { user, token } = await authService.login(req.body as z.infer<typeof loginSchema>);
  res.json({ user, token });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized();
  res.json({ user: await authService.getMe(req.user.id) });
}
