import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/", "/captain(.*)", "/stop(.*)", "/api/public(.*)", "/api/diag"
  ],
  ignoredRoutes: ["/_next(.*)", "/api/diag"]
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
