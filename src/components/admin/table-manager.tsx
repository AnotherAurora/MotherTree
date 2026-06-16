"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ManifestationFormDialog } from "@/components/admin/manifestation-form-dialog";
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
  permanentDeleteRecord,
  resolveForeignKeyLabels,
  restoreRecord,
  softDeleteRecord,
} from "@/lib/actions/crud";
import type { FieldConfig, TableConfig } from "@/lib/schema-config";
import { getListFields } from "@/lib/schema-config";

type TableManagerProps = {
  config: TableConfig;
  initialRecords: Record<string, unknown>[];
  initialFkLabels: Record<string, string>;
};

type SortDirection = "asc" | "desc";

type SortState = {
  field: string | null;
  direction: SortDirection;
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

function getSortValue(
  record: Record<string, unknown>,
  field: FieldConfig,
  fkLabels: Record<string, string>,
): string | number | boolean | null {
  const raw = record[field.name];

  if (raw == null || raw === "") return null;

  if (field.type === "foreignKey") {
    return fkLabels[`${field.name}:${raw}`] ?? String(raw);
  }

  if (field.type === "number" || field.type === "id") {
    const num = Number(raw);
    return Number.isNaN(num) ? String(raw) : num;
  }

  if (field.type === "boolean") return Boolean(raw);

  return String(raw);
}

function compareSortValues(
  a: string | number | boolean | null,
  b: string | number | boolean | null,
  direction: SortDirection,
) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  let cmp = 0;
  if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else if (typeof a === "boolean" && typeof b === "boolean") {
    cmp = Number(a) - Number(b);
  } else {
    cmp = String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? cmp : -cmp;
}

function sortRecords(
  records: Record<string, unknown>[],
  listFields: FieldConfig[],
  sort: SortState,
  fkLabels: Record<string, string>,
) {
  if (!sort.field) return records;

  const field = listFields.find((item) => item.name === sort.field);
  if (!field) return records;

  return [...records].sort((a, b) =>
    compareSortValues(
      getSortValue(a, field, fkLabels),
      getSortValue(b, field, fkLabels),
      sort.direction,
    ),
  );
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
  const [showDeletedOnly, setShowDeletedOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<
    Record<string, unknown> | null
  >(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [restoringId, setRestoringId] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<SortState>({
    field: null,
    direction: "asc",
  });

  const listFields = getListFields(config);

  React.useEffect(() => {
    setSort({ field: null, direction: "asc" });
  }, [config.name]);

  const sortedRecords = React.useMemo(
    () => sortRecords(records, listFields, sort, fkLabels),
    [records, listFields, sort, fkLabels],
  );

  function toggleSort(fieldName: string) {
    setSort((current) => {
      if (current.field !== fieldName) {
        return { field: fieldName, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { field: fieldName, direction: "desc" };
      }
      return { field: null, direction: "asc" };
    });
  }

  async function refresh(deletedOnly = showDeletedOnly) {
    setLoading(true);
    const result = await listRecords(config.name, deletedOnly);
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

  async function handleRestore(id: number) {
    if (!window.confirm("Restore this record?")) return;

    setRestoringId(id);
    const result = await restoreRecord(config.name, id);
    setRestoringId(null);

    if (result.success) {
      toast.success("Record restored");
      await refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handlePermanentDelete(id: number) {
    if (
      !window.confirm(
        "Permanently delete this record? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(id);
    const result = await permanentDeleteRecord(config.name, id);
    setDeletingId(null);

    if (result.success) {
      toast.success("Record permanently deleted");
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
                  checked={showDeletedOnly}
                  onChange={async (event) => {
                    const deletedOnly = event.target.checked;
                    setShowDeletedOnly(deletedOnly);
                    setLoading(true);
                    const result = await listRecords(
                      config.name,
                      deletedOnly,
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
            {!showDeletedOnly && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            )}
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
              {showDeletedOnly
                ? "No deleted records."
                : `No records yet. Create your first ${config.label.toLowerCase()} entry.`}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    {listFields.map((field) => {
                      const isActive = sort.field === field.name;
                      const SortIcon = isActive
                        ? sort.direction === "asc"
                          ? ArrowUp
                          : ArrowDown
                        : ArrowUpDown;

                      return (
                        <th
                          key={field.name}
                          className="px-4 py-3 text-left font-medium text-zinc-600"
                        >
                          <div className="flex items-center gap-1">
                            <span>{field.label}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => toggleSort(field.name)}
                              aria-label={
                                isActive
                                  ? `Sorted by ${field.label} ${sort.direction === "asc" ? "ascending" : "descending"}`
                                  : `Sort by ${field.label}`
                              }
                            >
                              <SortIcon
                                className={
                                  isActive ? "h-4 w-4" : "h-4 w-4 opacity-40"
                                }
                              />
                            </Button>
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right font-medium text-zinc-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {sortedRecords.map((record) => {
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
                            {showDeletedOnly ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={restoringId === Number(record.id)}
                                  onClick={() =>
                                    handleRestore(Number(record.id))
                                  }
                                >
                                  {restoringId === Number(record.id) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  )}
                                  Restore
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={deletingId === Number(record.id)}
                                  onClick={() =>
                                    handlePermanentDelete(Number(record.id))
                                  }
                                >
                                  {deletingId === Number(record.id) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                  Delete permanently
                                </Button>
                              </>
                            ) : (
                              <>
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
                              </>
                            )}
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

      {config.name === "awakener_tag_manifestation" ? (
        <ManifestationFormDialog
          config={config}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          record={editingRecord}
          onSuccess={refresh}
        />
      ) : (
        <RecordFormDialog
          config={config}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          record={editingRecord}
          onSuccess={refresh}
        />
      )}
    </>
  );
}
