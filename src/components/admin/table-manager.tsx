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
import { DesireFormDialog } from "@/components/admin/desire-form-dialog";
import { CopyProviderGroupFormDialog } from "@/components/admin/copy-provider-group-form-dialog";
import { ManifestationFormDialog } from "@/components/admin/manifestation-form-dialog";
import {
  EditableCell,
  formatCellDisplayValue,
} from "@/components/admin/editable-cell";
import { RecordFormDialog } from "@/components/admin/record-form-dialog";
import { TagTreeView } from "@/components/admin/tag-tree-view";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getForeignKeyOptions,
  listRecords,
  permanentDeleteRecord,
  resolveForeignKeyLabels,
  restoreRecord,
  softDeleteRecord,
  type ForeignKeyOption,
} from "@/lib/actions/crud";
import type {
  FieldConfig,
  ListSortDirection,
  ListSortState,
  TableConfig,
} from "@/lib/schema-config";
import { getDefaultListSort, getListFields } from "@/lib/schema-config";
import {
  CREATES_AMPLIFY_CONFLICT_HINT,
  LOCAL_INTERACTION_COLUMN_MISMATCH_HINT,
  NON_POSITIVE_INSTANCE_OR_COPIES_HINT,
  UNIQUE_SCALING_NON_SELF_TARGET_TYPE_HINT,
  hasCreatesAmplifyConflict,
  hasLocalInteractionColumnMismatch,
  hasNonPositiveInstanceOrCopies,
  hasUniqueScalingNonSelfTargetType,
} from "@/lib/admin-form-warnings";
import { cn } from "@/lib/utils";

type TableManagerProps = {
  config: TableConfig;
  initialRecords: Record<string, unknown>[];
  initialFkLabels: Record<string, string>;
  initialTotalCount: number;
  initialTruncated: boolean;
};

type ListViewMode = "table" | "tree";

const TAG_LIST_VIEW_STORAGE_KEY = "mother-tree:tag-list-view";

function readStoredListViewMode(): ListViewMode {
  if (typeof window === "undefined") return "tree";
  const stored = window.localStorage.getItem(TAG_LIST_VIEW_STORAGE_KEY);
  return stored === "table" ? "table" : "tree";
}

function formatCellValue(
  fieldName: string,
  value: unknown,
  fkLabels: Record<string, string>,
) {
  return formatCellDisplayValue(fieldName, value, fkLabels);
}

type EditingCellState = {
  recordId: number;
  fieldName: string;
} | null;

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
  direction: ListSortDirection,
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
  sort: ListSortState,
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
  initialTotalCount,
  initialTruncated,
}: TableManagerProps) {
  const [records, setRecords] =
    React.useState<Record<string, unknown>[]>(initialRecords);
  const [fkLabels, setFkLabels] =
    React.useState<Record<string, string>>(initialFkLabels);
  const [totalCount, setTotalCount] = React.useState(initialTotalCount);
  const [listTruncated, setListTruncated] = React.useState(initialTruncated);
  const [showDeletedOnly, setShowDeletedOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<
    Record<string, unknown> | null
  >(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [restoringId, setRestoringId] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<ListSortState>(() =>
    getDefaultListSort(config),
  );
  const [editingCell, setEditingCell] = React.useState<EditingCellState>(null);
  const [fkOptionsByField, setFkOptionsByField] = React.useState<
    Record<string, ForeignKeyOption[]>
  >({});
  const treeListView = config.listViews?.tree;
  const [listViewMode, setListViewMode] = React.useState<ListViewMode>("tree");

  React.useEffect(() => {
    if (treeListView) {
      setListViewMode(readStoredListViewMode());
    }
  }, [treeListView]);

  function setListViewModeAndPersist(mode: ListViewMode) {
    setListViewMode(mode);
    if (treeListView) {
      window.localStorage.setItem(TAG_LIST_VIEW_STORAGE_KEY, mode);
    }
  }

  const listFields = getListFields(config);
  const inlineFields = listFields.filter((field) => field.inlineEditable);

  React.useEffect(() => {
    setSort(getDefaultListSort(config));
    setEditingCell(null);
  }, [config.name]);

  React.useEffect(() => {
    const inlineFkFields = getListFields(config).filter(
      (field) =>
        field.inlineEditable &&
        field.type === "foreignKey" &&
        field.foreignKey,
    );

    if (inlineFkFields.length === 0) {
      setFkOptionsByField((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
      return;
    }

    let cancelled = false;
    const cacheKeyToPromise = new Map<string, Promise<ForeignKeyOption[]>>();

    async function loadFieldOptions(field: FieldConfig) {
      const fk = field.foreignKey!;
      const cacheKey = `${fk.table}:${fk.displayColumn}:${fk.labelKind ?? ""}`;
      if (!cacheKeyToPromise.has(cacheKey)) {
        cacheKeyToPromise.set(
          cacheKey,
          getForeignKeyOptions(
            fk.table,
            fk.displayColumn,
            fk.labelKind,
          ).then((result) => (result.success ? result.data : [])),
        );
      }
      const options = await cacheKeyToPromise.get(cacheKey)!;
      return { fieldName: field.name, options };
    }

    Promise.all(inlineFkFields.map(loadFieldOptions)).then((results) => {
      if (cancelled) return;
      const next: Record<string, ForeignKeyOption[]> = {};
      for (const item of results) {
        next[item.fieldName] = item.options;
      }
      setFkOptionsByField(next);
    });

    return () => {
      cancelled = true;
    };
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
    setTotalCount(result.totalCount);
    setListTruncated(result.truncated);
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
    setEditingCell(null);
    setEditingRecord(record);
    setDialogOpen(true);
  }

  function patchFkLabelsFromRecordChange(
    prev: Record<string, unknown>,
    updated: Record<string, unknown>,
  ) {
    const labelPatches: Record<string, string> = {};

    for (const field of listFields) {
      if (field.type !== "foreignKey") continue;

      const oldVal = prev[field.name];
      const newVal = updated[field.name];
      if (oldVal === newVal) continue;
      if (newVal == null || newVal === "") continue;

      const option = (fkOptionsByField[field.name] ?? []).find(
        (item) => item.value === Number(newVal),
      );
      if (option) {
        labelPatches[`${field.name}:${newVal}`] = option.label;
      }
    }

    if (Object.keys(labelPatches).length > 0) {
      setFkLabels((current) => ({ ...current, ...labelPatches }));
    }
  }

  function handleInlineUpdate(updated: Record<string, unknown>) {
    const prev = records.find((record) => record.id === updated.id);
    if (prev) {
      patchFkLabelsFromRecordChange(prev, updated);
    }

    setRecords((current) =>
      current.map((record) =>
        record.id === updated.id ? updated : record,
      ),
    );
  }

  async function handleDialogSuccess(saved: Record<string, unknown>) {
    if (editingRecord) {
      patchFkLabelsFromRecordChange(editingRecord, saved);
      setRecords((current) =>
        current.map((record) =>
          record.id === saved.id ? saved : record,
        ),
      );

      const labelResult = await resolveForeignKeyLabels(config.name, [saved]);
      if (labelResult.success) {
        setFkLabels((current) => ({ ...current, ...labelResult.data }));
      }
      return;
    }

    await refresh();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{config.label}</CardTitle>
            <CardDescription>
              {config.description}
              {totalCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  {totalCount === 1
                    ? "1 record"
                    : `${totalCount.toLocaleString()} records`}
                </>
              ) : null}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {treeListView && (
              <div className="flex rounded-lg border border-border p-0.5">
                <Button
                  type="button"
                  variant={listViewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  className={
                    listViewMode === "table" ? undefined : "text-zinc-500"
                  }
                  onClick={() => setListViewModeAndPersist("table")}
                >
                  Table
                </Button>
                <Button
                  type="button"
                  variant={listViewMode === "tree" ? "default" : "ghost"}
                  size="sm"
                  className={
                    listViewMode === "tree" ? undefined : "text-zinc-500"
                  }
                  onClick={() => setListViewModeAndPersist("tree")}
                >
                  Tree
                </Button>
              </div>
            )}
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
                      setTotalCount(result.totalCount);
                      setListTruncated(result.truncated);
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
          {listTruncated ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Record list was truncated at the safety cap. Not all rows were
              loaded — contact the maintainer if you need the full table.
            </div>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading records...
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center text-zinc-500">
              {showDeletedOnly
                ? "No deleted records."
                : `No records yet. Create your first ${config.label.toLowerCase()} entry.`}
            </div>
          ) : listViewMode === "tree" && treeListView ? (
            <TagTreeView
              config={config}
              records={records}
              pathField={treeListView.pathField}
              showDeletedOnly={showDeletedOnly}
              deletingId={deletingId}
              restoringId={restoringId}
              inlineFields={inlineFields}
              editingCell={editingCell}
              onEditingCellChange={setEditingCell}
              onInlineUpdate={handleInlineUpdate}
              fkLabels={fkLabels}
              fkOptionsByField={fkOptionsByField}
              onEdit={openEdit}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
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
                          className={cn(
                            "px-4 py-3 text-left font-medium text-zinc-600",
                            field.name === "copy_provider_group_id" &&
                              "max-w-[10rem]",
                          )}
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
                <tbody className="divide-y divide-border bg-white">
                  {sortedRecords.map((record) => {
                    const isDeleted = Boolean(record.deleted_at);
                    const flagConflict =
                      config.name === "tag_default_interaction" &&
                      !isDeleted &&
                      hasCreatesAmplifyConflict(record);
                    const localColumnMismatch =
                      config.name ===
                        "awakener_local_manifestation_interaction" &&
                      !isDeleted &&
                      hasLocalInteractionColumnMismatch(record);
                    const uniqueScalingNonSelfTargetType =
                      config.name ===
                        "awakener_local_manifestation_interaction" &&
                      !isDeleted &&
                      hasUniqueScalingNonSelfTargetType(record);
                    const nonPositiveCopies =
                      config.name === "awakener_tag_manifestation" &&
                      !isDeleted &&
                      hasNonPositiveInstanceOrCopies(record);
                    const isUnverified =
                      config.name === "awakener_tag_manifestation" &&
                      !isDeleted &&
                      record.verified === false;
                    const rowWarn =
                      flagConflict ||
                      localColumnMismatch ||
                      uniqueScalingNonSelfTargetType ||
                      nonPositiveCopies;
                    return (
                      <tr
                        key={String(record.id)}
                        className={cn(
                          // Precedence (last wins via twMerge): unverified < warn < deleted
                          isUnverified && "bg-red-100",
                          rowWarn && "bg-amber-50",
                          isDeleted && "bg-zinc-50 text-zinc-400",
                        )}
                        title={
                          flagConflict
                            ? CREATES_AMPLIFY_CONFLICT_HINT
                            : localColumnMismatch
                              ? LOCAL_INTERACTION_COLUMN_MISMATCH_HINT
                              : uniqueScalingNonSelfTargetType
                                ? UNIQUE_SCALING_NON_SELF_TARGET_TYPE_HINT
                                : nonPositiveCopies
                                  ? NON_POSITIVE_INSTANCE_OR_COPIES_HINT
                                  : isUnverified
                                    ? "Unverified (pending)"
                                    : undefined
                        }
                        onDoubleClick={() => {
                          if (!showDeletedOnly && !isDeleted) {
                            openEdit(record);
                          }
                        }}
                      >
                        {listFields.map((field) => (
                          <td
                            key={field.name}
                            className={cn(
                              "px-4 py-3 align-top",
                              field.name === "copy_provider_group_id" &&
                                "max-w-[10rem] overflow-hidden",
                            )}
                          >
                            {field.inlineEditable && !showDeletedOnly && !isDeleted ? (
                              <EditableCell
                                tableName={config.name}
                                recordId={Number(record.id)}
                                field={field}
                                value={record[field.name]}
                                fkLabels={fkLabels}
                                fkOptions={fkOptionsByField[field.name] ?? []}
                                isActive={
                                  editingCell?.recordId === Number(record.id) &&
                                  editingCell.fieldName === field.name
                                }
                                onActivate={() =>
                                  setEditingCell({
                                    recordId: Number(record.id),
                                    fieldName: field.name,
                                  })
                                }
                                onDeactivate={() => setEditingCell(null)}
                                onUpdate={handleInlineUpdate}
                              />
                            ) : (
                              formatCellValue(
                                field.name,
                                record[field.name],
                                fkLabels,
                              )
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
      ) : config.name === "copy_provider_group" ? (
        <CopyProviderGroupFormDialog
          config={config}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          record={editingRecord}
          onSuccess={refresh}
        />
      ) : config.name === "desire" ? (
        <DesireFormDialog
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
          onSuccess={handleDialogSuccess}
        />
      )}
    </>
  );
}
