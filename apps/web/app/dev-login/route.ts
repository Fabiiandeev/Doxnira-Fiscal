import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ message: "Not found" }, { status: 404 });
  const form = await request.formData();
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json", origin: new URL(request.url).origin },
    body: JSON.stringify({ email: String(form.get("email") || ""), password: String(form.get("password") || "") }),
  });
  if (!response.ok) return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
  const redirect = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  for (const cookie of response.headers.getSetCookie()) redirect.headers.append("set-cookie", cookie);
  return redirect;
}
