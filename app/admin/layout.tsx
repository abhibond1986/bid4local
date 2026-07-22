import type { ReactNode } from "react";

/**
 * Admin route segment config.
 *
 * `force-dynamic` ensures none of the /admin pages are prerendered at build
 * time. They all read the session (`auth()`) and query the database, which
 * must happen per-request at runtime — never during `next build`, where no
 * real database is available. This directive cascades to every nested admin
 * route, so no individual page needs to repeat it.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
