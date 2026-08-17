import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
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

export function BatchJadwalForm({ teachers, mapel, classes, days, onClose, onSuccess }: BatchJadwalFormProps) {
  const [teacherId, setTeacherId] = useState('');
  const [rows, setRows] = useState<BatchJadwalRow[]>([
    { key: generateKey(), mapel_id: '', hari: 'Senin', jam_mulai: '', jam_selesai: '', class_id: '', sifir: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  function addRow() {
    setRows([...rows, { key: generateKey(), mapel_id: '', hari: 'Senin', jam_mulai: '', jam_selesai: '', class_id: '', sifir: '' }]);
  }

  function removeRow(key: string) {
    if (rows.length <= 1) return;
    setRows(rows.filter((r) => r.key !== key));
  }

  function updateRow(key: string, field: keyof BatchJadwalRow, value: string) {
    setRows(rows.map((r) => r.key === key ? { ...r, [field]: value } : r));
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

        <section className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
          <label className="block max-w-md">
            <span className="mb-2 block text-sm font-bold text-[#636E72]">Pilih Guru Pengajar</span>
            <select className="q-input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
              <option value="">Pilih guru...</option>
              {teachers.map((t) => <option key={num(t.id)} value={num(t.id)}>{text(t.name)}</option>)}
            </select>
          </label>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#2D3436]">Daftar Mata Pelajaran & Waktu</h3>
            <button type="button" onClick={addRow} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#E8F7F3] px-4 text-xs font-bold text-[#138F81] transition hover:bg-[#D1EFE8]">
              <Plus size={14} /> Tambah Mapel
            </button>
          </div>

          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 q-scrollbar">
            {rows.map((row, index) => (
              <div key={row.key} className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-nowrap sm:items-end">
                <div className="w-8 shrink-0 text-center font-bold text-slate-300 sm:pb-3">#{index + 1}</div>
                
                <label className="w-full sm:w-[25%]">
                  <span className="mb-1 block text-xs font-semibold text-[#636E72]">Mata Pelajaran</span>
                  <select className="q-input !py-2 !text-sm" value={row.mapel_id} onChange={(e) => updateRow(row.key, 'mapel_id', e.target.value)} required>
                    <option value="">Pilih Mapel...</option>
                    {mapel.map((m) => <option key={num(m.id)} value={num(m.id)}>{text(m.nama)}</option>)}
                  </select>
                </label>

                <label className="w-full sm:w-[20%]">
                  <span className="mb-1 block text-xs font-semibold text-[#636E72]">Kelas/Sifir (Opsional)</span>
                  <select className="q-input !py-2 !text-sm" value={row.class_id} onChange={(e) => updateRow(row.key, 'class_id', e.target.value)}>
                    <option value="">Semua / Bebas</option>
                    {classes.map((c) => <option key={num(c.id)} value={num(c.id)}>{text(c.nama ?? c.name ?? c.kelas)}</option>)}
                  </select>
                </label>

                <label className="w-full sm:w-[15%]">
                  <span className="mb-1 block text-xs font-semibold text-[#636E72]">Hari</span>
                  <select className="q-input !py-2 !text-sm" value={row.hari} onChange={(e) => updateRow(row.key, 'hari', e.target.value)} required>
                    {days.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                </label>

                <div className="flex w-full sm:w-[25%] gap-2">
                  <label className="w-1/2">
                    <span className="mb-1 block text-xs font-semibold text-[#636E72]">Mulai</span>
                    <input type="time" className="q-input !py-2 !text-sm" value={row.jam_mulai} onChange={(e) => updateRow(row.key, 'jam_mulai', e.target.value)} required />
                  </label>
                  <label className="w-1/2">
                    <span className="mb-1 block text-xs font-semibold text-[#636E72]">Selesai</span>
                    <input type="time" className="q-input !py-2 !text-sm" value={row.jam_selesai} onChange={(e) => updateRow(row.key, 'jam_selesai', e.target.value)} required />
                  </label>
                </div>

                <button 
                  type="button" 
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length <= 1}
                  className="h-10 shrink-0 rounded-xl bg-[#FDECEC] px-3 text-[#D63031] transition hover:bg-[#FAD4D4] disabled:opacity-50"
                  title="Hapus Baris"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </form>
    </ModalForm>
  );
}
