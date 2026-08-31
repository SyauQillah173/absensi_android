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
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
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
import type { BukuIndukSection } from "../pages/BukuIndukPage";
import { api, type ApiRecord } from "../services/api";

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
  }>;
}

interface AdminLayoutProps {
  activePage: PageKey;
  activeMasterSection?: BukuIndukSection;
  activeFinanceTab?: string;
  onNavigate: (
    page: PageKey,
    options?: { masterSection?: BukuIndukSection; financeTab?: string },
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
      { label: "Data Pondok (Kamar)", page: "master", masterSection: "pondok" },
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
    label: "Akademik",
    icon: BookOpen,
    children: [
      { label: "Setting Semester & TA", page: "master", masterSection: "akademik" },
      { label: "Kelompok Belajar", page: "master", masterSection: "kelompok" },
      { label: "Mata Pelajaran", page: "mapel" },
      { label: "Jadwal Pelajaran", page: "jadwal" },
    ],
  },
  { key: "absensi", label: "Presensi & Absensi", icon: CalendarCheck, page: "absensi" },
  { key: "nilai", label: "Nilai & Hafalan", icon: ListChecks, page: "nilai" },
  {
    key: "keuangan_menu",
    label: "Keuangan & Kas",
    icon: WalletCards,
    children: [
      { label: "Transaksi Hari Ini", page: "keuangan", financeTab: "today" },
      { label: "Tagihan Santri (SPP)", page: "keuangan", financeTab: "student" },
      { label: "Riwayat Pembayaran", page: "keuangan", financeTab: "history" },
      { label: "Kas Masuk Lain", page: "keuangan", financeTab: "pemasukan_lain" },
      { label: "Pengeluaran Kas", page: "keuangan", financeTab: "pengeluaran" },
      { label: "Tipe & Tarif Tagihan", page: "keuangan", financeTab: "types" },
      { label: "Pengaturan & Struk", page: "keuangan", financeTab: "settings" },
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
    label: "Sistem & Integrasi",
    icon: ShieldCheck,
    children: [
      { label: "Data Referensi", page: "master", masterSection: "referensi" },
      { label: "Hak Akses Role", page: "hak-akses" },
      { label: "WhatsApp Bot", page: "whatsapp" },
    ],
  },
];

const menuPermissionKeys: Record<string, string> = {
  dashboard: "dashboard",
  kesiswaan: "buku_induk",
  guru_menu: "buku_induk",
  akademik_menu: "mata_pelajaran",
  absensi: "absensi",
  nilai: "nilai",
  keuangan_menu: "keuangan",
  manajemen_user: "buku_induk",
  pengaturan_sistem: "hak_akses",
};

export function AdminLayout({
  activePage,
  activeMasterSection = "siswa",
  activeFinanceTab = "today",
  onNavigate,
  children,
}: AdminLayoutProps) {
  const { session, logout, canView } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiRecord[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // State Accordion Collapse: Default tertutup rapi, hanya 1 menu yang terbuka saat diklik
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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
  }, [activePage, activeMasterSection, activeFinanceTab]);

  const menu = useMemo(() => {
    return allMenu.filter((item) =>
      canView(menuPermissionKeys[item.key] ?? item.key),
    );
  }, [canView]);

  const collapsed = mobileOpen ? false : sidebarCollapsed;

  const nav = (
    <aside
      className={`q-sidebar flex h-full flex-col rounded-[26px] bg-[#FFFDF7] p-4 lg:p-5 shadow-xl shadow-black/5 ${
        collapsed ? "w-23" : "w-64"
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
              (!c.financeTab || c.financeTab === activeFinanceTab),
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
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                ) : null}
                {!collapsed && hasChildren ? (
                  <ChevronDown
                    className={`transition-transform duration-200 ${
                      isGroupOpen ? "rotate-180 text-[#138F81]" : "text-[#636E72]"
                    }`}
                    size={15}
                  />
                ) : null}
              </button>

              {/* Sub-menu Collapsible Accordion */}
              {!collapsed && hasChildren && isGroupOpen ? (
                <div className="q-submenu mt-1 space-y-1 pl-4">
                  {item.children?.map((child) => {
                    const childActive =
                      child.page === activePage &&
                      (!child.masterSection ||
                        child.masterSection === activeMasterSection) &&
                      (!child.financeTab ||
                        child.financeTab === activeFinanceTab);
                    return (
                      <button
                        key={`${child.page}-${child.financeTab ?? child.masterSection ?? child.label}`}
                        className={`flex min-h-8.5 w-full items-center rounded-xl px-3 text-left text-xs font-bold transition ${
                          childActive
                            ? "bg-[#138F81] text-white shadow-md shadow-[#138F81]/20 font-extrabold"
                            : "text-[#636E72] hover:bg-[#E1EFF7] hover:text-[#138F81]"
                        }`}
                        onClick={() => {
                          onNavigate(child.page, {
                            masterSection: child.masterSection,
                            financeTab: child.financeTab,
                          });
                          setMobileOpen(false);
                          setProfileOpen(false);
                          setNotificationOpen(false);
                        }}
                        type="button"
                      >
                        <span className="truncate">{child.label}</span>
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
    <div className="q-app-shell min-h-screen bg-[#FFDC80] p-4 lg:p-6 theme-light">
      <div className="mx-auto flex max-w-360 gap-6">
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

        <main className="min-w-0 flex-1">
          <header className="q-topbar mb-6 flex min-h-16 items-center justify-between gap-3 rounded-[26px] bg-[#FFFDF7] px-4 shadow-xl shadow-black/5 sm:px-6">
            <div className="min-w-0 flex flex-1 items-center gap-3">
              <button
                className="q-icon-button grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#E1EFF7] text-[#138F81]"
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
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-[#138F81]">
                  Pondok Qomaruddin
                </p>
                <p className="hidden text-xs font-semibold text-[#636E72] sm:block">
                  Satu data admin, bendahara, dan aplikasi Android
                </p>
              </div>
            </div>
            <div className="q-topbar-actions flex shrink-0 items-center gap-2">
              <div className="relative">
                <button
                  className="q-icon-button relative grid h-10 w-10 place-items-center rounded-2xl bg-[#E8F7F3] text-[#138F81]"
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
                  <Bell size={18} />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#E8590C] px-1 text-[10px] font-extrabold text-white">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {notificationOpen ? (
                  <div className="q-popover absolute right-0 top-13 z-30 w-80 rounded-3xl bg-white p-4 shadow-2xl shadow-black/10">
                    <div className="mb-3 flex items-center justify-between gap-2 border-b border-black/5 pb-3">
                      <div>
                        <p className="text-xs font-extrabold text-[#2D3436]">
                          Notifikasi Sistem
                        </p>
                        <p className="text-[11px] font-semibold text-[#636E72]">
                          {unreadNotifications} belum dibaca
                        </p>
                      </div>
                      <button
                        className="text-[11px] font-extrabold text-[#138F81] hover:underline"
                        onClick={() => void loadNotifications(true)}
                        type="button"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="q-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
                      {notificationsLoading ? (
                        <div className="py-8 text-center text-xs font-bold text-[#636E72]">
                          Memuat notifikasi...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="py-8 text-center text-xs font-bold text-[#636E72]">
                          Tidak ada notifikasi
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const isRead = Boolean(item.is_read);
                          return (
                            <button
                              key={String(item.id)}
                              className={`w-full rounded-2xl p-3 text-left transition ${
                                isRead
                                  ? "bg-[#F8FAFC] text-[#636E72]"
                                  : "bg-[#E8F7F3] text-[#2D3436]"
                              }`}
                              onClick={() => void markNotificationRead(item)}
                              type="button"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-extrabold text-[#2D3436]">
                                  {String(item.title ?? "Notifikasi")}
                                </p>
                                {!isRead ? (
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#138F81]" />
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs font-medium leading-relaxed">
                                {String(item.message ?? "")}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
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
                    <p className="max-w-28 truncate text-xs font-extrabold text-[#2D3436]">
                      {session?.name ?? "Admin"}
                    </p>
                    <p className="text-[10px] font-semibold capitalize text-[#636E72]">
                      {session?.role ?? "Superadmin"}
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
                  <div className="q-popover absolute right-0 top-13 z-30 w-56 rounded-3xl bg-white p-3 shadow-2xl shadow-black/10">
                    <div className="border-b border-black/5 px-2 py-2">
                      <p className="truncate text-xs font-extrabold text-[#2D3436]">
                        {session?.name}
                      </p>
                      <p className="text-[10px] font-semibold text-[#636E72]">
                        {session?.email}
                      </p>
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
        </main>
      </div>
    </div>
  );
}
