import type { NextFunction, Request, Response } from "express";

import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth.js";

/**
 * Express auth middleware.
 *
 * `attachUser` is intentionally "soft": it never blocks the request.
 * Routes that need protection should use `requireAuth` and/or `requireRole`.
 */
const isUserRole = (role: unknown): role is UserRoles => {
  return role === "admin" || role === "teacher" || role === "student";
};

export const attachUser = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Better-Auth reads the session cookie and returns the authenticated user (if any).
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session?.user && isUserRole(session.user.role)) {
      req.user = {
        id: session.user.id,
        role: session.user.role,
      };
    }
  } catch {
    // If the cookie is missing/invalid, better-auth may throw; treat as unauthenticated.
    // Leave `req.user` unset.
  }

  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

export const requireRole =
  (...roles: UserRoles[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // RBAC: only allow requests whose `req.user.role` is in the allowed set.
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };

