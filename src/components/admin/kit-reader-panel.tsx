"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AwakenerKitNotes } from "@/components/admin/awakener-kit-notes";
import {
  EditableCell,
  formatCellDisplayValue,
} from "@/components/admin/editable-cell";
import {
  INITIAL_KIT_READER_FILTERS,
  KitReaderFilters,
  type KitReaderFiltersState,
} from "@/components/admin/kit-reader-filters";
import { ManifestationFormDialog } from "@/components/admin/manifestation-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getForeignKeyOptions,
  resolveForeignKeyLabels,
  type ForeignKeyOption,
} from "@/lib/actions/crud";
import {
  NON_POSITIVE_INSTANCE_OR_COPIES_HINT,
  hasNonPositiveInstanceOrCopies,
} from "@/lib/admin-form-warnings";
import {
  exportKitPackAndPrompt,
  listAtmsForAwakener,
  listKitReaderAwakeners,
  softDeleteAtm,
  unverifyAtm,
  verifyAllPendingForAwakener,
  verifyPendingAtm,
  type KitReaderAtmMode,
  type KitReaderAwakenerOption,
  type PendingAtmRow,
} from "@/lib/actions/kit-reader";
import { formatAwakenerEnlightenmentLabel } from "@/lib/enlightenment-options";
import {
  TABLE_CONFIG_MAP,
  type FieldConfig,
} from "@/lib/schema-config";
import { cn } from "@/lib/utils";

const FOCUS_REFRESH_DEBOUNCE_MS = 300;

const ATM_CONFIG = TABLE_CONFIG_MAP.awakener_tag_manifestation;

const ATM_FIELD_BY_NAME = Object.fromEntries(
  ATM_CONFIG.fields.map((field) => [field.name, field]),
) as Record<string, FieldConfig>;

/** ATM queue column order (excludes timestamps). */
const PENDING_COLUMN_FIELDS = [
  "id",
  "awakener_id",
  "tag_id",
  "trigger_condition",
  "metadata",
  "replaces_manifestation_id",
  "dependency_stat",
  "value_scalar",
  "instance_count",
  "base_copies",
  "copy_provider_group_id",
  "is_accumulating",
  "is_permanent",
  "required_enlightenment",
  "required_realm",
  "source_type",
  "target_type",
  "buff_target_type_restriction",
] as const;

type PendingColumnName = (typeof PENDING_COLUMN_FIELDS)[number];

/** Kit Reader-only inline overrides (does not affect admin table manager). */
const KIT_READER_INLINE_OVERRIDES: Partial<
  Record<PendingColumnName, Partial<FieldConfig>>
> = {
  metadata: { inlineEditable: true },
};

function pendingInlineField(name: PendingColumnName): FieldConfig | undefined {
  const base = ATM_FIELD_BY_NAME[name];
  if (!base) return undefined;
  const override = KIT_READER_INLINE_OVERRIDES[name];
  const field = override ? { ...base, ...override } : base;
  if (!field.inlineEditable || field.name === "verified") return undefined;
  return field;
}

const INLINE_FIELDS = PENDING_COLUMN_FIELDS.map((name) =>
  pendingInlineField(name),
).filter((field): field is FieldConfig => Boolean(field));

type EditingCellState = {
  recordId: number;
  fieldName: string;
} | null;

function pendingRowToEditRecord(row: PendingAtmRow): Record<string, unknown> {
  return {
    id: row.id,
    awakener_id: row.awakener_id,
    tag_id: row.tag_id,
    trigger_condition: row.trigger_condition,
    metadata: row.metadata,
    replaces_manifestation_id: row.replaces_manifestation_id,
    dependency_stat: row.dependency_stat,
    value_scalar: row.value_scalar,
    instance_count: row.instance_count,
    base_copies: row.base_copies,
    copy_provider_group_id: row.copy_provider_group_id,
    is_accumulating: row.is_accumulating,
    is_permanent: row.is_permanent,
    verified: row.verified,
    required_enlightenment: row.required_enlightenment,
    required_realm: row.required_realm,
    source_type: row.source_type,
    target_type: row.target_type,
    buff_target_type_restriction: row.buff_target_type_restriction,
  };
}

function mergePendingFromUpdate(
  row: PendingAtmRow,
  updated: Record<string, unknown>,
): PendingAtmRow {
  return {
    ...row,
    awakener_id:
      updated.awakener_id == null ? row.awakener_id : Number(updated.awakener_id),
    tag_id: updated.tag_id == null ? row.tag_id : Number(updated.tag_id),
    trigger_condition:
      updated.trigger_condition == null
        ? null
        : Number(updated.trigger_condition),
    metadata:
      updated.metadata == null ? null : String(updated.metadata),
    replaces_manifestation_id:
      updated.replaces_manifestation_id == null
        ? null
        : Number(updated.replaces_manifestation_id),
    dependency_stat:
      updated.dependency_stat == null
        ? null
        : String(updated.dependency_stat),
    value_scalar:
      updated.value_scalar == null ? null : Number(updated.value_scalar),
    instance_count: Number(updated.instance_count ?? row.instance_count),
    base_copies: Number(updated.base_copies ?? row.base_copies),
    copy_provider_group_id:
      updated.copy_provider_group_id == null
        ? null
        : Number(updated.copy_provider_group_id),
    is_accumulating: Boolean(updated.is_accumulating),
    is_permanent:
      updated.is_permanent == null ? null : Boolean(updated.is_permanent),
    verified: Boolean(updated.verified ?? row.verified),
    required_enlightenment:
      updated.required_enlightenment == null
        ? null
        : Number(updated.required_enlightenment),
    required_realm:
      updated.required_realm == null ? null : Number(updated.required_realm),
    source_type:
      updated.source_type == null ? null : String(updated.source_type),
    target_type:
      updated.target_type == null ? null : String(updated.target_type),
    buff_target_type_restriction:
      updated.buff_target_type_restriction == null
        ? null
        : String(updated.buff_target_type_restriction),
  };
}

function formatNullable(value: string | number | null | undefined): ReactNode {
  return value == null || value === "" ? "—" : value;
}

function pendingColumnLabel(name: PendingColumnName): string {
  if (name === "tag_id") return "Tag";
  if (name === "required_enlightenment") return "Enlightenment";
  if (name === "required_realm") return "Realm";
  if (name === "value_scalar") return "Scalar";
  if (name === "dependency_stat") return "Dependency";
  if (name === "source_type") return "Source";
  if (name === "target_type") return "Target";
  if (name === "buff_target_type_restriction") return "Buff Target Restriction";
  if (name === "is_accumulating") return "Accumulating";
  if (name === "is_permanent") return "Permanent";
  if (name === "instance_count") return "Instances";
  if (name === "base_copies") return "Copies";
  return ATM_FIELD_BY_NAME[name]?.label ?? name;
}

function readPendingFieldValue(
  row: PendingAtmRow,
  name: PendingColumnName,
): unknown {
  switch (name) {
    case "id":
      return row.id;
    case "awakener_id":
      return row.awakener_id;
    case "tag_id":
      return row.tag_id;
    case "trigger_condition":
      return row.trigger_condition;
    case "metadata":
      return row.metadata;
    case "replaces_manifestation_id":
      return row.replaces_manifestation_id;
    case "dependency_stat":
      return row.dependency_stat;
    case "value_scalar":
      return row.value_scalar;
    case "instance_count":
      return row.instance_count;
    case "base_copies":
      return row.base_copies;
    case "copy_provider_group_id":
      return row.copy_provider_group_id;
    case "is_accumulating":
      return row.is_accumulating;
    case "is_permanent":
      return row.is_permanent;
    case "required_enlightenment":
      return row.required_enlightenment;
    case "required_realm":
      return row.required_realm;
    case "source_type":
      return row.source_type;
    case "target_type":
      return row.target_type;
    case "buff_target_type_restriction":
      return row.buff_target_type_restriction;
  }
}

function formatStaticPendingValue(
  row: PendingAtmRow,
  name: PendingColumnName,
  fkLabels: Record<string, string>,
): { display: ReactNode; title?: string } {
  const field = ATM_FIELD_BY_NAME[name];
  const value = readPendingFieldValue(row, name);

  switch (name) {
    case "id":
      return { display: row.id };
    case "tag_id": {
      const label =
        row.tag_name ?? formatCellDisplayValue(name, value, fkLabels);
      return {
        display: label,
        title: label === "—" ? undefined : String(label),
      };
    }
    case "metadata":
      return {
        display: formatNullable(row.metadata),
        title: row.metadata ?? undefined,
      };
    case "required_enlightenment":
      return {
        display:
          row.required_enlightenment == null
            ? "—"
            : formatAwakenerEnlightenmentLabel(row.required_enlightenment),
      };
    default:
      if (field?.type === "foreignKey") {
        const display = formatCellDisplayValue(name, value, fkLabels);
        return {
          display,
          title: display === "—" ? undefined : display,
        };
      }
      return { display: formatNullable(String(value)) };
  }
}

export function KitReaderPanel({
  initialAwakenerId,
  initialMode = "pending",
}: {
  initialAwakenerId: number | null;
  initialMode?: KitReaderAtmMode;
}) {
  const router = useRouter();
  const [awakeners, setAwakeners] = useState<KitReaderAwakenerOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialAwakenerId);
  const [mode, setMode] = useState<KitReaderAtmMode>(initialMode);
  const [filters, setFilters] = useState<KitReaderFiltersState>(
    INITIAL_KIT_READER_FILTERS,
  );
  const [rows, setRows] = useState<PendingAtmRow[]>([]);
  const [prompt, setPrompt] = useState("");
  const [packPath, setPackPath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowsLoading, startRowsLoading] = useTransition();
  const [busy, startBusy] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCellState>(null);
  const [fkOptionsByField, setFkOptionsByField] = useState<
    Record<string, ForeignKeyOption[]>
  >({});
  const [fkLabels, setFkLabels] = useState<Record<string, string>>({});
  const lastRefreshAtRef = useRef(0);

  const selected = useMemo(
    () => awakeners.find((row) => row.id === selectedId) ?? null,
    [awakeners, selectedId],
  );

  const updateUrl = useCallback(
    (id: number | null, targetMode: KitReaderAtmMode) => {
      if (id == null) return;
      router.replace(`/kit-reader?awakener=${id}&mode=${targetMode}`, {
        scroll: false,
      });
    },
    [router],
  );

  const selectAwakener = useCallback(
    (id: number) => {
      setSelectedId(id);
      updateUrl(id, mode);
    },
    [mode, updateUrl],
  );

  const handleModeChange = useCallback(
    (newMode: KitReaderAtmMode) => {
      setMode(newMode);
      updateUrl(selectedId, newMode);
    },
    [selectedId, updateUrl],
  );

  const refreshAwakeners = useCallback(async () => {
    const result = await listKitReaderAwakeners();
    if (!result.success) {
      setLoadError(result.error);
      return;
    }
    setLoadError(null);
    setAwakeners(result.data);
    if (result.data.length === 0) return;
    const stillValid =
      selectedId != null && result.data.some((row) => row.id === selectedId);
    if (!stillValid) {
      selectAwakener(result.data[0].id);
    }
  }, [selectedId, selectAwakener]);

  const refreshRows = useCallback(
    (awakenerId: number, targetMode: KitReaderAtmMode) => {
      startRowsLoading(async () => {
        const result = await listAtmsForAwakener(awakenerId, targetMode);
        if (!result.success) {
          toast.error(result.error);
          return;
        }

        const records = result.data.map(pendingRowToEditRecord);
        const labelResult = await resolveForeignKeyLabels(
          ATM_CONFIG.name,
          records,
        );

        setRows(result.data);
        if (labelResult.success) {
          setFkLabels(labelResult.data);
        }
        setEditingCell(null);
      });
    },
    [],
  );

  const refreshAll = useCallback(() => {
    if (selectedId != null) refreshRows(selectedId, mode);
    void refreshAwakeners();
  }, [selectedId, mode, refreshRows, refreshAwakeners]);

  useEffect(() => {
    void refreshAwakeners();
  }, [refreshAwakeners]);

  useEffect(() => {
    if (selectedId == null) return;
    refreshRows(selectedId, mode);
    setPrompt("");
    setPackPath(null);
    setEditingCell(null);
  }, [selectedId, mode, refreshRows]);

  useEffect(() => {
    const onMaybeVisible = () => {
      if (document.hidden || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAtRef.current < FOCUS_REFRESH_DEBOUNCE_MS) return;
      lastRefreshAtRef.current = now;
      refreshAll();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onMaybeVisible();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onMaybeVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onMaybeVisible);
    };
  }, [refreshAll]);

  useEffect(() => {
    const inlineFkFields = INLINE_FIELDS.filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );

    if (inlineFkFields.length === 0) {
      setFkOptionsByField({});
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
          getForeignKeyOptions(fk.table, fk.displayColumn, fk.labelKind).then(
            (result) => (result.success ? result.data : []),
          ),
        );
      }
      const options = await cacheKeyToPromise.get(cacheKey)!;
      return { fieldName: field.name, options };
    }

    void Promise.all(inlineFkFields.map(loadFieldOptions)).then((results) => {
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
  }, []);

  const hasPending = (selected?.pendingCount ?? 0) > 0;

  const onExport = () => {
    if (selectedId == null) return;
    startBusy(async () => {
      const result = await exportKitPackAndPrompt(selectedId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setPrompt(result.data.prompt);
      setPackPath(result.data.relativePath);
      toast.success(`Wrote ${result.data.relativePath}`);
    });
  };

  const onCopyPrompt = async () => {
    if (!prompt) {
      toast.error("Export a kit pack first to fill the prompt");
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Cursor prompt copied");
    } catch {
      toast.error("Clipboard failed — select the prompt text and copy manually");
    }
  };

  const onVerify = (id: number) => {
    startBusy(async () => {
      const result = await verifyPendingAtm(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Verified ATM #${id}`);
      if (selectedId != null) refreshRows(selectedId, mode);
      await refreshAwakeners();
    });
  };

  const onUnverify = (id: number) => {
    startBusy(async () => {
      const result = await unverifyAtm(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Moved ATM #${id} to Pending`);
      if (selectedId != null) refreshRows(selectedId, mode);
      await refreshAwakeners();
    });
  };

  const onVerifyAll = () => {
    if (selectedId == null) return;
    startBusy(async () => {
      const result = await verifyAllPendingForAwakener(selectedId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Verified ${result.data.count} ATM(s)`);
      refreshRows(selectedId, mode);
      await refreshAwakeners();
    });
  };

  const onSoftDelete = (id: number) => {
    startBusy(async () => {
      const result = await softDeleteAtm(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Soft-deleted ATM #${id}`);
      if (selectedId != null) refreshRows(selectedId, mode);
      await refreshAwakeners();
    });
  };

  const onEdit = (row: PendingAtmRow) => {
    setEditingRecord(pendingRowToEditRecord(row));
    setEditOpen(true);
  };

  const onClone = (row: PendingAtmRow) => {
    const record = pendingRowToEditRecord(row);
    delete record.id;
    record.verified = true;
    setEditingRecord(record);
    setEditOpen(true);
  };

  const onAddNew = () => {
    if (selectedId == null) return;
    setEditingRecord({
      awakener_id: selectedId,
      verified: mode === "verified" || mode === "all",
      instance_count: 1,
      base_copies: 1,
      is_accumulating: false,
    });
    setEditOpen(true);
  };

  const onEditSuccess = () => {
    if (selectedId != null) refreshRows(selectedId, mode);
    void refreshAwakeners();
  };

  const handleInlineUpdate = (updated: Record<string, unknown>) => {
    const id = Number(updated.id);
    setRows((current) =>
      current.map((row) =>
        row.id === id ? mergePendingFromUpdate(row, updated) : row,
      ),
    );

    for (const field of INLINE_FIELDS) {
      if (field.type !== "foreignKey") continue;
      const value = updated[field.name];
      if (value == null || value === "") continue;
      const option = (fkOptionsByField[field.name] ?? []).find(
        (item) => item.value === Number(value),
      );
      if (!option) continue;
      setFkLabels((current) => ({
        ...current,
        [`${field.name}:${value}`]: option.label,
      }));
    }
  };

  // Apply filters
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Enlightenment filter
      if (filters.enlightenment !== "all") {
        if (filters.enlightenment === "unset") {
          if (row.required_enlightenment != null) return false;
        } else {
          if (row.required_enlightenment !== Number(filters.enlightenment)) {
            return false;
          }
        }
      }

      // Source type filter
      if (filters.sourceType !== "all") {
        if (filters.sourceType === "unset") {
          if (row.source_type != null && row.source_type !== "") return false;
        } else {
          if (row.source_type !== filters.sourceType) return false;
        }
      }

      // Search query
      if (filters.searchQuery.trim() !== "") {
        const q = filters.searchQuery.trim().toLowerCase();
        const matchesTag = row.tag_name?.toLowerCase().includes(q) ?? false;
        const matchesMetadata = row.metadata?.toLowerCase().includes(q) ?? false;
        const matchesDependency = row.dependency_stat?.toLowerCase().includes(q) ?? false;
        const matchesId = String(row.id).includes(q) || String(row.tag_id).includes(q);
        if (!matchesTag && !matchesMetadata && !matchesDependency && !matchesId) {
          return false;
        }
      }

      return true;
    });
  }, [rows, filters]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Local admin only
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Kit Reader &amp; Editor
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Triage and verify proposed kit packs, or view and tune live Awakener kits
          with inline cell editing, notes scratchpad, and local interaction overrides.
          The{" "}
          <Link
            href="/tables/awakener_tag_manifestation"
            className="underline underline-offset-2 hover:text-zinc-950"
          >
            Awakener Manifestations
          </Link>{" "}
          table remains available for broader database management.
        </p>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Awakener Selection */}
      <section className="space-y-3">
        <Label htmlFor="kit-reader-awakener">Awakener</Label>
        <select
          id="kit-reader-awakener"
          className="w-full max-w-md rounded-md border border-border bg-white px-3 py-2 text-sm text-zinc-900"
          value={selectedId ?? ""}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) selectAwakener(value);
          }}
        >
          {awakeners.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} ({row.pendingCount} pending / {row.verifiedCount} verified)
            </option>
          ))}
        </select>
      </section>

      {/* Awakener Notes Scratchpad */}
      {selected && (
        <AwakenerKitNotes
          awakenerId={selected.id}
          awakenerName={selected.name}
        />
      )}

      {/* Mode Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleModeChange("pending")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              mode === "pending"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900",
            )}
          >
            Pending Review
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                mode === "pending"
                  ? "bg-zinc-800 text-zinc-100"
                  : "bg-zinc-200 text-zinc-700",
              )}
            >
              {selected?.pendingCount ?? 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("verified")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              mode === "verified"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900",
            )}
          >
            Verified Kit
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                mode === "verified"
                  ? "bg-zinc-800 text-zinc-100"
                  : "bg-zinc-200 text-zinc-700",
              )}
            >
              {selected?.verifiedCount ?? 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("all")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              mode === "all"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900",
            )}
          >
            All Records
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                mode === "all"
                  ? "bg-zinc-800 text-zinc-100"
                  : "bg-zinc-200 text-zinc-700",
              )}
            >
              {selected?.totalCount ?? 0}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(mode === "verified" || mode === "all") && (
            <Button
              type="button"
              size="sm"
              onClick={onAddNew}
              disabled={busy || selectedId == null}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Manifestation
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || selectedId == null}
            onClick={refreshAll}
          >
            {rowsLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Pending Mode Ingestion Tools */}
      {mode === "pending" && (
        <div className="space-y-4">
          {hasPending && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Pending ATMs must be verified or soft-deleted before exporting a new kit pack
              for this awakener.
            </div>
          )}

          <form
            autoComplete="off"
            className="flex flex-wrap gap-3"
            onSubmit={(event) => event.preventDefault()}
          >
            <Button
              type="button"
              disabled={busy || selectedId == null || hasPending}
              onClick={onExport}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Export kit pack &amp; fill prompt
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !prompt}
              onClick={() => void onCopyPrompt()}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Cursor prompt
            </Button>
            {packPath && (
              <p className="self-center text-xs text-zinc-500">Wrote {packPath}</p>
            )}
          </form>

          <section className="space-y-2">
            <Label htmlFor="kit-reader-prompt">Cursor Agent prompt</Label>
            <Textarea
              id="kit-reader-prompt"
              readOnly
              value={prompt}
              placeholder="Export a kit pack to fill this prompt."
              className="min-h-[160px] bg-zinc-50 font-mono text-sm leading-relaxed text-zinc-900"
            />
          </section>
        </div>
      )}

      {/* Manifestations List Section */}
      <form
        autoComplete="off"
        className="space-y-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-zinc-950">
            {mode === "pending"
              ? "Pending queue"
              : mode === "verified"
                ? "Verified manifestations"
                : "All manifestations"}
            {rowsLoading ? (
              <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({filteredRows.length} of {rows.length})
              </span>
            )}
          </h2>

          {mode === "pending" && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || rows.length === 0}
              onClick={onVerifyAll}
            >
              <Check className="mr-2 h-4 w-4" />
              Verify all
            </Button>
          )}
        </div>

        {/* Filter Toolbar */}
        {rows.length > 0 && (
          <KitReaderFilters
            filters={filters}
            onFilterChange={setFilters}
            totalCount={rows.length}
            filteredCount={filteredRows.length}
          />
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">
            {mode === "pending"
              ? "No pending ATMs for this awakener."
              : mode === "verified"
                ? "No verified manifestations found. Add one or verify items from the pending queue."
                : "No manifestations found for this awakener."}
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">
            No manifestations match the selected filters.
          </p>
        ) : (
          <ul className="space-y-3">
            {filteredRows.map((row) => {
              const nonPositiveCopies = hasNonPositiveInstanceOrCopies(
                pendingRowToEditRecord(row),
              );
              return (
                <li
                  key={row.id}
                  className={cn(
                    "rounded-lg border border-border bg-white px-4 py-3 shadow-2xs transition-colors",
                    nonPositiveCopies && "border-amber-200 bg-amber-50",
                  )}
                  title={
                    nonPositiveCopies
                      ? NON_POSITIVE_INSTANCE_OR_COPIES_HINT
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-zinc-950">
                          #{row.id}{" "}
                          <span
                            className="text-zinc-700"
                            title={row.tag_name ?? `tag:${row.tag_id}`}
                          >
                            {row.tag_name ?? `tag:${row.tag_id}`}
                          </span>
                        </p>
                        {mode === "all" && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold border",
                              row.verified
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                            )}
                          >
                            {row.verified ? "Verified" : "Pending"}
                          </span>
                        )}
                      </div>

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                        {PENDING_COLUMN_FIELDS.map((name) => {
                          const field = pendingInlineField(name);
                          const label = pendingColumnLabel(name);
                          const isMetadata = name === "metadata";

                          if (field) {
                            const value = readPendingFieldValue(row, name);
                            const title = formatCellDisplayValue(
                              field.name,
                              value,
                              fkLabels,
                            );
                            return (
                              <PendingField
                                key={name}
                                label={label}
                                title={title === "—" ? undefined : title}
                                truncate={!isMetadata}
                                className={
                                  isMetadata
                                    ? "col-span-2 sm:col-span-3 lg:col-span-4"
                                    : undefined
                                }
                              >
                                <EditableCell
                                  tableName={ATM_CONFIG.name}
                                  recordId={row.id}
                                  field={field}
                                  value={value}
                                  fkLabels={fkLabels}
                                  fkOptions={fkOptionsByField[field.name] ?? []}
                                  disabled={busy}
                                  isActive={
                                    editingCell?.recordId === row.id &&
                                    editingCell.fieldName === field.name
                                  }
                                  onActivate={() =>
                                    setEditingCell({
                                      recordId: row.id,
                                      fieldName: field.name,
                                    })
                                  }
                                  onDeactivate={() => setEditingCell(null)}
                                  onUpdate={handleInlineUpdate}
                                />
                              </PendingField>
                            );
                          }

                          const staticValue = formatStaticPendingValue(
                            row,
                            name,
                            fkLabels,
                          );
                          return (
                            <PendingField
                              key={name}
                              label={label}
                              title={staticValue.title}
                            >
                              {staticValue.display}
                            </PendingField>
                          );
                        })}
                      </dl>

                      {row.locals.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-zinc-500">
                            Local interactions ({row.locals.length})
                          </p>
                          <ul className="space-y-1">
                            {row.locals.map((local) => (
                              <li
                                key={local.id}
                                className="text-sm text-zinc-700"
                              >
                                <span className="font-medium text-zinc-900">
                                  {local.mode}
                                </span>
                                {local.math_operation != null && (
                                  <>
                                    {" "}
                                    · {local.math_operation}
                                    {local.value_scalar != null
                                      ? ` ${local.value_scalar}`
                                      : ""}
                                  </>
                                )}
                                {local.modifier_tag_id != null && (
                                  <>
                                    {" "}
                                    · modifier{" "}
                                    <span
                                      title={
                                        local.modifier_tag_name
                                          ? `${local.modifier_tag_name} (id ${local.modifier_tag_id})`
                                          : undefined
                                      }
                                    >
                                      {local.modifier_tag_name ??
                                        `tag:${local.modifier_tag_id}`}
                                    </span>
                                  </>
                                )}
                                {local.target_tag_id != null && (
                                  <>
                                    {" "}
                                    · target{" "}
                                    <span
                                      title={
                                        local.target_tag_name
                                          ? `${local.target_tag_name} (id ${local.target_tag_id})`
                                          : undefined
                                      }
                                    >
                                      {local.target_tag_name ??
                                        `tag:${local.target_tag_id}`}
                                    </span>
                                  </>
                                )}
                                {local.is_disabled ? " · disabled" : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => onEdit(row)}
                        title="Edit manifestation & local interactions"
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => onClone(row)}
                        title="Duplicate as a new manifestation"
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Clone
                      </Button>
                      {!row.verified ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => onVerify(row.id)}
                          title="Verify this pending manifestation"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Verify
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => onUnverify(row.id)}
                          title="Move back to pending queue"
                        >
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          Unverify
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => onSoftDelete(row.id)}
                        title="Soft-delete this manifestation"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      <ManifestationFormDialog
        config={ATM_CONFIG}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingRecord(null);
        }}
        record={editingRecord}
        onSuccess={onEditSuccess}
      />
    </div>
  );
}

function PendingField({
  label,
  children,
  title,
  truncate = true,
  className,
}: {
  label: string;
  children: ReactNode;
  title?: string;
  truncate?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={
          truncate
            ? "truncate text-sm text-zinc-900"
            : "text-sm text-zinc-900"
        }
        title={title}
      >
        {children}
      </dd>
    </div>
  );
}
