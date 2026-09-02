export interface RoleOption {
  key: string;
  role: 'admin' | 'guru' | 'wali';
  adminType?: string;
  label: string;
  badge: string;
  icon: string;
  description: string;
  loginView: string;
  tone: 'primary' | 'success' | 'warning' | 'info' | 'purple';
}

export const SYSTEM_ROLE_OPTIONS: RoleOption[] = [
  {
    key: 'admin_it',
    role: 'admin',
    adminType: 'it',
    label: 'Admin IT (Super Admin)',
    badge: 'Admin IT',
    icon: '💻',
    description: 'Akses penuh seluruh sistem, database, hak akses, dan konfigurasi teknis pesantren.',
    loginView: 'Dashboard Utama + Kontrol Master & Database Penuh',
    tone: 'primary'
  },
  {
    key: 'admin_pengurus',
    role: 'admin',
    adminType: 'pengurus',
    label: 'Admin Pengurus (Yayasan)',
    badge: 'Admin Pengurus',
    icon: '🏛️',
    description: 'Pengurus harian yayasan dengan wewenang operasional menyeluruh dan manajemen santri.',
    loginView: 'Dashboard Utama + Akses Manajemen Seluruh Pesantren',
    tone: 'primary'
  },
  {
    key: 'kepala_sekolah',
    role: 'admin',
    adminType: 'kepala_sekolah',
    label: 'Kepala Madrasah / Sekolah',
    badge: 'Kepala Madrasah',
    icon: '🎓',
    description: 'Tampilan khusus monitoring & pemantauan santri, tanpa rekap ruwet, segar & santai.',
    loginView: 'Dashboard Eksekutif Pemantauan (Statistik Santri Jumbo & Live Feed Aktivitas Ustadz)',
    tone: 'success'
  },
  {
    key: 'bendahara_1',
    role: 'admin',
    adminType: 'bendahara_1',
    label: 'Bendahara 1 (Kasir & SPP)',
    badge: 'Bendahara 1',
    icon: '💵',
    description: 'Khusus loket kasir santri: input pembayaran SPP, tagihan bulanan santri, dan cetak kuitansi.',
    loginView: 'Dashboard Kasir + Menu Pembayaran & Tagihan SPP Santri',
    tone: 'warning'
  },
  {
    key: 'bendahara_2',
    role: 'admin',
    adminType: 'bendahara_2',
    label: 'Bendahara 2 (Kepala Bendahara)',
    badge: 'Bendahara 2',
    icon: '💰',
    description: 'Pimpinan bagian keuangan: mengelola kas umum pesantren, pemasukan lain, dan pengeluaran.',
    loginView: 'Dashboard Keuangan Lengkap + Kas Masuk, Pengeluaran & Laporan Keuangan',
    tone: 'warning'
  },
  {
    key: 'admin_akademik',
    role: 'admin',
    adminType: 'akademik',
    label: 'Admin Akademik (KBM & Nilai)',
    badge: 'Admin Akademik',
    icon: '📚',
    description: 'Mengelola kelas madin, mata pelajaran, jadwal mengajar ustadz, dan nilai raport.',
    loginView: 'Dashboard Manajemen KBM, Jadwal Pelajaran & Raport Nilai',
    tone: 'info'
  },
  {
    key: 'admin_pondok',
    role: 'admin',
    adminType: 'pondok',
    label: 'Admin Pondok (Asrama & Kamar)',
    badge: 'Admin Pondok',
    icon: '🕌',
    description: 'Mengelola komplek pondok, kamar santri, dan penempatan santri mukim.',
    loginView: 'Dashboard Data Asrama, Komplek, Kamar & Santri Mondok',
    tone: 'info'
  },
  {
    key: 'admin_absensi',
    role: 'admin',
    adminType: 'absensi',
    label: 'Admin Absensi (Rekap Kehadiran)',
    badge: 'Admin Absensi',
    icon: '📅',
    description: 'Monitoring dan rekapitulasi presensi KBM Madin, sholat jamaah, dan ngaji kitab.',
    loginView: 'Dashboard & Log Realtime Presensi Pesantren',
    tone: 'info'
  },
  {
    key: 'guru',
    role: 'guru',
    label: 'Ustadz / Guru Pengajar',
    badge: 'Ustadz / Guru',
    icon: '📖',
    description: 'Pengajar KBM Madin, Ngaji Kitab, dan Pembina Sholat Jamaah.',
    loginView: 'Portal Guru (Jadwal Mengajar Hari Ini, Input Absensi Kelas, dan Nilai)',
    tone: 'purple'
  },
  {
    key: 'wali',
    role: 'wali',
    label: 'Wali Santri (Orang Tua)',
    badge: 'Wali Santri',
    icon: '👨‍👩‍👧',
    description: 'Orang tua / wali santri untuk memantau kehadiran, nilai, dan tagihan SPP anak.',
    loginView: 'Portal Wali Santri (Monitoring Anak, Riwayat Presensi & Tagihan)',
    tone: 'purple'
  }
];

export function getRoleDisplayName(
  roleInput?: string | null,
  adminTypeInput?: string | null,
  isGuru = false,
  teacherTitle = 'Ustadz'
): string {
  if (isGuru) return teacherTitle;

  const role = (roleInput || '').toLowerCase().trim();
  const adminType = (adminTypeInput || '').toLowerCase().trim();

  if (role === 'guru') return teacherTitle;
  if (role === 'wali') return 'Wali Santri';

  if (role === 'admin' || !role) {
    if (adminType === 'it' || adminType === 'admin_it') return 'Admin IT';
    if (adminType === 'pengurus' || adminType === 'admin_pengurus') return 'Admin Pengurus';
    if (
      adminType === 'kepala_sekolah' ||
      adminType === 'kepala_madrasah' ||
      adminType === 'madrasah' ||
      adminType === 'monitoring' ||
      adminType === 'kepala'
    ) {
      return 'Kepala Madrasah';
    }
    if (adminType === 'bendahara_1') return 'Bendahara 1';
    if (adminType === 'bendahara_2') return 'Bendahara 2';
    if (adminType === 'bendahara' || adminType === 'keuangan') return 'Bendahara';
    if (adminType === 'kasir') return 'Kasir Pembayaran';
    if (adminType === 'akademik' || adminType === 'admin_akademik') return 'Admin Akademik';
    if (adminType === 'pondok' || adminType === 'admin_pondok' || adminType === 'asrama') return 'Admin Pondok';
    if (adminType === 'absensi' || adminType === 'admin_absensi') return 'Admin Absensi';
    if (adminType === 'superadmin') return 'Super Admin';
    if (adminType === 'utama') return 'Admin Pengurus';

    if (adminType) {
      return adminType
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    return 'Admin Pengurus';
  }

  if (role === 'kepala_sekolah' || role === 'kepala_madrasah') {
    return 'Kepala Madrasah';
  }
  if (role === 'bendahara') {
    return 'Bendahara';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}
