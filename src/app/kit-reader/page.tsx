import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitReaderPanel } from "@/components/admin/kit-reader-panel";
import { Sidebar } from "@/components/admin/sidebar";
import { isAdminRuntimeEnabled } from "@/lib/admin-runtime";
import type { KitReaderAtmMode } from "@/lib/actions/kit-reader";

export const metadata: Metadata = {
  title: "Kit Reader",
};

type PageProps = {
  searchParams: Promise<{
    awakener?: string | string[];
    mode?: string | string[];
  }>;
};

function parseInitialAwakenerId(
  value: string | string[] | undefined,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseInitialMode(
  value: string | string[] | undefined,
): KitReaderAtmMode {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "verified" || raw === "all" || raw === "pending") {
    return raw;
  }
  return "pending";
}

export default async function KitReaderPage({ searchParams }: PageProps) {
  if (!isAdminRuntimeEnabled()) notFound();
  const params = await searchParams;
  const initialAwakenerId = parseInitialAwakenerId(params.awakener);
  const initialMode = parseInitialMode(params.mode);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <KitReaderPanel
          initialAwakenerId={initialAwakenerId}
          initialMode={initialMode}
        />
      </main>
    </div>
  );
}
