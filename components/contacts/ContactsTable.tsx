'use client';

import React, { useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Contact } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { StageBadge } from '@/components/ui/StageBadge';

interface ContactsTableProps {
  contacts: Contact[];
  selectedId?: string | null;
  onSelect: (contact: Contact) => void;
  globalFilter: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ContactsTable({ contacts, selectedId, onSelect, globalFilter }: ContactsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Contact>[]>(
    () => [
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
        cell: ({ getValue }) => <span className="text-fg-muted">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'companyName',
        header: 'Company',
        cell: ({ getValue }) => <span className="text-fg">{getValue<string>() || <span className="text-fg-subtle">—</span>}</span>,
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
        cell: ({ getValue }) => <span className="whitespace-nowrap text-fg-muted">{formatDate(getValue<string>())}</span>,
      },
    ],
    []
  );

  const table = useReactTable({
    data: contacts,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filter) => {
      const term = String(filter).toLowerCase();
      const c = row.original;
      return [c.firstName, c.lastName, c.email, c.companyName, c.title, ...(c.tags || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    },
  });

  const rows = table.getRowModel().rows;

  return (
    <>
      {/* Phones: compact list */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => {
          const c = row.original;
          const name = `${c.firstName} ${c.lastName}`.trim() || c.email;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
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
                    <th key={header.id} className="bg-surface-2">
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-fg"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
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
                className={`cursor-pointer ${selectedId === row.original.id ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
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
