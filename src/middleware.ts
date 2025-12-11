import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/", "/about(.*)", "/rules(.*)", "/captain(.*)", "/stop(.*)", "/tournament(.*)", "/api/tournaments", "/api/public(.*)", "/api/captain-portal(.*)", "/api/ping", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"
]);

const isAdminRoute = createRouteMatcher([
  "/admin(.*)", "/api/admin(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  // Public routes don't need authentication
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect all other routes
  await auth.protect();

  // For admin routes, we'll check permissions in the API routes themselves
  // since we need database access to check roles
  if (isAdminRoute(req)) {
    return NextResponse.next();
  }

  // Profile completion checks are handled in:
  // - Player layout (server-side) for all /(player) routes
  // - Dashboard page (client-side) as a fallback
  // This keeps middleware lightweight for Edge Function size limits

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
