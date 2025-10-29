import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/", "/captain(.*)", "/stop(.*)", "/tournament(.*)", "/api/tournaments", "/api/public(.*)", "/api/captain-portal(.*)", "/api/ping", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"
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
