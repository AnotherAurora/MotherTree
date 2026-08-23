import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminRuntimeEnabled } from "@/lib/admin-runtime";

export function proxy(request: NextRequest) {
  if (isAdminRuntimeEnabled()) {
    return NextResponse.next();
  }

  const notFoundUrl = request.nextUrl.clone();
  notFoundUrl.pathname = "/__not-found";
  return NextResponse.rewrite(notFoundUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/tables/:path*",
    "/path-carver/:path*",
    "/simulator/:path*",
    "/kit-reader/:path*",
  ],
};
