export { default } from "next-auth/middleware";

/**
 * Protect every app route except the login page, the NextAuth endpoints, the
 * cron endpoint (guarded by CRON_SECRET, not a session), and Next internals.
 * Unauthenticated users are redirected to /login by next-auth/middleware.
 */
export const config = {
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
