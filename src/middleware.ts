import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from '@/server/db';

const isPublicRoute = createRouteMatcher([
  "/", "/captain(.*)", "/stop(.*)", "/tournament(.*)", "/api/tournaments", "/api/public(.*)", "/api/captain-portal(.*)", "/api/ping", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"
]);

const isAdminRoute = createRouteMatcher([
  "/admin(.*)", "/api/admin(.*)"
]);

const isProfileRoute = createRouteMatcher([
  "/profile(.*)"
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

  // Check if profile is complete for player routes (but allow access to /profile itself)
  const isPlayerRoute = req.nextUrl.pathname.startsWith('/dashboard') || 
                        req.nextUrl.pathname.startsWith('/register') ||
                        (req.nextUrl.pathname.startsWith('/') && !isPublicRoute(req) && !isAdminRoute(req));
  
  if (isPlayerRoute && !isProfileRoute(req)) {
    try {
      const player = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: {
          firstName: true,
          lastName: true,
          clubId: true,
        }
      });

      // If player exists but profile is incomplete, redirect to profile
      if (player && (!player.firstName || !player.lastName || !player.clubId)) {
        return NextResponse.redirect(new URL('/profile', req.url));
      }
    } catch (error) {
      // If database check fails, allow through (don't block users)
      console.error('Error checking profile completion in middleware:', error);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
