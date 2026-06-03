import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes reachable while signed out:
//  - "/"        → landing page (signed in, it renders the dashboard instead)
//  - "/api/..." → API routes enforce their own auth and return JSON 401s;
//                 redirecting them would break client fetch() calls.
// Everything else (archive, leaderboard, submit, problem, submission, user
// profiles) requires sign-in.
const isPublicRoute = createRouteMatcher(["/", "/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth();
  if (!userId) {
    // Bounce signed-out visitors to the landing page, which hosts the
    // "Get Started" sign-in modal. (No dedicated /sign-in route exists.)
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
