import { ChevronDown } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Fragment, useState } from 'react';

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  emptyText?: string;
  minWidth?: string;
  maxHeight?: string;
  mobileRender?: (row: T, index: number) => ReactNode;
  renderExpandedRow?: (row: T) => ReactNode;
  isRowExpandable?: (row: T) => boolean;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  emptyText = 'Belum ada data.',
  minWidth = '100%',
  maxHeight = '520px',
  mobileRender,
  renderExpandedRow,
  isRowExpandable
}: DataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  const toggleRow = (id: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div
        className={`q-data-table overflow-auto q-scrollbar ${mobileRender ? 'hidden md:block' : ''}`}
        style={{ maxHeight, '--table-min-width': minWidth } as CSSProperties}
      >
        <table className="q-data-table-inner w-full border-separate border-spacing-y-2">
          <thead>
            <tr>
              {renderExpandedRow ? (
                <th className="sticky top-0 z-10 w-12 bg-[#E1EFF7] px-4 py-2"></th>
              ) : null}
              {columns.map((column) => (
                <th key={column.key} className={`sticky top-0 z-10 bg-[#E1EFF7] px-4 py-2 text-left text-xs font-bold uppercase text-[#636E72] ${column.className ?? ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-semibold text-[#636E72]" colSpan={columns.length + (renderExpandedRow ? 1 : 0)}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const rowId = row.id ?? index;
                const isExpanded = expandedRows.has(rowId);
                const expandable = isRowExpandable ? isRowExpandable(row) : true;
                return (
                  <Fragment key={rowId}>
                    <tr className="bg-white group">
                      {renderExpandedRow ? (
                        <td className={`px-4 py-3 align-middle ${isExpanded ? 'rounded-tl-2xl' : 'rounded-l-2xl'}`}>
                          {expandable ? (
                            <button
                              onClick={() => toggleRow(rowId)}
                              className="grid h-8 w-8 place-items-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                              <ChevronDown size={18} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                      {columns.map((column, columnIndex) => (
                        <td
                          key={column.key}
                          className={`px-4 py-2.5 align-middle text-sm font-medium text-[#2D3436] ${
                            !renderExpandedRow && columnIndex === 0 ? 'rounded-l-2xl' : ''
                          } ${columnIndex === columns.length - 1 ? (isExpanded ? 'rounded-tr-2xl' : 'rounded-r-2xl') : ''} ${column.className ?? ''}`}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                    {renderExpandedRow && isExpanded && expandable ? (
                      <tr className="bg-[#fcfdfd]">
                        <td colSpan={columns.length + 1} className="rounded-b-2xl px-6 py-4 border-t border-gray-100">
                          <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                            {renderExpandedRow(row)}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {mobileRender ? (
        <div className="grid gap-3 overflow-y-auto q-scrollbar md:hidden" style={{ maxHeight }}>
          {rows.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-semibold text-[#636E72]">{emptyText}</div>
          ) : (
            rows.map((row, index) => <div key={row.id ?? index}>{mobileRender(row, index)}</div>)
          )}
        </div>
      ) : null}
    </>
  );
}
