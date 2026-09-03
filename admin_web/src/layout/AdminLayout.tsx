import {
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock3,
  GraduationCap,
  Home,
  KeyRound,
  LibraryBig,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext";
import type { AbsensiTab } from "../pages/AbsensiPage";
import type { BukuIndukSection } from "../pages/BukuIndukPage";
import { api, type ApiRecord } from "../services/api";
import { getRoleDisplayName } from "../utils/roleHelper";


export type PageKey =
  | "dashboard"
  | "absensi"
  | "master"
  | "guru"
  | "users"
  | "pondok"
  | "mapel"
  | "jadwal"
  | "keuangan"
  | "whatsapp"
  | "nilai"
  | "hak-akses"
  | "account";

export interface MenuItem {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  page?: PageKey;
  children?: Array<{
    label: string;
    page: PageKey;
    masterSection?: BukuIndukSection;
    financeTab?: string;
    absensiTab?: AbsensiTab;
  }>;
}

interface AdminLayoutProps {
  activePage: PageKey;
  activeMasterSection?: BukuIndukSection;
  activeFinanceTab?: string;
  activeAbsensiTab?: AbsensiTab;
  onNavigate: (
    page: PageKey,
    options?: { masterSection?: BukuIndukSection; financeTab?: string; absensiTab?: AbsensiTab },
  ) => void;
  children: ReactNode;
}

const allMenu: MenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: Home, page: "dashboard" },
  {
    key: "kesiswaan",
    label: "Data Santri",
    icon: UsersRound,
    children: [
      { label: "Data Siswa/Santri", page: "master", masterSection: "siswa" },
      { label: "Data Santri Alumni", page: "master", masterSection: "alumni" },
      { label: "Data Kamar Pondok", page: "master", masterSection: "pondok" },
    ],
  },
  {
    key: "guru_menu",
    label: "Data Guru",
    icon: GraduationCap,
    page: "master",
    children: [
      { label: "Daftar Guru & Ustadz", page: "master", masterSection: "guru" },
    ],
  },
  {
    key: "akademik_menu",
    label: "Akademik & KBM",
    icon: BookOpen,
    children: [
      { label: "Data Kelas Madin", page: "master", masterSection: "kelas" },
      { label: "Mata Pelajaran & Jadwal Madin", page: "mapel" },
      { label: "Jadwal & Kitab Ngaji Santri", page: "absensi", absensiTab: "jadwal-ngaji" },
      { label: "Jadwal & Waktu Sholat Jamaah", page: "absensi", absensiTab: "jenis-sholat" },
      { label: "Kelompok Belajar", page: "master", masterSection: "kelompok" },
    ],
  },
  {
    key: "absensi_menu",
    label: "Presensi & Absensi",
    icon: CalendarCheck,
    children: [
      { label: "⚡ Log Pemantauan Realtime", page: "absensi", absensiTab: "log-realtime" },
      { label: "🕌 Input Presensi Madin", page: "absensi", absensiTab: "madin-input" },
      { label: "🕋 Input Presensi Sholat", page: "absensi", absensiTab: "sholat" },
      { label: "📖 Input Presensi Ngaji Kitab", page: "absensi", absensiTab: "ngaji" },
      { label: "📊 Rekap Presensi Madin", page: "absensi", absensiTab: "madin" },
      { label: "📈 Rekap Presensi Sholat", page: "absensi", absensiTab: "rekap-sholat" },
      { label: "📚 Rekap Presensi Ngaji", page: "absensi", absensiTab: "rekap-ngaji" },
    ],
  },

  { key: "nilai", label: "Nilai & Hafalan", icon: ListChecks, page: "nilai" },
  {
    key: "keuangan_menu",
    label: "Keuangan & Kas",
    icon: WalletCards,
    children: [
      { label: "Transaksi Hari Ini", page: "keuangan", financeTab: "today" },
      { label: "Verifikasi Transfer", page: "keuangan", financeTab: "verifikasi" },
      { label: "Tagihan Santri (SPP)", page: "keuangan", financeTab: "student" },
      { label: "Riwayat Pembayaran", page: "keuangan", financeTab: "history" },
      { label: "Kas Masuk Lain", page: "keuangan", financeTab: "pemasukan_lain" },
      { label: "Pengeluaran Kas", page: "keuangan", financeTab: "pengeluaran" },
      { label: "Tipe & Tarif Tagihan", page: "keuangan", financeTab: "types" },
    ],
  },
  {
    key: "manajemen_user",
    label: "Data Login Akun",
    icon: KeyRound,
    children: [
      { label: "Login Admin", page: "master", masterSection: "login-admin" },
      { label: "Login Guru", page: "master", masterSection: "login-guru" },
      { label: "Login Wali Santri", page: "master", masterSection: "login-wali" },
    ],
  },
  {
    key: "pengaturan_sistem",
    label: "Pengaturan & Sistem",
    icon: Settings,
    children: [
      { label: "Pengaturan Metode Bayar", page: "keuangan", financeTab: "methods" },
      { label: "Pengaturan Periode Bayar", page: "keuangan", financeTab: "periods" },
      { label: "Pengaturan Struk / Nota", page: "keuangan", financeTab: "settings" },
      { label: "Pengaturan Semester & TA", page: "master", masterSection: "akademik" },
      { label: "Profil Identitas Lembaga", page: "master", masterSection: "referensi" },
      { label: "Pengaturan WhatsApp Bot", page: "whatsapp" },
      { label: "Hak Akses & Role User", page: "hak-akses" },
      { label: "Pengaturan Akun", page: "account" },
    ],
  },
];

const menuPermissionKeys: Record<string, string> = {
  dashboard: "dashboard",
  kesiswaan: "buku_induk",
  guru_menu: "buku_induk",
  akademik_menu: "mata_pelajaran",
  absensi_menu: "absensi",
  absensi: "absensi",
  nilai: "nilai",
  keuangan_menu: "keuangan",
  manajemen_user: "buku_induk",
  pengaturan_sistem: "hak_akses",
  mapel: "mata_pelajaran",
  jadwal: "mata_pelajaran",
  master: "buku_induk",
  keuangan: "keuangan",
  whatsapp: "whatsapp_bot",
  "hak-akses": "hak_akses",
  account: "dashboard",
};

export function AdminLayout({
  activePage,
  activeMasterSection = "siswa",
  activeFinanceTab = "today",
  activeAbsensiTab = "log-realtime",
  onNavigate,
  children,
}: AdminLayoutProps) {
  const { session, logout, canView, isGuru, isTreasurer, isKepalaSekolah } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isFemaleTeacher = useMemo(() => {
    if (!isGuru) return false;
    if (session?.jenis_kelamin === 'P') return true;
    const name = (session?.name || '').toUpperCase();
    return (
      name.startsWith('USTD.') ||
      name.startsWith('USTDZ.') ||
      name.includes('USTADZAH') ||
      name.includes('HJ.') ||
      name.includes('NYAI') ||
      name.includes('NING')
    );
  }, [isGuru, session]);

  const teacherTitle = isFemaleTeacher ? 'Ustadzah' : 'Ustadz';

  const roleTitle = useMemo(() => {
    return getRoleDisplayName(session?.role, session?.admin_type, isGuru, teacherTitle);
  }, [session?.role, session?.admin_type, isGuru, teacherTitle]);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiRecord[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // State Accordion Collapse: Default tertutup rapi, hanya 1 menu yang terbuka saat diklik
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const [pendingVerifCount, setPendingVerifCount] = useState(0);

  useEffect(() => {
    const fetchPending = () => {
      api.adminGetVerifikasiPembayaran({ status: 'menunggu' })
        .then((res) => {
          if (res.counts && typeof res.counts === 'object') {
            const c = res.counts as { menunggu?: number };
            setPendingVerifCount(Number(c.menunggu || 0));
          }
        })
        .catch(() => {});
    };
    fetchPending();
    const handler = () => fetchPending();
    window.addEventListener('app:data-updated', handler);
    return () => window.removeEventListener('app:data-updated', handler);
  }, []);

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setNotificationsLoading(true);
    try {
      const response = await api.notifications();
      setNotifications(Array.isArray(response.data) ? response.data : []);
      setUnreadNotifications(Number(response.unread_count ?? 0));
    } catch {
      // Notifikasi tidak boleh mengganggu dashboard utama
    } finally {
      if (showLoading) setNotificationsLoading(false);
    }
  }, []);

  const markNotificationRead = useCallback(async (notification: ApiRecord) => {
    const id = Number(notification.id ?? 0);
    if (!id || Boolean(notification.is_read)) return;

    try {
      await api.markNotificationRead(id);
      setNotifications((current) =>
        current.map((item) =>
          Number(item.id ?? 0) === id ? { ...item, is_read: true } : item,
        ),
      );
      setUnreadNotifications((current) => Math.max(0, current - 1));
    } catch {
      // Ignore
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true })),
      );
      setUnreadNotifications(0);
    } catch {
      // Ignore
    }
  }, []);

  const [confirmClearNotifOpen, setConfirmClearNotifOpen] = useState(false);
  const [isClearingNotif, setIsClearingNotif] = useState(false);

  const clearAllNotificationsHandler = useCallback(async (scope: 'my' | 'all_system' = 'my') => {
    setIsClearingNotif(true);
    try {
      await api.clearAllNotifications(scope);
      setNotifications([]);
      setUnreadNotifications(0);
      setConfirmClearNotifOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membersihkan riwayat notifikasi');
    } finally {
      setIsClearingNotif(false);
    }
  }, []);

  const deleteNotificationItem = useCallback(async (id: number) => {
    try {
      await api.deleteNotification(id);
      setNotifications((current) =>
        current.filter((item) => Number(item.id ?? 0) !== id),
      );
      setUnreadNotifications((current) => {
        const deleted = notifications.find((item) => Number(item.id ?? 0) === id);
        return deleted && !deleted.is_read ? Math.max(0, current - 1) : current;
      });
    } catch {
      // Ignore
    }
  }, [notifications]);


  const handleNotificationClick = useCallback((item: ApiRecord) => {
    void markNotificationRead(item);
    const data = (item.data ?? {}) as ApiRecord;
    if (data.page) {
      onNavigate(String(data.page) as PageKey, {
        masterSection: data.masterSection ? String(data.masterSection) as BukuIndukSection : undefined,
        financeTab: data.tab ? String(data.tab) as never : undefined,
        absensiTab: data.tab ? String(data.tab) as AbsensiTab : undefined,
      });
      setNotificationOpen(false);
    }
  }, [markNotificationRead, onNavigate]);

  useEffect(() => {
    void loadNotifications();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setProfileOpen(false);
        setNotificationOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
    setNotificationOpen(false);
  }, [activePage, activeMasterSection, activeFinanceTab, activeAbsensiTab]);

  // Otomatis buka accordion menu induk saat halaman aktif
  useEffect(() => {
    const parentGroup = allMenu.find((m) =>
      m.children?.some(
        (c) =>
          c.page === activePage &&
          (!c.masterSection || c.masterSection === activeMasterSection) &&
          (!c.financeTab || c.financeTab === activeFinanceTab) &&
          (!c.absensiTab || c.absensiTab === activeAbsensiTab),
      ),
    );
    if (parentGroup) {
      setOpenGroup(parentGroup.key);
    }
  }, [activePage, activeMasterSection, activeFinanceTab, activeAbsensiTab]);

  const menu = useMemo<MenuItem[]>(() => {
    // 1. Role Guru: Khusus KBM (Dashboard, Input Presensi, Nilai - Tanpa Rekap)
    if (isGuru) {
      const guruAbsensiChildren: NonNullable<MenuItem['children']> = [
        { label: "🕌 Input Presensi Madin", page: "absensi", absensiTab: "madin-input" }
      ];

      // Absen Sholat hanya muncul jika diizinkan / ditugaskan oleh admin
      if (session?.hak_akses?.absen_sholat === true) {
        guruAbsensiChildren.push({ label: "🕋 Input Presensi Sholat", page: "absensi", absensiTab: "sholat" });
      }

      // Absen Ngaji hanya muncul jika diizinkan / ditugaskan oleh admin
      if (session?.hak_akses?.absen_ngaji === true) {
        guruAbsensiChildren.push({ label: "📖 Input Presensi Ngaji", page: "absensi", absensiTab: "ngaji" });
      }

      return [
        {
          key: "dashboard",
          label: "Dashboard",
          icon: Home,
          page: "dashboard",
        },
        {
          key: "absensi_menu",
          label: "Presensi & Absensi",
          icon: CalendarCheck,
          children: guruAbsensiChildren,
        },
        {
          key: "nilai",
          label: "Nilai & Hafalan",
          icon: ListChecks,
          page: "nilai",
        },
      ];
    }

    // 2. Role Bendahara: Khusus Transaksi & Kas Keuangan
    if (isTreasurer) {
      const adminType = (session?.admin_type || '').toLowerCase();
      const isBendahara1 = adminType === 'bendahara_1' || adminType === 'kasir';

      const financeChildren = isBendahara1
        ? [
            { label: "💵 Transaksi Hari Ini", page: "keuangan" as PageKey, financeTab: "today" },
            { label: "📩 Verifikasi Transfer", page: "keuangan" as PageKey, financeTab: "verifikasi" },
            { label: "📜 Tagihan Santri (SPP)", page: "keuangan" as PageKey, financeTab: "student" },
            { label: "🧾 Riwayat & Rekap", page: "keuangan" as PageKey, financeTab: "history" },
          ]
        : [
            { label: "💵 Transaksi Hari Ini", page: "keuangan" as PageKey, financeTab: "today" },
            { label: "📩 Verifikasi Transfer", page: "keuangan" as PageKey, financeTab: "verifikasi" },
            { label: "📜 Tagihan Santri (SPP)", page: "keuangan" as PageKey, financeTab: "student" },
            { label: "🧾 Riwayat Pembayaran", page: "keuangan" as PageKey, financeTab: "history" },
            { label: "📥 Kas Masuk Lain", page: "keuangan" as PageKey, financeTab: "pemasukan_lain" },
            { label: "📤 Pengeluaran Kas", page: "keuangan" as PageKey, financeTab: "pengeluaran" },
            { label: "⚙️ Tipe & Tarif Tagihan", page: "keuangan" as PageKey, financeTab: "types" },
          ];

      return [
        {
          key: "dashboard",
          label: "Dashboard Keuangan",
          icon: Home,
          page: "dashboard",
        },
        {
          key: "keuangan_menu",
          label: isBendahara1 ? "Transaksi Santri" : "Keuangan & Kas",
          icon: WalletCards,
          children: financeChildren,
        },
        ...(!isBendahara1
          ? [
              {
                key: "pengaturan_sistem",
                label: "Pengaturan & Sistem",
                icon: Settings,
                children: [
                  { label: "Pengaturan Metode Bayar", page: "keuangan" as PageKey, financeTab: "methods" },
                  { label: "Pengaturan Periode Bayar", page: "keuangan" as PageKey, financeTab: "periods" },
                  { label: "Pengaturan Struk / Nota", page: "keuangan" as PageKey, financeTab: "settings" },
                  { label: "Pengaturan Akun", page: "account" as PageKey },
                ],
              },
            ]
          : []),
      ];
    }

    // 3. Role Kepala Sekolah / Madrasah: Khusus Monitoring Pemantauan (Tanpa Rekap Ruwet)
    if (isKepalaSekolah) {
      return [
        {
          key: "dashboard",
          label: "Dashboard Monitoring",
          icon: Home,
          page: "dashboard",
        },
        {
          key: "absensi",
          label: "Pemantauan Presensi",
          icon: CalendarCheck,
          page: "absensi",
          absensiTab: "log-realtime",
        },
      ];
    }


    // 4. Role Admin Utama (Super Admin): Full Access Semua Menu
    return allMenu.filter((item) =>
      canView(menuPermissionKeys[item.key] ?? item.key),
    );
  }, [canView, isGuru, isTreasurer, isKepalaSekolah]);

  const collapsed = mobileOpen ? false : sidebarCollapsed;

  const nav = (
    <aside
      className={`q-sidebar flex h-full flex-col rounded-[26px] bg-[#FFFDF7] p-3.5 lg:p-4 shadow-xl shadow-black/5 ${
        collapsed ? "w-23" : "w-72"
      }`}
    >
      <div className={`mb-6 pt-2 text-center ${collapsed ? "px-0" : ""}`}>
        <img
          className={`q-brand-logo mx-auto ${collapsed ? "h-11 w-11" : "h-14 w-14"}`}
          src="/logo-qomaruddin.png"
          alt="Logo Qomaruddin"
        />
        {!collapsed ? (
          <>
            <h1 className="mt-3 text-sm font-extrabold leading-5 text-[#138F81]">
              Pondok Pesantren Qomaruddin
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#636E72]">
              Admin Dashboard
            </p>
          </>
        ) : null}
      </div>

      <nav
        className="q-sidebar-nav q-scrollbar flex-1 space-y-1.5 overflow-y-auto pr-1"
        aria-label="Menu Admin"
      >
        {menu.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const isGroupOpen = openGroup === item.key;
          const Icon = item.icon;

          // Cek apakah ada child item yang sedang aktif
          const isChildActive = item.children?.some(
            (c) =>
              c.page === activePage &&
              (!c.masterSection || c.masterSection === activeMasterSection) &&
              (!c.financeTab || c.financeTab === activeFinanceTab) &&
              (!c.absensiTab || c.absensiTab === activeAbsensiTab),
          );
          const isDirectActive = item.page === activePage && !hasChildren;
          const isSelected = isDirectActive || isChildActive;

          return (
            <div key={item.key}>
              <button
                className={`q-menu-item flex min-h-11 w-full items-center gap-3 rounded-2xl text-left text-sm font-bold transition ${
                  isSelected && !hasChildren
                    ? "bg-[#138F81] text-white shadow-lg shadow-[#138F81]/25"
                    : isSelected && hasChildren
                    ? "bg-[#E8F7F3] text-[#138F81] font-extrabold"
                    : "text-[#636E72] hover:bg-[#E1EFF7]"
                } ${collapsed ? "justify-center px-0" : "px-3.5"}`}
                onClick={() => {
                  if (hasChildren && !collapsed) {
                    // Logic Accordion: Jika sudah terbuka maka tutup, jika belum maka buka dan otomatis tutup menu lain
                    setOpenGroup((prev) => (prev === item.key ? null : item.key));
                  } else if (item.page) {
                    onNavigate(item.page);
                    setMobileOpen(false);
                  }
                  setProfileOpen(false);
                  setNotificationOpen(false);
                }}
                type="button"
                title={collapsed ? item.label : undefined}
                aria-expanded={hasChildren ? isGroupOpen : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed ? (
                  <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                ) : null}
                {!collapsed && hasChildren ? (
                  <ChevronDown
                    className={`shrink-0 transition-transform duration-200 ${
                      isGroupOpen ? "rotate-180 text-[#138F81]" : "text-[#636E72]"
                    }`}
                    size={15}
                  />
                ) : null}
              </button>

              {/* Sub-menu Collapsible Accordion */}
              {!collapsed && hasChildren && isGroupOpen ? (
                <div className="q-submenu my-1 ml-3.5 space-y-1 border-l-2 border-[#138F81]/20 pl-2.5">
                  {item.children?.map((child) => {
                    const childActive =
                      child.page === activePage &&
                      (!child.masterSection ||
                        child.masterSection === activeMasterSection) &&
                      (!child.financeTab ||
                        child.financeTab === activeFinanceTab) &&
                      (!child.absensiTab ||
                        child.absensiTab === activeAbsensiTab);
                    return (
                      <button
                        key={`${child.page}-${child.absensiTab ?? child.financeTab ?? child.masterSection ?? child.label}`}
                        className={`flex min-h-8.5 w-full items-center rounded-xl px-2.5 py-1.5 text-left text-xs font-bold transition ${
                          childActive
                            ? "bg-[#138F81] text-white shadow-md shadow-[#138F81]/20 font-extrabold"
                            : "text-[#636E72] hover:bg-[#E1EFF7] hover:text-[#138F81]"
                        }`}
                        onClick={() => {
                          onNavigate(child.page, {
                            masterSection: child.masterSection,
                            financeTab: child.financeTab,
                            absensiTab: child.absensiTab,
                          });
                          setMobileOpen(false);
                          setProfileOpen(false);
                          setNotificationOpen(false);
                        }}
                        type="button"
                      >
                        <span className="min-w-0 flex-1 leading-snug">{child.label}</span>
                        {child.financeTab === 'verifikasi' && pendingVerifCount > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                            {pendingVerifCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="q-app-shell min-h-screen bg-[#FFDC80] p-2.5 sm:p-4 lg:p-6 theme-light overflow-x-hidden">
      <div className="mx-auto flex max-w-360 gap-4 lg:gap-6">
        <div className="hidden shrink-0 lg:block">{nav}</div>
        {mobileOpen ? (
          <div
            className="q-mobile-overlay fixed inset-0 z-40 bg-black/30 p-4 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="q-mobile-drawer relative h-full w-fit max-w-full"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="q-drawer-close absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-2xl bg-[#2D3436] text-white shadow-xl shadow-black/20"
                onClick={() => setMobileOpen(false)}
                type="button"
                aria-label="Tutup menu"
              >
                <X size={19} />
              </button>
              {nav}
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 max-w-full overflow-x-hidden">
          <header className="q-topbar mb-4 sm:mb-6 flex min-h-14 sm:min-h-16 items-center justify-between gap-2 sm:gap-3 rounded-2xl sm:rounded-[26px] bg-[#FFFDF7] px-3 sm:px-6 shadow-xl shadow-black/5">
            <div className="min-w-0 flex flex-1 items-center gap-2 sm:gap-3">
              <button
                className="q-icon-button grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl sm:rounded-2xl bg-[#E1EFF7] text-[#138F81]"
                onClick={() => {
                  if (window.innerWidth >= 1024) {
                    setSidebarCollapsed((value) => !value);
                  } else {
                    setMobileOpen(true);
                  }
                }}
                type="button"
                aria-label="Buka atau tutup menu"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs sm:text-sm font-extrabold text-[#138F81]">
                  Pondok Qomaruddin
                </p>
                <p className="hidden text-xs font-semibold text-[#636E72] sm:block">
                  Satu data admin, bendahara, dan aplikasi Android
                </p>
              </div>
            </div>
            <div className="q-topbar-actions flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="relative">
                <button
                  className="q-icon-button relative grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl bg-[#E8F7F3] text-[#138F81]"
                  onClick={() => {
                    setNotificationOpen((value) => {
                      const next = !value;
                      if (next) setProfileOpen(false);
                      return next;
                    });
                  }}
                  type="button"
                  aria-label="Buka notifikasi"
                >
                  <Bell size={16} />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#E8590C] px-1 text-[10px] font-extrabold text-white">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {notificationOpen ? (
                  <>
                    {/* Backdrop for Mobile */}
                    <div
                      className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] sm:hidden"
                      onClick={() => setNotificationOpen(false)}
                    />

                    <div className="q-popover fixed inset-x-3.5 top-16 z-50 max-h-[85vh] flex flex-col rounded-3xl bg-white p-4 sm:p-5 shadow-2xl ring-1 ring-black/10 sm:absolute sm:inset-auto sm:right-0 sm:top-13 sm:w-[380px] sm:max-h-[500px]">
                      {/* Header */}
                      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-50 text-[#138F81] font-extrabold text-xs">
                            🔔
                          </span>
                          <div>
                            <p className="text-xs font-black text-slate-800">
                              Notifikasi {isGuru ? teacherTitle : 'Sistem'}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {unreadNotifications > 0 ? `${unreadNotifications} belum dibaca` : 'Semua telah dibaca'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {unreadNotifications > 0 && !confirmClearNotifOpen && (
                            <button
                              className="rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-extrabold text-[#138F81] hover:bg-teal-100 transition-colors"
                              onClick={() => void markAllNotificationsRead()}
                              type="button"
                              title="Tandai semua sudah dibaca"
                            >
                              ✓ Baca
                            </button>
                          )}
                          {notifications.length > 0 && !confirmClearNotifOpen && (
                            <button
                              className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-extrabold text-rose-600 hover:bg-rose-100 transition-colors flex items-center gap-1"
                              onClick={() => setConfirmClearNotifOpen(true)}
                              type="button"
                              title="Bersihkan seluruh riwayat notifikasi"
                            >
                              <Trash2 size={11} />
                              <span>Hapus Semua</span>
                            </button>
                          )}
                          <button
                            className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 transition-colors"
                            onClick={() => {
                              setConfirmClearNotifOpen(false);
                              void loadNotifications(true);
                            }}
                            type="button"
                            title="Refresh notifikasi"
                          >
                            <RefreshCw size={12} className={notificationsLoading ? "animate-spin" : ""} />
                          </button>
                        </div>
                      </div>

                      {/* Confirmation Banner for Clear All */}
                      {confirmClearNotifOpen && (
                        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-3 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">⚠️</span>
                            <p className="text-xs font-extrabold text-rose-800">
                              Bersihkan Seluruh Riwayat?
                            </p>
                          </div>
                          <p className="mt-1 text-[11px] font-medium leading-relaxed text-rose-700">
                            Semua {notifications.length} notifikasi akan dihapus permanen agar tidak menumpuk.
                          </p>
                          <div className="mt-2.5 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isClearingNotif}
                              onClick={() => void clearAllNotificationsHandler('my')}
                              className="flex-1 rounded-xl bg-rose-600 py-1.5 text-center text-[11px] font-extrabold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition"
                            >
                              {isClearingNotif ? 'Menghapus...' : 'Ya, Hapus Semua'}
                            </button>
                            <button
                              type="button"
                              disabled={isClearingNotif}
                              onClick={() => setConfirmClearNotifOpen(false)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}


                      {/* List */}
                      <div className="q-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
                        {notificationsLoading ? (
                          <div className="py-12 text-center text-xs font-bold text-slate-400">
                            Memuat notifikasi...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="py-12 text-center">
                            <span className="text-2xl">🎉</span>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              Tidak ada notifikasi baru
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Semua tugas dan pengingat sudah terpantau rapi.
                            </p>
                          </div>
                        ) : (
                          notifications.map((item) => {
                            const isRead = Boolean(item.is_read);
                            const notifType = String(item.type ?? '');
                            const isUrgent = notifType.includes('urgent') || notifType.includes('peringatan');
                            const isSchedule = notifType.includes('jadwal') || notifType.includes('kbm');

                            return (
                              <div
                                key={String(item.id)}
                                className={`group relative flex items-start justify-between gap-2.5 rounded-2xl p-3 text-left transition-all border ${
                                  isRead
                                    ? "border-transparent bg-slate-50/80 text-slate-600 hover:bg-slate-100"
                                    : isUrgent
                                    ? "border-amber-200 bg-amber-50/60 text-slate-900 shadow-xs"
                                    : isSchedule
                                    ? "border-emerald-200 bg-emerald-50/50 text-slate-900 shadow-xs"
                                    : "border-teal-100 bg-[#E8F7F3]/70 text-slate-900 shadow-xs"
                                }`}
                              >
                                <button
                                  type="button"
                                  className="flex-1 min-w-0 text-left"
                                  onClick={() => handleNotificationClick(item)}
                                >
                                  <div className="flex items-center gap-1.5">
                                    {!isRead && (
                                      <span className={`h-2 w-2 shrink-0 rounded-full ${isUrgent ? 'bg-amber-500' : 'bg-[#138F81]'}`} />
                                    )}
                                    <p className="text-xs font-black truncate text-slate-800">
                                      {String(item.title ?? "Notifikasi")}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-600">
                                    {String(item.message ?? "")}
                                  </p>
                                  <span className="mt-1.5 inline-block text-[10px] font-bold text-slate-400">
                                    {new Date(String(item.created_at || Date.now())).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteNotificationItem(Number(item.id));
                                  }}
                                  className="opacity-60 hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 transition-opacity shrink-0"
                                  title="Hapus notifikasi"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="relative">
                <button
                  className="q-profile-chip flex min-h-10 items-center gap-2 rounded-2xl bg-[#E8F7F3] px-3 text-left transition hover:bg-[#d8f0ea]"
                  onClick={() => {
                    setProfileOpen((value) => {
                      const next = !value;
                      if (next) setNotificationOpen(false);
                      return next;
                    });
                  }}
                  type="button"
                >
                  <div className="grid h-7 w-7 place-items-center rounded-xl bg-[#138F81] text-white">
                    <UserRound size={15} />
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="max-w-36 truncate text-xs font-extrabold text-[#2D3436]">
                      {session?.name ?? (isGuru ? teacherTitle : roleTitle)}
                    </p>
                    <p className="text-[10px] font-bold text-[#138F81] tracking-wide">
                      {roleTitle}
                    </p>
                  </div>
                  <ChevronDown
                    className={`text-[#636E72] transition-transform ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                    size={14}
                  />
                </button>

                {profileOpen ? (
                  <div className="q-popover absolute right-0 top-13 z-30 w-60 rounded-3xl bg-white p-3.5 shadow-2xl shadow-black/10">
                    <div className="border-b border-black/5 px-2 py-2">
                      <p className="truncate text-xs font-extrabold text-[#2D3436]">
                        {session?.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-[#138F81] text-[10px] font-black">
                          {roleTitle}
                        </span>
                        <span className="text-[10px] font-semibold text-[#636E72] truncate">
                          {session?.email}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 space-y-1">
                      <button
                        className="flex min-h-9 w-full items-center gap-2 rounded-xl px-3 text-xs font-bold text-[#636E72] transition hover:bg-[#E1EFF7] hover:text-[#138F81]"
                        onClick={() => {
                          onNavigate("account");
                          setProfileOpen(false);
                        }}
                        type="button"
                      >
                        <UserCog size={15} />
                        Pengaturan Akun
                      </button>
                      <button
                        className="flex min-h-9 w-full items-center gap-2 rounded-xl px-3 text-xs font-bold text-[#E8590C] transition hover:bg-[#FFF0E8]"
                        onClick={() => {
                          logout();
                          setProfileOpen(false);
                        }}
                        type="button"
                      >
                        <LogOut size={15} />
                        Keluar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="q-content-area">{children}</div>

          {/* MODERN & PROFESSIONAL FOOTER */}
          <footer className="mt-8 pt-5 pb-3 border-t border-[#138F81]/15 text-[#2D3436]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <p className="text-xs font-black text-[#2D3436] tracking-tight">
                  Sistem Informasi & Presensi Pesantren Qomaruddin
                </p>
                <p className="text-[11px] font-semibold text-[#636E72]">
                  Managed & Engineered by <span className="font-extrabold text-[#138F81] tracking-wide">IT QOMARUDDIN ( ITQOM )</span>
                </p>
              </div>

              <div className="flex items-center gap-2.5 text-[11px] font-bold">

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-slate-200/80 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-extrabold text-slate-700">Production Live</span>
                </span>
                <span className="text-[11px] font-semibold text-[#636E72]">
                  © 2026 Yayasan PP Qomaruddin
                </span>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

