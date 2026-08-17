import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitReaderPanel } from "@/components/admin/kit-reader-panel";
import { Sidebar } from "@/components/admin/sidebar";
import { isAdminRuntimeEnabled } from "@/lib/admin-runtime";

export const metadata: Metadata = {
  title: "Kit Reader",
};

export default function KitReaderPage() {
  if (!isAdminRuntimeEnabled()) notFound();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <KitReaderPanel />
      </main>
    </div>
  );
}
