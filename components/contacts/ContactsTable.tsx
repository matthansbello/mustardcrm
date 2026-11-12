'use client';

import React, { useMemo, useState } from 'react';
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  FlexRender,
  globalFilteringFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type FilterFn,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Contact } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { StageBadge } from '@/components/ui/StageBadge';

interface ContactsTableProps {
  contacts: Contact[];
  /** The contact open in the detail panel. */
  selectedId?: string | null;
  onSelect: (contact: Contact) => void;
  globalFilter: string;
  /** Contacts ticked for bulk actions (add to list, tag…). */
  checkedIds: Set<string>;
  onCheckedChange: (ids: string[], checked: boolean) => void;
}

/** A checkbox that can also show the "some selected" (indeterminate) state. */
function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="h-4 w-4 cursor-pointer accent-accent"
    />
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// TanStack Table v9 is opt-in: register only the features this table uses.
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature, // required by global filtering
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns,
});

type Features = typeof features;

/** Matches the search term against name, email, company, title and tags. */
const contactSearch: FilterFn<Features, Contact> = (row, _columnId, filter) => {
  const term = String(filter).toLowerCase();
  const c = row.original;
  return [c.firstName, c.lastName, c.email, c.companyName, c.title, ...(c.tags || [])]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(term));
};

export function ContactsTable({
  contacts,
  selectedId,
  onSelect,
  globalFilter,
  checkedIds,
  onCheckedChange,
}: ContactsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Features, Contact>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        header: ({ table }) => {
          const visibleIds = table.getRowModel().rows.map((r) => r.original.id);
          const checkedCount = visibleIds.filter((id) => checkedIds.has(id)).length;
          return (
            <Checkbox
              checked={visibleIds.length > 0 && checkedCount === visibleIds.length}
              indeterminate={checkedCount > 0}
              onChange={(checked) => onCheckedChange(visibleIds, checked)}
              label={checkedCount === visibleIds.length ? 'Deselect all shown contacts' : 'Select all shown contacts'}
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={checkedIds.has(row.original.id)}
            onChange={(checked) => onCheckedChange([row.original.id], checked)}
            label={`Select ${`${row.original.firstName} ${row.original.lastName}`.trim() || row.original.email}`}
          />
        ),
      },
      {
        accessorFn: (row) => `${row.firstName} ${row.lastName}`.trim(),
        id: 'name',
        header: 'Name',
        cell: ({ row }) => {
          const c = row.original;
          const name = `${c.firstName} ${c.lastName}`.trim() || c.email;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={name} email={c.email} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{name}</p>
                {c.title && <p className="truncate text-xs text-fg-subtle">{c.title}</p>}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => <span className="text-fg-muted">{row.original.email}</span>,
      },
      {
        accessorKey: 'companyName',
        header: 'Company',
        cell: ({ row }) => (
          <span className="text-fg">{row.original.companyName || <span className="text-fg-subtle">—</span>}</span>
        ),
      },
      {
        accessorKey: 'lifecycleStage',
        header: 'Stage',
        cell: ({ row }) => <StageBadge stage={row.original.lifecycleStage} />,
      },
      {
        id: 'tags',
        header: 'Tags',
        enableSorting: false,
        cell: ({ row }) => {
          const tags = row.original.tags || [];
          if (!tags.length) return <span className="text-fg-subtle">—</span>;
          return (
            <div className="flex items-center gap-1">
              {tags.slice(0, 2).map((t) => (
                <span key={t} className="badge badge-neutral max-w-[96px] truncate">
                  {t}
                </span>
              ))}
              {tags.length > 2 && <span className="text-xs text-fg-subtle">+{tags.length - 2}</span>}
            </div>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Added',
        cell: ({ row }) => <span className="whitespace-nowrap text-fg-muted">{formatDate(row.original.createdAt)}</span>,
      },
    ],
    [checkedIds, onCheckedChange]
  );

  const table = useTable({
    features,
    data: contacts,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    globalFilterFn: contactSearch,
  });

  const rows = table.getRowModel().rows;

  return (
    <>
      {/* Phones: compact list */}
      <ul className="divide-y divide-line md:hidden">
        {rows.length > 0 && (
          <li className="flex items-center gap-3 bg-surface-2/60 px-4 py-2 text-xs text-fg-muted">
            <label className="flex min-h-8 items-center gap-3">
              <Checkbox
                checked={rows.every((r) => checkedIds.has(r.original.id))}
                indeterminate={rows.some((r) => checkedIds.has(r.original.id))}
                onChange={(checked) => onCheckedChange(rows.map((r) => r.original.id), checked)}
                label="Select all shown contacts"
              />
              Select all {rows.length.toLocaleString()}
            </label>
          </li>
        )}
        {rows.map((row) => {
          const c = row.original;
          const name = `${c.firstName} ${c.lastName}`.trim() || c.email;
          const checked = checkedIds.has(c.id);
          return (
            <li key={row.id} className={`flex items-stretch ${checked ? 'bg-accent-soft/60' : ''}`}>
              {/* Large tap target for the checkbox, separate from opening the contact. */}
              <label className="flex shrink-0 cursor-pointer items-center pl-4 pr-1">
                <Checkbox checked={checked} onChange={(v) => onCheckedChange([c.id], v)} label={`Select ${name}`} />
              </label>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className={`flex min-w-0 flex-1 items-center gap-3 py-3 pl-2 pr-4 text-left ${
                  selectedId === c.id ? 'bg-accent-soft' : 'active:bg-surface-2'
                }`}
              >
                <Avatar name={name} email={c.email} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-fg">{name}</p>
                    <StageBadge stage={c.lifecycleStage} />
                  </div>
                  <p className="truncate text-xs text-fg-muted">
                    {[c.title, c.companyName].filter(Boolean).join(' · ') || c.email}
                  </p>
                  {(c.title || c.companyName) && <p className="truncate text-xs text-fg-subtle">{c.email}</p>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="hidden max-h-[calc(100vh-260px)] min-h-[200px] overflow-auto md:block">
        <table className="table min-w-[860px]">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id} className={`bg-surface-2 ${header.column.id === 'select' ? 'w-10 pr-0' : ''}`}>
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-fg"
                        >
                          <FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelect(row.original)}
                className={`cursor-pointer ${
                  selectedId === row.original.id
                    ? 'bg-accent-soft'
                    : checkedIds.has(row.original.id)
                      ? 'bg-accent-soft/50 hover:bg-accent-soft/70'
                      : 'hover:bg-surface-2'
                }`}
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cell.column.id === 'select' ? 'w-10 pr-0' : undefined}
                    // The whole checkbox cell toggles selection instead of opening the contact.
                    onClick={
                      cell.column.id === 'select'
                        ? (e) => {
                            e.stopPropagation();
                            onCheckedChange([row.original.id], !checkedIds.has(row.original.id));
                          }
                        : undefined
                    }
                  >
                    <FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-fg-muted">No contacts match your filters.</p>
      )}
    </>
  );
}
