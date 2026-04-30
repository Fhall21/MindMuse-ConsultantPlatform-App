import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATH_PREFIXES = ["/login", "/callback", "/share", "/interview"];
const RESERVED_ROOT_PATHS = new Set([
  "dashboard",
  "digital-interviews",
  "meetings",
  "consultations",
  "people",
  "reports",
  "settings",
  "canvas",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) {
    return false;
  }

  return !RESERVED_ROOT_PATHS.has(segments[0] ?? "");
}

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
