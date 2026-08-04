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
import { Contact } from '@/types';
import { MoreHorizontal } from 'lucide-react';

interface ContactsTableProps {
  contacts: Contact[];
  selectedId?: string | null;
  onSelect: (contact: Contact) => void;
  globalFilter: string;
}

export function ContactsTable({
  contacts,
  selectedId,
  onSelect,
  globalFilter,
}: ContactsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        id: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="font-semibold text-white">
            {row.original.firstName} {row.original.lastName}
          </span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => (
          <span className="text-gray-400 font-mono">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'companyName',
        header: 'Company',
        cell: ({ getValue }) => getValue<string>() || '—',
      },
      {
        accessorKey: 'lifecycleStage',
        header: 'Stage',
        cell: ({ getValue }) => (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-mustard-500/10 text-mustard-400 border border-mustard-500/20 capitalize">
            {getValue<string>()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: () => (
          <button className="text-gray-400 hover:text-white p-1" type="button">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        ),
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
      return (
        c.firstName.toLowerCase().includes(term) ||
        c.lastName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.companyName || '').toLowerCase().includes(term)
      );
    },
  });

  return (
    <div className="overflow-auto max-h-[70vh]">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/5 border-b border-white/10 text-dark-muted font-medium uppercase tracking-wider sticky top-0 backdrop-blur-md">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="p-4 cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-white/5 text-gray-300">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row.original)}
              className={`hover:bg-white/5 transition-colors cursor-pointer ${
                selectedId === row.original.id ? 'bg-white/10 border-l-2 border-mustard-500' : ''
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`p-4 ${cell.column.id === 'actions' ? 'text-right' : ''}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
