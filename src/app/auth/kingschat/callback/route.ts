import { NextResponse } from "next/server";

function appendParamsToRedirect(redirectTo: string, params: Record<string, unknown>) {
  const redirectUrl = new URL(redirectTo);

  for (const [key, value] of Object.entries(params)) {
    if (key === "app_redirect" || value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          redirectUrl.searchParams.append(key, String(item));
        }
      }
      continue;
    }

    redirectUrl.searchParams.set(key, String(value));
  }

  return redirectUrl.toString();
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      data: null,
      meta: null,
      error: { message, details: null },
    },
    { status },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appRedirect = url.searchParams.get("app_redirect");

  if (!appRedirect) {
    return errorResponse("Missing app_redirect");
  }

  const params = Object.fromEntries(url.searchParams.entries());
  return NextResponse.redirect(appendParamsToRedirect(appRedirect, params), 302);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") || "";

  let bodyEntries: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object") {
      bodyEntries = body as Record<string, unknown>;
    }
  } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    bodyEntries = Object.fromEntries(formData.entries());
  }

  const appRedirect =
    url.searchParams.get("app_redirect") ||
    (typeof bodyEntries.app_redirect === "string" ? bodyEntries.app_redirect : "");

  if (!appRedirect) {
    return errorResponse("Missing app_redirect");
  }

  return NextResponse.redirect(
    appendParamsToRedirect(appRedirect, {
      ...Object.fromEntries(url.searchParams.entries()),
      ...bodyEntries,
    }),
    302,
  );
}
