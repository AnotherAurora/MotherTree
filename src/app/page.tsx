import Link from "next/link";
import { Sidebar } from "@/components/admin/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TABLE_CONFIGS } from "@/lib/schema-config";

export default function DashboardPage() {
  const sorted = [...TABLE_CONFIGS].sort((a, b) => a.order - b.order);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
              Welcome to MotherTree Admin
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-600">
              Manage your Supabase game data with full CRUD support, relational
              dropdowns, and enum-aware forms. Start with foundational tables
              like Tags and Awakeners, then build up interactions and demands.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sorted.map((config) => (
              <Link key={config.name} href={`/tables/${config.name}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle>{config.label}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-zinc-500">
                      {config.softDelete
                        ? "Supports soft delete via deleted_at"
                        : "Hard delete only (no deleted_at column)"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
