import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/", "/captain/[token]", "/stop(.*)", "/tournament(.*)", "/api/tournaments", "/api/public(.*)", "/api/ping", "/api/test-db", "/api/test-simple-db", "/api/test-tournaments-simple", "/api/test-tournaments-club", "/api/test-tournaments-null-club", "/api/test-tournaments-no-club", "/api/test-tournaments-basic", "/api/test-stops", "/api/debug-env", "/sign-in(.*)", "/sign-up(.*)"
]);

const isAdminRoute = createRouteMatcher([
  "/admin(.*)", "/api/admin(.*)", "/app-admin(.*)", "/api/app-admin(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  // Public routes don't need authentication
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect all other routes
  const { userId } = await auth.protect();
  
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // For admin routes, we'll check permissions in the API routes themselves
  // since we need database access to check roles
  if (isAdminRoute(req)) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
