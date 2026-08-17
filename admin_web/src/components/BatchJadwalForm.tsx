import { Plus, Trash2, CheckCircle2, User, BookOpen, Clock, CalendarDays } from 'lucide-react';
import React, { FormEvent, useState, useMemo, memo } from 'react';
import { ModalForm } from './ModalForm';
import { api, type ApiRecord } from '../services/api';

interface BatchJadwalRow {
  key: string;
  mapel_id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  class_id: string;
  sifir: string;
}

interface BatchJadwalFormProps {
  teachers: ApiRecord[];
  mapel: ApiRecord[];
  classes: ApiRecord[];
  days: string[];
  onClose: () => void;
  onSuccess: () => void;
}

function generateKey() {
  return Math.random().toString(36).substring(7);
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

const RowItem = memo(function RowItem({
  row, index, mapelOptions, classOptions, days, onUpdate, onRemove, canRemove
}: {
  row: BatchJadwalRow;
  index: number;
  mapelOptions: React.ReactNode;
  classOptions: React.ReactNode;
  days: string[];
  onUpdate: (key: string, field: keyof BatchJadwalRow, value: string) => void;
  onRemove: (key: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-[20px] border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:border-[#138F81]/30 hover:shadow-md sm:flex-nowrap sm:items-end group">
      <div className="w-8 shrink-0 text-center font-extrabold text-slate-300 sm:pb-3 group-hover:text-[#138F81]/50 transition-colors">#{index + 1}</div>
      
      <label className="w-full sm:w-[25%] relative">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#636E72]"><BookOpen size={12} /> Mata Pelajaran</span>
        <select className="q-input !py-2.5 !text-sm !rounded-xl !bg-slate-50 focus:!bg-white" value={row.mapel_id} onChange={(e) => onUpdate(row.key, 'mapel_id', e.target.value)} required>
          <option value="">Pilih Mapel...</option>
          {mapelOptions}
        </select>
      </label>

      <label className="w-full sm:w-[20%] relative">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#636E72]"><User size={12} /> Kelas/Sifir</span>
        <select className="q-input !py-2.5 !text-sm !rounded-xl !bg-slate-50 focus:!bg-white" value={row.class_id} onChange={(e) => onUpdate(row.key, 'class_id', e.target.value)}>
          <option value="">Semua / Bebas</option>
          {classOptions}
        </select>
      </label>

      <label className="w-full sm:w-[15%] relative">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#636E72]"><CalendarDays size={12} /> Hari</span>
        <select className="q-input !py-2.5 !text-sm !rounded-xl !bg-slate-50 focus:!bg-white" value={row.hari} onChange={(e) => onUpdate(row.key, 'hari', e.target.value)} required>
          {days.map((day) => <option key={day} value={day}>{day}</option>)}
        </select>
      </label>

      <div className="flex w-full sm:w-[25%] gap-2">
        <label className="w-1/2 relative">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#636E72]"><Clock size={12} /> Mulai</span>
          <input type="time" className="q-input !py-2.5 !text-sm !rounded-xl !bg-slate-50 focus:!bg-white" value={row.jam_mulai} onChange={(e) => onUpdate(row.key, 'jam_mulai', e.target.value)} required />
        </label>
        <label className="w-1/2 relative">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#636E72]"><Clock size={12} /> Selesai</span>
          <input type="time" className="q-input !py-2.5 !text-sm !rounded-xl !bg-slate-50 focus:!bg-white" value={row.jam_selesai} onChange={(e) => onUpdate(row.key, 'jam_selesai', e.target.value)} required />
        </label>
      </div>

      <button 
        type="button" 
        onClick={() => onRemove(row.key)}
        disabled={!canRemove}
        className="h-[42px] shrink-0 rounded-xl bg-rose-50 px-3.5 text-rose-500 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-40 disabled:hover:bg-rose-50 disabled:hover:text-rose-500 shadow-sm"
        title="Hapus Baris"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
});

export function BatchJadwalForm({ teachers, mapel, classes, days, onClose, onSuccess }: BatchJadwalFormProps) {
  const [teacherId, setTeacherId] = useState('');
  const [rows, setRows] = useState<BatchJadwalRow[]>([
    { key: generateKey(), mapel_id: '', hari: 'Senin', jam_mulai: '', jam_selesai: '', class_id: '', sifir: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const mapelOptions = useMemo(() => mapel.map((m) => <option key={num(m.id)} value={num(m.id)}>{text(m.nama)}</option>), [mapel]);
  const classOptions = useMemo(() => classes.map((c) => <option key={num(c.id)} value={num(c.id)}>{text(c.nama ?? c.name ?? c.kelas)}</option>), [classes]);
  const teacherOptions = useMemo(() => teachers.map((t) => <option key={num(t.id)} value={num(t.id)}>{text(t.name)}</option>), [teachers]);

  function addRow() {
    setRows(prev => [...prev, { key: generateKey(), mapel_id: '', hari: 'Senin', jam_mulai: '', jam_selesai: '', class_id: '', sifir: '' }]);
  }

  function removeRow(key: string) {
    setRows(prev => prev.length > 1 ? prev.filter((r) => r.key !== key) : prev);
  }

  function updateRow(key: string, field: keyof BatchJadwalRow, value: string) {
    setRows(prev => prev.map((r) => r.key === key ? { ...r, [field]: value } : r));
  }

  async function saveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherId) {
      setError('Silakan pilih guru terlebih dahulu.');
      return;
    }
    
    // Validate rows
    const invalidRow = rows.find(r => !r.mapel_id || !r.hari || !r.jam_mulai || !r.jam_selesai);
    if (invalidRow) {
      setError('Mohon lengkapi semua kolom (Mapel, Hari, Jam Mulai, Jam Selesai) pada setiap baris.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Execute all creates in parallel
      await Promise.all(rows.map(row => {
        const payload: ApiRecord = {
          hari: row.hari,
          jam_mulai: row.jam_mulai,
          jam_selesai: row.jam_selesai,
          mapel_id: Number(row.mapel_id),
          teacher_id: Number(teacherId),
          class_id: row.class_id ? Number(row.class_id) : null,
          sifir: row.sifir || null,
          status: 'Aktif'
        };
        return api.createJadwal(payload);
      }));

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beberapa jadwal gagal disimpan.');
      setIsSaving(false);
    }
  }

  return (
    <ModalForm
      title="Setting Jadwal Guru (Batch)"
      onClose={onClose}
      footer={
        <button className="min-h-12 w-full rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60 flex items-center justify-center gap-2" disabled={isSaving} form="batch-jadwal-form" type="submit">
          {isSaving ? <span className="animate-spin text-lg">⏳</span> : <CheckCircle2 size={18} />}
          {isSaving ? 'Menyimpan...' : `Simpan ${rows.length} Jadwal`}
        </button>
      }
    >
      <form id="batch-jadwal-form" className="space-y-6" onSubmit={saveForm}>
        {error && <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div>}

        <section className="rounded-[24px] bg-slate-50/80 p-5 border border-slate-200/60 shadow-sm backdrop-blur-sm">
          <label className="block max-w-md">
            <span className="mb-2 flex items-center gap-2 text-sm font-bold text-[#636E72]"><User size={16} /> Pilih Guru Pengajar</span>
            <select className="q-input !bg-white !py-3 !rounded-2xl !text-base shadow-sm focus:!ring-[#138F81]/20 focus:!border-[#138F81]" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
              <option value="">Pilih guru pengajar...</option>
              {teacherOptions}
            </select>
          </label>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-[#2D3436]">Daftar Jadwal Mengajar</h3>
              <p className="text-xs font-semibold text-[#636E72] mt-0.5">Atur mata pelajaran, kelas, hari, dan waktu secara spesifik.</p>
            </div>
            <button type="button" onClick={addRow} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#E8F7F3] px-4 text-sm font-bold text-[#138F81] shadow-sm transition-all hover:bg-[#138F81] hover:text-white hover:shadow-md">
              <Plus size={16} /> Tambah Jadwal
            </button>
          </div>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 q-scrollbar pb-4">
            {rows.map((row, index) => (
              <RowItem 
                key={row.key}
                row={row}
                index={index}
                mapelOptions={mapelOptions}
                classOptions={classOptions}
                days={days}
                onUpdate={updateRow}
                onRemove={removeRow}
                canRemove={rows.length > 1}
              />
            ))}
          </div>
        </section>
      </form>
    </ModalForm>
  );
}
