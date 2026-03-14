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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function htmlRedirectResponse(appRedirect: string, initialParams: Record<string, unknown>) {
  const safeTitle = escapeHtml("Completing sign in");
  const safeMessage = escapeHtml("Completing sign in...");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body>
    <p>${safeMessage}</p>
    <script>
      (function () {
        var appRedirect = ${serializeForInlineScript(appRedirect)};
        var initialParams = ${serializeForInlineScript(initialParams)};
        var currentUrl = new URL(window.location.href);
        var targetUrl = new URL(appRedirect);

        Object.keys(initialParams).forEach(function (key) {
          if (key === "app_redirect") {
            return;
          }

          var value = initialParams[key];
          if (Array.isArray(value)) {
            value.forEach(function (item) {
              if (item !== null && item !== undefined) {
                targetUrl.searchParams.append(key, String(item));
              }
            });
            return;
          }

          if (value !== null && value !== undefined) {
            targetUrl.searchParams.set(key, String(value));
          }
        });

        if (currentUrl.hash) {
          var hashParams = new URLSearchParams(currentUrl.hash.slice(1));
          hashParams.forEach(function (value, key) {
            targetUrl.searchParams.set(key, value);
          });
        }

        window.location.replace(targetUrl.toString());
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appRedirect = url.searchParams.get("app_redirect");

  if (!appRedirect) {
    return errorResponse("Missing app_redirect");
  }

  const params = Object.fromEntries(url.searchParams.entries());
  return htmlRedirectResponse(appRedirect, params);
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
