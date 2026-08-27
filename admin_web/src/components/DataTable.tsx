import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';

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
  pageSize?: number;
  enablePagination?: boolean;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  emptyText = 'Belum ada data.',
  minWidth = '100%',
  maxHeight = '560px',
  mobileRender,
  renderExpandedRow,
  isRowExpandable,
  pageSize: initialPageSize = 25,
  enablePagination = true
}: DataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Reset to page 1 whenever rows array changes (e.g. searching/filtering)
  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length, pageSize]);

  const totalRows = rows.length;
  const isPaging = enablePagination && pageSize > 0 && totalRows > pageSize;
  const totalPages = isPaging ? Math.ceil(totalRows / pageSize) : 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    if (!isPaging) return rows;
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, isPaging, safePage, pageSize]);

  const toggleRow = (id: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startIndex = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = isPaging ? Math.min(safePage * pageSize, totalRows) : totalRows;

  return (
    <div className="flex flex-col gap-3">
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
            {paginatedRows.length === 0 ? (
              <tr>
                <td className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-semibold text-[#636E72]" colSpan={columns.length + (renderExpandedRow ? 1 : 0)}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => {
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
          {paginatedRows.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-semibold text-[#636E72]">{emptyText}</div>
          ) : (
            paginatedRows.map((row, index) => <div key={row.id ?? index}>{mobileRender(row, index)}</div>)
          )}
        </div>
      ) : null}

      {/* Pagination Footer Controls */}
      {enablePagination && totalRows > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-2 text-xs font-bold text-[#636E72]">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan <span className="text-[#138F81] font-extrabold">{startIndex}</span> –{' '}
              <span className="text-[#138F81] font-extrabold">{endIndex}</span> dari{' '}
              <span className="text-[#2D3436] font-extrabold">{totalRows.toLocaleString('id-ID')}</span> data
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1">
              <span>Per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-[#2D3436] focus:border-[#138F81] focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={totalRows}>Semua</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safePage <= 1}
                title="Halaman Pertama"
                className="grid h-8 w-8 place-items-center rounded-xl bg-white text-slate-600 hover:bg-[#138F81] hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-colors shadow-sm"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                title="Halaman Sebelumnya"
                className="grid h-8 w-8 place-items-center rounded-xl bg-white text-slate-600 hover:bg-[#138F81] hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-colors shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-3 py-1 font-bold text-[#2D3436] bg-white rounded-xl shadow-sm border border-slate-100">
                Hal {safePage} dari {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                title="Halaman Selanjutnya"
                className="grid h-8 w-8 place-items-center rounded-xl bg-white text-slate-600 hover:bg-[#138F81] hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-colors shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                title="Halaman Terakhir"
                className="grid h-8 w-8 place-items-center rounded-xl bg-white text-slate-600 hover:bg-[#138F81] hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-colors shadow-sm"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
