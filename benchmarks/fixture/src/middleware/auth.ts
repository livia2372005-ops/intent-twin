import type { Request, Response, NextFunction } from 'express';
import { db, User } from '../db.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers['x-session-token'] as string;
  if (!token) {
    return res.status(401).json({ error: 'Missing x-session-token header' });
  }

  const user = db.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid session token' });
  }

  req.user = user;
  next();
}
