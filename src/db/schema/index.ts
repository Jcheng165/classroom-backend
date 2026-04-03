/**
 * Central export barrel for Drizzle schema objects.
 *
 * Keeping these exports aggregated makes route handlers and the seed script
 * less verbose (single import for all tables).
 */
export * from "./app.js";
export * from "./auth.js";
