import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateFirebaseUser, getSessionUser } from '../db/repository.ts';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  status: string;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : '');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  try {
    if (token.startsWith('sf_sess_')) {
      const user = await getSessionUser(token);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended by administrator.' });
      }
      req.authUser = {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: user.status,
      };
      return next();
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email || `${decodedToken.uid}@firebase.user`;
    const user = await getOrCreateFirebaseUser(decodedToken.uid, email, decodedToken.name);

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended by administrator.' });
    }

    req.authUser = {
      id: user.id,
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      status: user.status,
    };
    return next();
  } catch (error) {
    console.error('Authentication verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.authUser || (req.authUser.role !== 'ADMIN' && req.authUser.role !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  next();
};
