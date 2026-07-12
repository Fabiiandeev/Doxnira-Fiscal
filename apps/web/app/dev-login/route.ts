import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";
const isProduction = process.env.NODE_ENV === "production";

async function performLogin(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Falha ao autenticar a sessao de desenvolvimento.");
  }

  const companiesResponse = await fetch(`${API_URL}/companies`, {
    headers: { authorization: `Bearer ${payload.token}` },
    cache: "no-store",
  });
  const companiesPayload = await companiesResponse.json().catch(() => ({ data: [] }));
  const companyId = companiesPayload?.data?.[0]?.id ?? null;

  return {
    token: payload.token as string,
    user: payload.user as { id: string; name: string; email: string; role: string },
    companyId,
  };
}

function redirectWithSession(
  request: Request,
  session: { token: string; user: { id: string; name: string; email: string; role: string }; companyId: string | null },
  returnTo: string,
) {
  const destination = new URL(returnTo, request.url);
  destination.searchParams.set("nsSession", JSON.stringify(session));
  return NextResponse.redirect(destination);
}

export async function GET(request: Request) {
  if (isProduction) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email") || "";
  const password = url.searchParams.get("password") || "";
  const returnTo = url.searchParams.get("returnTo") || "/dashboard";

  if (!email || !password) {
    return new NextResponse("Informe email e senha.", { status: 400 });
  }

  try {
    const session = await performLogin(email, password);
    return redirectWithSession(request, session, returnTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao autenticar a sessao de desenvolvimento.";
    return new NextResponse(message, { status: 401 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
