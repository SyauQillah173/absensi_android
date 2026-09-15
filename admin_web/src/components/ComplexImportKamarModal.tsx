import { AlertCircle, CheckCircle2, DoorOpen, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { api } from '../services/api';

interface ComplexImportKamarModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ComplexImportKamarModal({ onClose, onSuccess }: ComplexImportKamarModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    imported?: number;
    updated?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setError('Format file tidak didukung. Harap pilih file Excel (.xlsx, .xls) atau CSV.');
      setFile(null);
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await api.downloadBoardingRoomTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Template_Import_Kamar.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mendownload template kamar');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Silakan pilih file Excel/CSV terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.importBoardingRooms(file);
      setResult({
        success: true,
        message: res.message || 'Import data kamar berhasil diselesaikan.',
        imported: (res as any).imported_count ?? 0,
        updated: (res as any).updated_count ?? 0
      });
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengimpor data kamar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-[#138F81] text-white flex items-center justify-center shadow-md shadow-teal-700/20">
              <DoorOpen size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Import Data Kamar Pondok</h2>
              <p className="text-xs font-semibold text-slate-500">Unggah file Excel / CSV master kamar asrama</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* PETUNJUK & DOWNLOAD TEMPLATE */}
          <div className="rounded-2xl bg-teal-50/70 border border-teal-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#138F81]">
                <FileSpreadsheet size={15} />
                <span>Format Kolom Template</span>
              </div>
              <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                Kolom: <b>NAMA_KAMAR</b>, <b>KOMPLEK_ASRAMA</b>, <b>KAPASITAS</b>, <b>KETERANGAN</b>, <b>STATUS</b>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDownloadTemplate()}
              disabled={downloadingTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-teal-200 px-3.5 py-2 text-xs font-bold text-[#138F81] hover:bg-teal-50 transition shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download size={14} />
              {downloadingTemplate ? 'Mengunduh...' : 'Unduh Template'}
            </button>
          </div>

          {/* DROPZONE */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-7 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 ${
              isDragging
                ? 'border-[#138F81] bg-teal-50/50 scale-[0.99]'
                : file
                ? 'border-teal-400 bg-teal-50/30'
                : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="h-14 w-14 rounded-2xl bg-teal-50 text-[#138F81] flex items-center justify-center border border-teal-100 shadow-xs">
              <Upload size={26} />
            </div>

            {file ? (
              <div>
                <p className="text-sm font-black text-slate-800">{file.name}</p>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB — Klik untuk ganti file
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-slate-700">
                  Tarik & letakkan file di sini, atau <span className="text-[#138F81] underline">pilih file</span>
                </p>
                <p className="text-xs font-medium text-slate-400 mt-1">Mendukung format .XLSX, .XLS, dan .CSV (Maksimal 5MB)</p>
              </div>
            )}
          </div>

          {/* ALERTS */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs font-medium animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 text-xs font-medium">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">{result.message}</p>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Kamar baru: <b>{result.imported}</b> | Kamar diperbarui: <b>{result.updated}</b>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || isLoading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-xs font-black text-white shadow-md shadow-teal-700/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Memproses Data...</span>
              </>
            ) : (
              <>
                <Upload size={15} />
                <span>Mulai Import Kamar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
