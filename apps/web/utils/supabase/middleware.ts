import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const hasCustomToken = request.cookies.get("ns-fiscal-token")?.value;

  const publicPaths = ["/login", "/register", "/auth", "/onboarding"];
  const isPublic = publicPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!hasCustomToken && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
