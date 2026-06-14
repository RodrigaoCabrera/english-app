import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

function allowlist(): string[] {
  return (process.env.ALLOWLIST_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;

  await auth.protect();

  const list = allowlist();
  if (list.length === 0) return; // rely on Clerk dashboard allowlist

  // Requires a session token claim "email" configured in the Clerk dashboard
  // (Sessions -> Customize session token -> {"email": "{{user.primary_email_address}}"}).
  const { sessionClaims } = await auth();
  const email = (sessionClaims?.email as string | undefined)?.toLowerCase();
  if (!email || !list.includes(email)) {
    return NextResponse.redirect(new URL("/sign-in?denied=1", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|map)).*)",
    "/(api|trpc)(.*)",
  ],
};
