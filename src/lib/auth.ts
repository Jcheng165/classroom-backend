/**
 * Better-Auth configuration for the backend.
 *
 * This defines:
 * - trusted origins (so cookies are accepted by the browser)
 * - cookie attributes for cross-origin deployments
 * - email/password strategy (Refine auth client uses this)
 * - role + metadata fields stored on the user object
 * - database adapter used by Better-Auth
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "../db/index.js"; // your drizzle instance
import * as schema from "../db/schema/auth.js";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: [process.env.FRONTEND_URL!],
  // The frontend and backend are deployed on different origins in production.
  // better-auth defaults `sameSite` to "lax", which can prevent cookies from being sent
  // on cross-site fetches (leading to 401 on protected endpoints).
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // Enable password reset for Refine's `useForgotPassword()`.
    // For now we just log the reset link; plug in email provider later if needed.
    sendResetPassword: async ({ user, url }, request) => {
      // eslint-disable-next-line no-console
      console.log("Password reset request:", {
        email: user.email,
        url,
        // Keeping request out of logs to avoid leaking headers/cookies.
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "student",
        input: true, // Allow role to be set during registration
      },
      imageCldPubId: {
        type: "string",
        required: false,
        input: true, // Allow imageCldPubId to be set during registration
      },
    },
  },
});
