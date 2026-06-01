import { notFound } from "next/navigation";
import { Sidebar } from "@/components/admin/sidebar";
import { TableManager } from "@/components/admin/table-manager";
import {
  listRecords,
  resolveForeignKeyLabels,
} from "@/lib/actions/crud";
import {
  TABLE_CONFIG_MAP,
  isValidTableName,
} from "@/lib/schema-config";

type PageProps = {
  params: Promise<{ table: string }>;
};

export default async function TablePage({ params }: PageProps) {
  const { table } = await params;

  if (!isValidTableName(table)) {
    notFound();
  }

  const config = TABLE_CONFIG_MAP[table];
  const recordsResult = await listRecords(table);
  const records = recordsResult.success ? recordsResult.data : [];
  const labelsResult = await resolveForeignKeyLabels(table, records);
  const fkLabels = labelsResult.success ? labelsResult.data : {};

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl">
          {!recordsResult.success && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Failed to load records: {recordsResult.error}. Check your{" "}
              <code className="rounded bg-red-100 px-1">.env.local</code>{" "}
              configuration.
            </div>
          )}
          <TableManager
            config={config}
            initialRecords={records}
            initialFkLabels={fkLabels}
          />
        </div>
      </main>
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(TABLE_CONFIG_MAP).map((table) => ({ table }));
}
