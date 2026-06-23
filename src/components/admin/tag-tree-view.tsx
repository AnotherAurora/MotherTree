"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  EditableCell,
  formatCellDisplayValue,
} from "@/components/admin/editable-cell";
import { Button } from "@/components/ui/button";
import type { FieldConfig, TableConfig } from "@/lib/schema-config";
import { buildTagTree, collectTreePaths, type TagTreeNode } from "@/lib/tag-tree";

export type EditingCellState = {
  recordId: number;
  fieldName: string;
} | null;

type TagTreeViewProps = {
  config: TableConfig;
  records: Record<string, unknown>[];
  pathField: string;
  showDeletedOnly: boolean;
  deletingId: number | null;
  restoringId: number | null;
  inlineFields: FieldConfig[];
  editingCell: EditingCellState;
  onEditingCellChange: (state: EditingCellState) => void;
  onInlineUpdate: (updated: Record<string, unknown>) => void;
  fkLabels: Record<string, string>;
  onEdit: (record: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
  onPermanentDelete: (id: number) => void;
};

type TreeRowProps = {
  node: TagTreeNode;
  depth: number;
  guides: boolean[];
  isLast: boolean;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  showDeletedOnly: boolean;
  config: TableConfig;
  inlineFields: FieldConfig[];
  editingCell: EditingCellState;
  onEditingCellChange: (state: EditingCellState) => void;
  onInlineUpdate: (updated: Record<string, unknown>) => void;
  fkLabels: Record<string, string>;
  deletingId: number | null;
  restoringId: number | null;
  onEdit: (record: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
  onPermanentDelete: (id: number) => void;
};

function TreeGuides({
  guides = [],
  isLast = false,
  depth,
}: {
  guides?: boolean[];
  isLast?: boolean;
  depth: number;
}) {
  if (depth === 0) return null;

  return (
    <div className="flex shrink-0 self-stretch" aria-hidden>
      {guides.map((continueLine, index) => (
        <div key={index} className="relative w-5 shrink-0">
          {continueLine && (
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-300" />
          )}
        </div>
      ))}
      <div className="relative w-5 shrink-0">
        {!isLast && (
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-300" />
        )}
        <div className="absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 bg-zinc-300" />
        <div className="absolute left-1/2 top-1/2 h-px w-2.5 bg-zinc-300" />
      </div>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  guides,
  isLast,
  expandedPaths,
  onToggle,
  showDeletedOnly,
  config,
  inlineFields,
  editingCell,
  onEditingCellChange,
  onInlineUpdate,
  fkLabels,
  deletingId,
  restoringId,
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
}: TreeRowProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedPaths.has(node.fullPath);
  const record = node.record;
  const isDeleted = record ? Boolean(record.deleted_at) : false;

  return (
    <>
      <div
        className={`flex items-stretch gap-2 border-b border-zinc-100 py-2.5 pl-4 pr-4 text-sm ${
          isDeleted ? "bg-zinc-50 text-zinc-400" : "bg-white"
        }`}
      >
        <TreeGuides guides={guides} isLast={isLast} depth={depth} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.fullPath)}
              className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="inline-block w-5 shrink-0" />
          )}
          <span className="font-medium text-zinc-900">{node.segment}</span>
          {!record && hasChildren && (
            <span className="text-xs text-zinc-400">(folder)</span>
          )}
        </div>
        {record &&
          inlineFields.map((field) => (
            <div key={field.name} className="w-24 shrink-0 self-center">
              {field.inlineEditable && !showDeletedOnly && !isDeleted ? (
                <EditableCell
                  tableName={config.name}
                  recordId={Number(record.id)}
                  field={field}
                  value={record[field.name]}
                  fkLabels={fkLabels}
                  isActive={
                    editingCell?.recordId === Number(record.id) &&
                    editingCell.fieldName === field.name
                  }
                  onActivate={() =>
                    onEditingCellChange({
                      recordId: Number(record.id),
                      fieldName: field.name,
                    })
                  }
                  onDeactivate={() => onEditingCellChange(null)}
                  onUpdate={onInlineUpdate}
                />
              ) : (
                formatCellDisplayValue(
                  field.name,
                  record[field.name],
                  fkLabels,
                )
              )}
            </div>
          ))}
        {record && (
          <div className="flex shrink-0 gap-2">
            {showDeletedOnly ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoringId === Number(record.id)}
                  onClick={() => onRestore(Number(record.id))}
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
                  onClick={() => onPermanentDelete(Number(record.id))}
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
                  onClick={() => onEdit(record)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === Number(record.id)}
                  onClick={() => onDelete(Number(record.id))}
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
        )}
      </div>
      {hasChildren &&
        isExpanded &&
        node.children.map((child, index) => (
          <TreeRow
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            guides={[...(guides ?? []), !isLast]}
            isLast={index === node.children.length - 1}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
            showDeletedOnly={showDeletedOnly}
            config={config}
            inlineFields={inlineFields}
            editingCell={editingCell}
            onEditingCellChange={onEditingCellChange}
            onInlineUpdate={onInlineUpdate}
            fkLabels={fkLabels}
            deletingId={deletingId}
            restoringId={restoringId}
            onEdit={onEdit}
            onDelete={onDelete}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
          />
        ))}
    </>
  );
}

export function TagTreeView({
  config,
  records,
  pathField,
  showDeletedOnly,
  deletingId,
  restoringId,
  inlineFields,
  editingCell,
  onEditingCellChange,
  onInlineUpdate,
  fkLabels,
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
}: TagTreeViewProps) {
  const tree = React.useMemo(
    () => buildTagTree(records, pathField),
    [records, pathField],
  );

  const allPaths = React.useMemo(() => collectTreePaths(tree), [tree]);

  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    () => new Set(allPaths),
  );

  React.useEffect(() => {
    setExpandedPaths(new Set(allPaths));
  }, [allPaths]);

  function togglePath(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedPaths(new Set(allPaths));
  }

  function collapseAll() {
    setExpandedPaths(new Set());
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <div className="flex items-center justify-end gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={expandAll}>
          Expand all
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={collapseAll}>
          Collapse all
        </Button>
      </div>
      {inlineFields.length > 0 && (
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 py-2 pl-4 pr-4 text-xs font-medium text-zinc-600">
          <div className="flex-1" />
          {inlineFields.map((field) => (
            <div key={field.name} className="w-24 shrink-0">
              {field.label}
            </div>
          ))}
          <div className="w-[168px] shrink-0 text-right">Actions</div>
        </div>
      )}
      <div>
        {tree.map((node, index) => (
          <TreeRow
            key={node.fullPath}
            node={node}
            depth={0}
            guides={[]}
            isLast={index === tree.length - 1}
            expandedPaths={expandedPaths}
            onToggle={togglePath}
            showDeletedOnly={showDeletedOnly}
            config={config}
            inlineFields={inlineFields}
            editingCell={editingCell}
            onEditingCellChange={onEditingCellChange}
            onInlineUpdate={onInlineUpdate}
            fkLabels={fkLabels}
            deletingId={deletingId}
            restoringId={restoringId}
            onEdit={onEdit}
            onDelete={onDelete}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
          />
        ))}
      </div>
    </div>
  );
}
