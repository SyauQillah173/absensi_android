import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
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
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
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
  enablePagination = true,
  defaultSortKey,
  defaultSortDirection = 'desc',
}: DataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDirection);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;

    return [...rows].sort((a, b) => {
      let valA: unknown;
      let valB: unknown;

      if (col.sortValue) {
        valA = col.sortValue(a);
        valB = col.sortValue(b);
      } else {
        valA = (a as Record<string, unknown>)[sortKey];
        valB = (b as Record<string, unknown>)[sortKey];
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA ?? '').toLowerCase();
      const strB = String(valB ?? '').toLowerCase();
      return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [rows, sortKey, sortDir, columns]);

  // Reset to page 1 whenever rows array changes (e.g. searching/filtering/sorting)
  useEffect(() => {
    setCurrentPage(1);
  }, [sortedRows.length, pageSize, sortKey, sortDir]);

  const totalRows = sortedRows.length;
  const isPaging = enablePagination && pageSize > 0 && totalRows > pageSize;
  const totalPages = isPaging ? Math.ceil(totalRows / pageSize) : 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    if (!isPaging) return sortedRows;
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, isPaging, safePage, pageSize]);


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
              {columns.map((column) => {
                const isCurrentSort = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    onClick={() => column.sortable && handleSort(column.key)}
                    className={`sticky top-0 z-10 bg-[#E1EFF7] px-4 py-2.5 text-left text-xs font-bold uppercase text-[#636E72] select-none ${
                      column.sortable ? 'cursor-pointer hover:bg-[#d2e4f0] transition-colors' : ''
                    } ${column.className ?? ''}`}
                    title={column.sortable ? `Klik untuk urutkan berdasarkan ${column.header}` : undefined}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>{column.header}</span>
                      {column.sortable && (
                        <span
                          className={`inline-flex items-center transition-all ${
                            isCurrentSort ? 'text-[#138F81] font-black scale-110' : 'text-slate-400 opacity-60'
                          }`}
                        >
                          {isCurrentSort ? (
                            sortDir === 'asc' ? (
                              <ArrowUp size={14} className="stroke-[2.5]" />
                            ) : (
                              <ArrowDown size={14} className="stroke-[2.5]" />
                            )
                          ) : (
                            <ArrowUpDown size={14} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}

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
