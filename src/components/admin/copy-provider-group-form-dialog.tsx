"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getForeignKeyOptions,
  listCopyProviderGroupMembers,
  saveCopyProviderGroupWithMembers,
  type CopyProviderGroupMemberInput,
  type ForeignKeyOption,
} from "@/lib/actions/crud";
import type { FieldConfig, TableConfig } from "@/lib/schema-config";
import { getFormFields } from "@/lib/schema-config";

type CopyProviderGroupFormDialogProps = {
  config: TableConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Record<string, unknown> | null;
  onSuccess: () => void;
};

type MemberDraft = CopyProviderGroupMemberInput & {
  clientKey: string;
};

function getInitialValues(
  config: TableConfig,
  record?: Record<string, unknown> | null,
) {
  const values: Record<string, unknown> = {};
  for (const field of getFormFields(config)) {
    values[field.name] = record?.[field.name] ?? field.defaultValue ?? null;
  }
  return values;
}

function createEmptyMember(): MemberDraft {
  return {
    clientKey: crypto.randomUUID(),
    tag_id: null,
  };
}

function toMemberDraft(row: Record<string, unknown>): MemberDraft {
  return {
    clientKey: `existing-${String(row.id)}`,
    id: Number(row.id),
    tag_id: row.tag_id == null ? null : Number(row.tag_id),
  };
}

export function CopyProviderGroupFormDialog({
  config,
  open,
  onOpenChange,
  record,
  onSuccess,
}: CopyProviderGroupFormDialogProps) {
  const isEditing = Boolean(record?.id != null);
  const childConfig = config.childTables?.[0];
  const memberFields = childConfig?.fields ?? [];

  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [members, setMembers] = React.useState<MemberDraft[]>([]);
  const [fkOptions, setFkOptions] = React.useState<
    Record<string, ForeignKeyOption[]>
  >({});
  const [loading, setLoading] = React.useState(false);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [createMore, setCreateMore] = React.useState(false);

  const formSessionKey = open
    ? isEditing
      ? `edit:${String(record?.id ?? "")}`
      : "create"
    : "closed";

  React.useEffect(() => {
    if (!open) return;

    setCreateMore(false);
    setValues(getInitialValues(config, record));
    setMembers([]);

    const groupFkFields = getFormFields(config).filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );
    const memberFkFields = memberFields.filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );
    const fkFields = [...groupFkFields, ...memberFkFields];

    setLoadingOptions(true);

    const loadMembers = isEditing
      ? listCopyProviderGroupMembers(Number(record!.id)).then((result) => {
          if (result.success) {
            setMembers(result.data.map(toMemberDraft));
          } else {
            toast.error(result.error);
          }
        })
      : Promise.resolve();

    const loadFkOptions = Promise.all(
      fkFields.map(async (field) => {
        const fk = field.foreignKey!;
        const result = await getForeignKeyOptions(
          fk.table,
          fk.displayColumn,
          fk.labelKind,
          fk.filterBy?.column,
        );
        return {
          fieldName: field.name,
          options: result.success ? result.data : [],
        };
      }),
    ).then((results) => {
      const next: Record<string, ForeignKeyOption[]> = {};
      for (const item of results) {
        next[item.fieldName] = item.options;
      }
      setFkOptions(next);
    });

    Promise.all([loadMembers, loadFkOptions]).finally(() => {
      setLoadingOptions(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on session only
  }, [formSessionKey]);

  function updateValue(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateMember(clientKey: string, tagId: number | null) {
    setMembers((current) =>
      current.map((member) =>
        member.clientKey === clientKey ? { ...member, tag_id: tagId } : member,
      ),
    );
  }

  function addMember() {
    setMembers((current) => [...current, createEmptyMember()]);
  }

  function removeMember(clientKey: string) {
    setMembers((current) =>
      current.filter((member) => member.clientKey !== clientKey),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const payload: Record<string, unknown> = {};
    for (const field of getFormFields(config)) {
      let value = values[field.name];

      if (field.type === "number" || field.type === "id") {
        value = value === "" || value == null ? null : Number(value);
      }

      if (field.required && (value == null || value === "")) {
        toast.error(`${field.label} is required`);
        setLoading(false);
        return;
      }

      payload[field.name] = value;
    }

    for (const [index, member] of members.entries()) {
      if (member.tag_id == null) {
        toast.error(`Tag is required for member ${index + 1}`);
        setLoading(false);
        return;
      }
    }

    const memberPayload: CopyProviderGroupMemberInput[] = members.map(
      ({ clientKey: _clientKey, ...member }) => member,
    );

    const result = await saveCopyProviderGroupWithMembers(
      payload,
      memberPayload,
      isEditing ? Number(record!.id) : undefined,
    );

    setLoading(false);

    if (result.success) {
      toast.success(isEditing ? "Record updated" : "Record created");
      onSuccess();
      if (!isEditing && createMore) {
        setValues((current) => ({ ...current, ...payload }));
        setMembers([]);
      } else {
        onOpenChange(false);
      }
    } else {
      toast.error(result.error);
    }
  }

  function renderGroupField(field: FieldConfig) {
    const value = values[field.name];
    return (
      <Input
        value={value == null ? "" : String(value)}
        onChange={(event) => updateValue(field.name, event.target.value)}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Create"} Copy Provider Group
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {getFormFields(config).map((field) => (
            <div key={field.name} className="space-y-2">
              <Label>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              {renderGroupField(field)}
            </div>
          ))}

          {childConfig && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-zinc-900">
                    {childConfig.label}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Tags whose Layer A totals add copies to linked ATMs.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMember}
                  disabled={loadingOptions}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add member
                </Button>
              </div>

              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-zinc-500">
                  No members. Add tags that provide extra copies.
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map((member, index) => (
                    <div
                      key={member.clientKey}
                      className="flex items-end gap-2 rounded-lg border border-border bg-zinc-50 p-3"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <Label>Tag {index + 1}</Label>
                        <ForeignKeyCombobox
                          value={member.tag_id}
                          onChange={(next) =>
                            updateMember(member.clientKey, next)
                          }
                          options={fkOptions.tag_id ?? []}
                          disabled={loadingOptions}
                          placeholder="Select tag..."
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(member.clientKey)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            {!isEditing && (
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={createMore}
                  onChange={(event) => setCreateMore(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Create more
              </label>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || loadingOptions}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Save changes" : "Create record"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
