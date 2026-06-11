import { Request, Response, NextFunction } from 'express';

export const TEST_USER = {
  id: 'user-test-id',
  clubId: 'club-test-id',
  role: 'ADMIN',
};

export const TEST_AUTH = {
  clerkId: 'clerk-test-id',
  email: 'test@veloclub.com',
  name: 'Test User',
};

/**
 * Middleware que inyecta req.user y req.auth para tests.
 * Reemplaza requireAuth en tests.
 */
export function mockAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.user = TEST_USER;
  req.auth = TEST_AUTH;
  next();
}

/**
 * Middleware que simula un usuario sin autenticar (para probar 401).
 * No inyecta nada — imita lo que haría requireAuth si no hay Bearer token.
 */
export function mockUnauthMiddleware(_req: Request, res: Response, _next: NextFunction) {
  res.status(401).json({ error: 'No autenticado' });
}
