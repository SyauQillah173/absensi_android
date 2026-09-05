import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  Edit2,
  Eye,
  FileText,
  Filter,
  Megaphone,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../../services/api';

export interface PmbAnnouncementItem {
  id: number;
  title: string;
  slug: string;
  content: string;
  category: 'agenda_kedatangan' | 'pengumuman' | 'berita';
  event_date: string | null;
  is_pinned: boolean;
  is_published: boolean;
  author?: {
    id: number;
    name: string;
  };
  created_at: string;
}

export function PmbAnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<PmbAnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Form State (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PmbAnnouncementItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'agenda_kedatangan',
    event_date: '',
    content: '',
    is_pinned: false,
    is_published: true,
  });

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<PmbAnnouncementItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAnnouncements = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await api.getPmbAnnouncementsAdmin(params);
      setAnnouncements(Array.isArray(res) ? (res as PmbAnnouncementItem[]) : []);
    } catch (e: any) {
      showToast(e?.message || 'Gagal memuat berita & agenda PMB', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, [categoryFilter]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setForm({
      title: '',
      category: 'agenda_kedatangan',
      event_date: '',
      content: '',
      is_pinned: false,
      is_published: true,
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: PmbAnnouncementItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      category: item.category,
      event_date: item.event_date ? item.event_date.substring(0, 10) : '',
      content: item.content,
      is_pinned: item.is_pinned,
      is_published: item.is_published,
    });
    setModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      showToast('Judul dan isi pengumuman wajib diisi', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        event_date: form.event_date || undefined,
      };

      if (editingItem) {
        await api.updatePmbAnnouncement(editingItem.id, payload);
        showToast('Berita / Agenda PMB berhasil diperbarui.');
      } else {
        await api.storePmbAnnouncement(payload);
        showToast('Berita / Agenda PMB baru berhasil diterbitkan.');
      }
      setModalOpen(false);
      loadAnnouncements();
    } catch (e: any) {
      showToast(e?.message || 'Gagal menyimpan pengumuman', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await api.deletePmbAnnouncement(itemToDelete.id);
      showToast(`Pengumuman "${itemToDelete.title}" berhasil dihapus.`);
      setItemToDelete(null);
      loadAnnouncements();
    } catch (e: any) {
      showToast(e?.message || 'Gagal menghapus pengumuman', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'agenda_kedatangan':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300">
            Agenda Kedatangan
          </span>
        );
      case 'pengumuman':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
            Pengumuman Resmi
          </span>
        );
      case 'berita':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-800 border border-sky-300">
            Berita PMB
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-black shadow-xl animate-fade-in ${
            toast.type === 'success'
              ? 'bg-[#0D7A6F] text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-[#FFDC80]" /> : <X className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#FFDC80] text-[#0D7A6F] border border-amber-300 flex items-center justify-center shadow-xs">
            <Megaphone className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight">
                Berita & Agenda Santri Baru
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20">
                {announcements.length} Publikasi
              </span>
            </div>
            <p className="text-xs text-[#636E72] font-medium mt-0.5">
              Admin leluasa memposting tanggal wajib hadir, jadwal antar ke asrama, dan panduan registrasi ulang santri baru.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-[#138F81]/25 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-[#FFDC80]" />
          <span>Buat Berita / Agenda Baru</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#636E72] shrink-0" />
          <div className="flex items-center gap-1.5 overflow-x-auto w-full">
            {[
              { id: 'all', label: 'Semua Kategori' },
              { id: 'agenda_kedatangan', label: 'Agenda Kedatangan' },
              { id: 'pengumuman', label: 'Pengumuman Resmi' },
              { id: 'berita', label: 'Berita' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-[#138F81] text-white shadow-xs'
                    : 'bg-slate-100 text-[#636E72] hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadAnnouncements();
            }}
            placeholder="Cari judul berita..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
          />
        </div>
      </div>

      {/* LIST BERITA & AGENDA */}
      {isLoading ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
          <RefreshCw className="w-7 h-7 text-[#138F81] animate-spin" />
          <p className="text-xs font-bold text-[#636E72]">Memuat berita & agenda...</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
          <Megaphone className="w-12 h-12 text-slate-300" />
          <h3 className="text-sm font-bold text-[#2D3436]">Belum Ada Berita atau Agenda</h3>
          <p className="text-xs text-[#636E72] max-w-md">
            Klik tombol "Buat Berita / Agenda Baru" di atas untuk menambahkan informasi tanggal wajib santri hadir atau pengumuman PMB.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {announcements.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-3xl bg-white border transition-all shadow-sm space-y-3 ${
                item.is_pinned
                  ? 'border-amber-300 ring-2 ring-amber-300/30'
                  : 'border-slate-200/80 hover:border-[#138F81]/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {getCategoryBadge(item.category)}
                  {item.is_pinned && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Pin className="w-2.5 h-2.5 fill-amber-700" />
                      Disematkan
                    </span>
                  )}
                  {!item.is_published && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">
                      Draft (Belum Terbit)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#138F81] hover:bg-emerald-50 transition-colors cursor-pointer"
                    title="Edit pengumuman"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setItemToDelete(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Hapus pengumuman"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-black text-[#2D3436] leading-snug">
                {item.title}
              </h3>

              {item.event_date && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs font-bold text-amber-900">
                  <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    Tanggal Pelaksanaan / Wajib Hadir: {new Date(item.event_date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}

              <p className="text-xs text-[#636E72] leading-relaxed line-clamp-3">
                {item.content}
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#636E72] font-semibold">
                <span>Diposting: {new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                <span>Oleh: {item.author?.name || 'Panitia PMB'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREATE / EDIT ANNOUNCEMENT */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-xl p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-5 h-5 text-[#138F81]" />
                <h3 className="text-base font-black text-[#2D3436]">
                  {editingItem ? 'Edit Berita / Agenda' : 'Buat Berita / Agenda Santri Baru'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2D3436] mb-1">
                  Judul Berita / Agenda <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Tanggal Wajib Masuk Asrama & Penyerahan Santri Baru TA 2026/2027"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2D3436] mb-1">
                    Kategori Pengumuman
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
                  >
                    <option value="agenda_kedatangan">Agenda Kedatangan / Masuk Pondok</option>
                    <option value="pengumuman">Pengumuman Resmi Seleksi</option>
                    <option value="berita">Berita & Informasi Umum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D3436] mb-1">
                    Tanggal Pelaksanaan / Wajib Hadir
                  </label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D3436] mb-1">
                  Isi Lengkap Pengumuman / Rincian Agenda <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Tuliskan rincian agenda, waktu kedatangan, berkas fisik yang wajib dibawa, seragam, atau hal-hal penting lainnya..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-[#2D3436] leading-relaxed focus:bg-white focus:outline-none focus:border-[#138F81]"
                />
              </div>

              <div className="flex items-center gap-6 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-bold text-[#2D3436] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                    className="w-4 h-4 rounded text-[#138F81] focus:ring-[#138F81]"
                  />
                  <span>Sematkan ke Bagian Paling Atas (Pinned)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-[#2D3436] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                    className="w-4 h-4 rounded text-[#138F81] focus:ring-[#138F81]"
                  />
                  <span>Publikasikan Langsung ke Web PMB</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#636E72] text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-[#138F81]/25 cursor-pointer"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingItem ? 'Simpan Perubahan' : 'Terbitkan Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODERN DELETE MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#2D3436]">Hapus Berita / Agenda?</h3>
              <p className="text-xs text-[#636E72] mt-1">
                Apakah Anda yakin ingin menghapus berita "<strong>{itemToDelete.title}</strong>"?
                Pengumuman yang dihapus tidak akan tampil lagi di web publik.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#636E72] text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-rose-600/25 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Pengumuman'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
