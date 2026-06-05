import type { CSSProperties, ReactNode } from 'react';

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
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  emptyText = 'Belum ada data.',
  minWidth = '720px',
  maxHeight = '520px',
  mobileRender
}: DataTableProps<T>) {
  return (
    <>
      <div
        className={`q-data-table overflow-auto q-scrollbar ${mobileRender ? 'hidden md:block' : ''}`}
        style={{ maxHeight, '--table-min-width': minWidth } as CSSProperties}
      >
        <table className="q-data-table-inner w-full border-separate border-spacing-y-2">
          <thead>
            <tr>
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
                <td className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-semibold text-[#636E72]" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id ?? index} className="bg-white">
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 text-sm font-medium text-[#2D3436] ${
                        columnIndex === 0 ? 'rounded-l-2xl' : ''
                      } ${columnIndex === columns.length - 1 ? 'rounded-r-2xl' : ''} ${column.className ?? ''}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
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
