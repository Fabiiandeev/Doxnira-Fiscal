import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const hasCustomToken = request.cookies.get("__Host-ns-fiscal-token")?.value || request.cookies.get("ns-fiscal-token")?.value;

  const pathname = request.nextUrl.pathname;
  const publicPaths = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/auth", "/onboarding", "/api/auth", "/oauth"];
  const isPublic = publicPaths.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!hasCustomToken && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const returnTo = `${pathname}${request.nextUrl.search}`;
    if (returnTo.startsWith("/") && !returnTo.startsWith("//")) url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
