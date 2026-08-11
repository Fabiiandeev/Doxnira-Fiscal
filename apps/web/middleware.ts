import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const sessionParam = request.nextUrl.searchParams.get("nsSession");
  if (sessionParam) {
    try {
      const session = JSON.parse(sessionParam) as {
        token?: string;
        user?: { id: string; name: string; email: string; role: string };
        companyId?: string | null;
      };
      const requestHeaders = new Headers(request.headers);
      if (session.token) requestHeaders.set("x-ns-session-token", session.token);
      if (session.user) requestHeaders.set("x-ns-session-user", JSON.stringify(session.user));
      if (session.companyId) requestHeaders.set("x-ns-session-company-id", session.companyId);
      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch {
      // Fall through to the normal auth gate.
    }
  }

  const hasCustomToken = request.cookies.get("ns-fiscal-token")?.value;

  const publicPaths = ["/", "/login", "/register", "/auth", "/onboarding", "/contato", "/sitemap.xml", "/robots.txt"];
  const isPublic = publicPaths.some((p) =>
    p === "/"
      ? request.nextUrl.pathname === "/"
      : request.nextUrl.pathname.startsWith(p),
  );

  if (!hasCustomToken && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
