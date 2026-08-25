import {
  Bell,
  BookOpen,
  CalendarCheck,
  Check,
  Clock3,
  ChevronDown,
  Home,
  LibraryBig,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sun,
  X,
  UserCog,
  UserRound,
  WalletCards,
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
  key: PageKey;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  children?: Array<{
    label: string;
    page: PageKey;
    masterSection?: BukuIndukSection;
  }>;
}

interface AdminLayoutProps {
  activePage: PageKey;
  activeMasterSection?: BukuIndukSection;
  onNavigate: (
    page: PageKey,
    options?: { masterSection?: BukuIndukSection },
  ) => void;
  children: ReactNode;
}

const allMenu: MenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "absensi", label: "Absensi", icon: CalendarCheck },
  {
    key: "master",
    label: "Master Data",
    icon: LibraryBig,
    children: [
      { label: "Buku Induk", page: "master", masterSection: "ringkas" },
      { label: "Data Siswa/Santri", page: "master", masterSection: "siswa" },
      { label: "Data Santri Alumni", page: "master", masterSection: "alumni" },
      { label: "Data Guru", page: "master", masterSection: "guru" },
      { label: "User Login", page: "master", masterSection: "users" },
      { label: "Data Referensi", page: "master", masterSection: "referensi" },
      { label: "Login Admin", page: "master", masterSection: "login-admin" },
      { label: "Login Guru", page: "master", masterSection: "login-guru" },
      { label: "Login Wali", page: "master", masterSection: "login-wali" },
      { label: "Setting Akademik", page: "master", masterSection: "akademik" },
      { label: "Kelompok Belajar", page: "master", masterSection: "kelompok" },
      { label: "Data Pondok", page: "master", masterSection: "pondok" },
    ],
  },
  { key: "mapel", label: "Mata Pelajaran", icon: BookOpen },
  { key: "jadwal", label: "Jadwal Pelajaran", icon: Clock3 },
  { key: "keuangan", label: "Keuangan", icon: WalletCards },
  { key: "whatsapp", label: "WhatsApp Bot", icon: MessageCircle },
  { key: "nilai", label: "Nilai Ujian/Hafalan", icon: ListChecks },
  { key: "hak-akses", label: "Hak Akses", icon: ShieldCheck },
];

const menuPermissionKeys: Partial<Record<PageKey, string>> = {
  dashboard: "dashboard",
  absensi: "absensi",
  master: "buku_induk",
  guru: "buku_induk",
  users: "buku_induk",
  pondok: "buku_induk",
  mapel: "mata_pelajaran",
  jadwal: "mata_pelajaran",
  keuangan: "keuangan",
  whatsapp: "whatsapp_bot",
  nilai: "nilai",
  "hak-akses": "hak_akses",
};

function notificationDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AdminLayout({
  activePage,
  activeMasterSection = "ringkas",
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
  const [openGroups, setOpenGroups] = useState<
    Partial<Record<PageKey, boolean>>
  >({ master: true });
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("qomaruddin_admin_theme") === "dark",
  );

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setNotificationsLoading(true);
    try {
      const response = await api.notifications();
      setNotifications(Array.isArray(response.data) ? response.data : []);
      setUnreadNotifications(Number(response.unread_count ?? 0));
    } catch {
      // Notifikasi tidak boleh mengganggu penggunaan dashboard utama.
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
      // Status tetap dapat disinkronkan pada polling berikutnya.
    }
  }, []);

  useEffect(() => {
    void loadNotifications();

    const refreshVisibleNotifications = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    };
    const intervalId = window.setInterval(refreshVisibleNotifications, 60_000);
    document.addEventListener("visibilitychange", refreshVisibleNotifications);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        refreshVisibleNotifications,
      );
    };
  }, [loadNotifications]);

  useEffect(() => {
    localStorage.setItem("qomaruddin_admin_theme", darkMode ? "dark" : "light");
    document.documentElement.classList.toggle("q-dark-root", darkMode);
    document.body.classList.toggle("q-dark-body", darkMode);

    return () => {
      document.documentElement.classList.remove("q-dark-root");
      document.body.classList.remove("q-dark-body");
    };
  }, [darkMode]);

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
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    setProfileOpen(false);
    setNotificationOpen(false);
  }, [activePage]);

  const menu = useMemo(() => {
    return allMenu.filter((item) =>
      canView(menuPermissionKeys[item.key] ?? item.key),
    );
  }, [canView]);

  const collapsed = mobileOpen ? false : sidebarCollapsed;
  const nav = (
    <aside
      className={`q-sidebar flex h-full flex-col rounded-[26px] bg-[#FFFDF7] p-5 shadow-xl shadow-black/5 ${
        collapsed ? "w-23" : "w-60"
      }`}
    >
      <div className={`mb-8 pt-2 text-center ${collapsed ? "px-0" : ""}`}>
        <img
          className={`q-brand-logo mx-auto ${collapsed ? "h-11 w-11" : "h-14 w-14"}`}
          src="/logo-qomaruddin.png"
          alt="Logo Qomaruddin"
        />
        {!collapsed ? (
          <>
            <h1 className="mt-4 text-sm font-extrabold leading-5 text-[#138F81]">
              Pondok Pesantren Qomaruddin
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#636E72]">
              Admin Dashboard
            </p>
          </>
        ) : null}
      </div>

      <nav
        className="q-sidebar-nav q-scrollbar space-y-2"
        aria-label="Menu Admin"
      >
        {menu.map((item) => {
          const selected = item.key === activePage;
          const hasChildren = Boolean(item.children?.length);
          const isOpen = Boolean(openGroups[item.key]);
          const Icon = item.icon;
          return (
            <div key={item.key}>
              <button
                className={`q-menu-item flex min-h-12 w-full items-center gap-3 rounded-2xl text-left text-sm font-bold transition ${
                  selected
                    ? "bg-[#138F81] text-white shadow-lg shadow-[#138F81]/25"
                    : "text-[#636E72] hover:bg-[#E1EFF7]"
                } ${collapsed ? "justify-center px-0" : "px-4"}`}
                onClick={() => {
                  if (hasChildren && !collapsed) {
                    setOpenGroups((value) => ({
                      ...value,
                      [item.key]: !value[item.key],
                    }));
                    if (item.key !== activePage) {
                      onNavigate(item.key);
                    }
                  } else {
                    onNavigate(item.key);
                    setMobileOpen(false);
                  }
                  setProfileOpen(false);
                  setNotificationOpen(false);
                }}
                type="button"
                title={collapsed ? item.label : undefined}
                aria-expanded={hasChildren ? isOpen : undefined}
              >
                <Icon size={18} />
                {!collapsed ? (
                  <span className="min-w-0 flex-1">{item.label}</span>
                ) : null}
                {!collapsed && hasChildren ? (
                  <ChevronDown
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    size={15}
                  />
                ) : null}
              </button>
              {!collapsed && hasChildren && isOpen ? (
                <div className="q-submenu mt-2 space-y-1 pl-5">
                  {item.children?.map((child) => {
                    const childActive =
                      child.page === activePage &&
                      (!child.masterSection ||
                        child.masterSection === activeMasterSection);
                    return (
                      <button
                        key={`${child.page}-${child.masterSection ?? child.label}`}
                        className={`flex min-h-9 w-full items-center rounded-xl px-4 text-left text-xs font-extrabold transition ${
                          childActive
                            ? "bg-[#E8F7F3] text-[#138F81]"
                            : "text-[#636E72] hover:bg-[#E1EFF7]"
                        }`}
                        onClick={() => {
                          onNavigate(child.page, {
                            masterSection: child.masterSection,
                          });
                          setMobileOpen(false);
                          setProfileOpen(false);
                          setNotificationOpen(false);
                        }}
                        type="button"
                      >
                        {child.label}
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
    <div
      className={`q-app-shell min-h-screen bg-[#FFDC80] p-4 lg:p-6 ${darkMode ? "theme-dark" : "theme-light"}`}
    >
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
                      if (next) void loadNotifications(true);
                      return next;
                    });
                    setProfileOpen(false);
                  }}
                  type="button"
                  aria-label="Notifikasi"
                  aria-expanded={notificationOpen}
                  aria-haspopup="menu"
                >
                  <Bell size={18} />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#E8590C] px-1 text-[10px] font-extrabold leading-none text-white">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </button>
                {notificationOpen ? (
                  <div
                    className="q-dropdown absolute right-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-3xl bg-[#FFFDF7] p-3 shadow-2xl shadow-black/15"
                    role="menu"
                  >
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#E1EFF7] p-4">
                      <div>
                        <p className="text-sm font-extrabold text-[#2D3436]">
                          Notifikasi
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#636E72]">
                          {unreadNotifications} belum dibaca
                        </p>
                      </div>
                      <Bell className="text-[#138F81]" size={20} />
                    </div>
                    <div className="q-scrollbar mt-3 max-h-88 space-y-2 overflow-y-auto">
                      {notificationsLoading && notifications.length === 0 ? (
                        <p className="rounded-2xl bg-[#E8F7F3] px-4 py-5 text-center text-xs font-bold text-[#138F81]">
                          Memuat notifikasi...
                        </p>
                      ) : notifications.length === 0 ? (
                        <p className="rounded-2xl bg-[#E8F7F3] px-4 py-5 text-center text-xs font-semibold leading-5 text-[#636E72]">
                          Belum ada aktivitas pembayaran atau absensi terbaru.
                        </p>
                      ) : (
                        notifications.slice(0, 12).map((notification) => {
                          const isRead = Boolean(notification.is_read);
                          return (
                            <button
                              key={String(notification.id)}
                              className={`w-full rounded-2xl p-3 text-left transition ${
                                isRead
                                  ? "bg-white hover:bg-[#E1EFF7]"
                                  : "bg-[#E8F7F3] hover:bg-[#DDF2ED]"
                              }`}
                              onClick={() =>
                                void markNotificationRead(notification)
                              }
                              type="button"
                              role="menuitem"
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                                    isRead
                                      ? "bg-[#E1EFF7] text-[#636E72]"
                                      : "bg-[#138F81] text-white"
                                  }`}
                                >
                                  {isRead ? <Check size={14} /> : <Bell size={13} />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-extrabold text-[#2D3436]">
                                    {String(notification.title ?? "Aktivitas baru")}
                                  </span>
                                  <span className="mt-1 block text-[11px] font-semibold leading-5 text-[#636E72]">
                                    {String(notification.message ?? "")}
                                  </span>
                                  <time className="mt-1 block text-[10px] font-bold text-[#138F81]">
                                    {notificationDate(notification.created_at)}
                                  </time>
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                className="q-icon-button grid h-10 w-10 place-items-center rounded-2xl bg-[#E1EFF7] text-[#138F81]"
                onClick={() => setDarkMode((value) => !value)}
                type="button"
                aria-label={
                  darkMode ? "Aktifkan mode siang" : "Aktifkan mode malam"
                }
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className="relative">
                <button
                  className="q-profile-button flex min-h-10 items-center gap-3 rounded-2xl bg-[#2D3436] px-3 py-2 text-white"
                  onClick={() => {
                    setProfileOpen((value) => !value);
                    setNotificationOpen(false);
                  }}
                  type="button"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                >
                  <UserRound size={17} />
                  <span className="hidden max-w-42.5 truncate text-xs font-bold sm:inline">
                    {session?.name ?? "Admin"}
                  </span>
                  <ChevronDown
                    className={`transition-transform ${profileOpen ? "rotate-180" : ""}`}
                    size={15}
                  />
                </button>
                {profileOpen ? (
                  <div
                    className="q-dropdown absolute right-0 top-12 z-30 w-72 rounded-3xl bg-[#FFFDF7] p-3 shadow-2xl shadow-black/15"
                    role="menu"
                  >
                    <div className="rounded-2xl bg-[#E1EFF7] p-4">
                      <p className="text-sm font-extrabold text-[#2D3436]">
                        {session?.name ?? "Admin Madrasah"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#636E72]">
                        {session?.email ?? "Akun admin"}
                      </p>
                      <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#138F81]">
                        {session?.admin_type
                          ? `Admin ${session.admin_type}`
                          : "Admin utama"}
                      </span>
                    </div>
                    <button
                      className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm font-bold text-[#2D3436] hover:bg-[#E1EFF7]"
                      onClick={() => {
                        onNavigate("account");
                        setProfileOpen(false);
                        setMobileOpen(false);
                      }}
                      type="button"
                      role="menuitem"
                    >
                      <UserCog size={18} />
                      Pengaturan akun
                    </button>
                    <button
                      className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm font-bold text-[#D63031] hover:bg-[#FDECEC]"
                      onClick={() => void logout()}
                      type="button"
                      role="menuitem"
                    >
                      <LogOut size={18} />
                      Keluar
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          <section key={activePage} className="q-page-enter">
            {children}
          </section>
          <footer className="pb-5 pt-8" aria-label="Informasi pengembang">
            <div className="flex items-center gap-3 sm:gap-5">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#138F81]/35" />
              <div className="rounded-full border border-[#138F81]/15 bg-[#FFFDF7]/80 px-5 py-2 shadow-sm shadow-[#138F81]/10 backdrop-blur-sm">
                <p className="text-xs font-bold tracking-wide text-[#138F81] sm:text-sm">
                  By : ITQOm
                </p>
              </div>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#138F81]/35" />
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
