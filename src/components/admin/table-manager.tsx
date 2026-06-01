"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RecordFormDialog } from "@/components/admin/record-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listRecords,
  resolveForeignKeyLabels,
  softDeleteRecord,
} from "@/lib/actions/crud";
import type { TableConfig } from "@/lib/schema-config";
import { getListFields } from "@/lib/schema-config";

type TableManagerProps = {
  config: TableConfig;
  initialRecords: Record<string, unknown>[];
  initialFkLabels: Record<string, string>;
};

function formatCellValue(
  fieldName: string,
  value: unknown,
  fkLabels: Record<string, string>,
) {
  if (value == null || value === "") return "—";

  const fkLabel = fkLabels[`${fieldName}:${value}`];
  if (fkLabel) return fkLabel;

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toString();
  return String(value);
}

export function TableManager({
  config,
  initialRecords,
  initialFkLabels,
}: TableManagerProps) {
  const [records, setRecords] =
    React.useState<Record<string, unknown>[]>(initialRecords);
  const [fkLabels, setFkLabels] =
    React.useState<Record<string, string>>(initialFkLabels);
  const [includeDeleted, setIncludeDeleted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<
    Record<string, unknown> | null
  >(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  const listFields = getListFields(config);

  async function refresh() {
    setLoading(true);
    const result = await listRecords(config.name, includeDeleted);
    if (!result.success) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    const labelResult = await resolveForeignKeyLabels(
      config.name,
      result.data,
    );

    setRecords(result.data);
    if (labelResult.success) {
      setFkLabels(labelResult.data);
    }
    setLoading(false);
  }

  async function handleDelete(id: number) {
    const message = config.softDelete
      ? "Soft-delete this record?"
      : "Permanently delete this record? This table has no deleted_at column.";

    if (!window.confirm(message)) return;

    setDeletingId(id);
    const result = await softDeleteRecord(config.name, id);
    setDeletingId(null);

    if (result.success) {
      toast.success(config.softDelete ? "Record soft-deleted" : "Record deleted");
      await refresh();
    } else {
      toast.error(result.error);
    }
  }

  function openCreate() {
    setEditingRecord(null);
    setDialogOpen(true);
  }

  function openEdit(record: Record<string, unknown>) {
    setEditingRecord(record);
    setDialogOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{config.label}</CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {config.softDelete && (
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={async (event) => {
                    setIncludeDeleted(event.target.checked);
                    setLoading(true);
                    const result = await listRecords(
                      config.name,
                      event.target.checked,
                    );
                    if (result.success) {
                      const labelResult = await resolveForeignKeyLabels(
                        config.name,
                        result.data,
                      );
                      setRecords(result.data);
                      if (labelResult.success) setFkLabels(labelResult.data);
                    }
                    setLoading(false);
                  }}
                />
                Show deleted
              </label>
            )}
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading records...
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 py-16 text-center text-zinc-500">
              No records yet. Create your first {config.label.toLowerCase()} entry.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    {listFields.map((field) => (
                      <th
                        key={field.name}
                        className="px-4 py-3 text-left font-medium text-zinc-600"
                      >
                        {field.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-medium text-zinc-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {records.map((record) => {
                    const isDeleted = Boolean(record.deleted_at);
                    return (
                      <tr
                        key={String(record.id)}
                        className={isDeleted ? "bg-zinc-50 text-zinc-400" : ""}
                      >
                        {listFields.map((field) => (
                          <td key={field.name} className="px-4 py-3 align-top">
                            {formatCellValue(
                              field.name,
                              record[field.name],
                              fkLabels,
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(record)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingId === Number(record.id)}
                              onClick={() => handleDelete(Number(record.id))}
                            >
                              {deletingId === Number(record.id) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              {config.softDelete ? "Soft delete" : "Delete"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordFormDialog
        config={config}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editingRecord}
        onSuccess={refresh}
      />
    </>
  );
}
