const DEFAULT_API_BASE = 'https://absensi-android.vercel.app/api';

export type ApiRecord = Record<string, unknown>;

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

export interface UserSession {
  id: number;
  name: string;
  email?: string;
  no_hp?: string;
  nis?: string;
  nisn?: string;
  foto_url?: string | null;
  role: string;
  admin_type?: string | null;
  status?: string;
  permissions?: ApiRecord;
  token: string;
}

export interface PaymentFormPayload {
  user_id: number;
  siswa_id: number;
  atas_nama?: string;
  via: string;
  payment_method_id?: number;
  jumlah: number;
  tanggal: string;
  status: string;
  academic_year_id?: number;
  semester_id?: number;
  keterangan?: string;
  payment_items: ApiRecord[];
  payment_security_password?: string;
}

export interface AbsensiSholatBulkPayload {
  tanggal: string;
  boarding_room_id: number;
  prayer_attendance_type_id?: number;
  actor_user_id?: number;
  diinput_oleh?: string;
  diinput_via?: 'online' | 'offline_sync';
  items: Array<{
    siswa_id: number;
    status_code: 'M' | 'I' | 'S';
    keterangan?: string;
  }>;
}

export interface AbsensiMadinBulkPayload {
  user_id?: number;
  actor_user_id?: number;
  absensi: Array<{
    siswa_id: number;
    tanggal: string;
    status: 'Hadir' | 'Izin' | 'Sakit' | 'Alfa' | 'H' | 'I' | 'S' | 'A';
    class_id: number;
    mapel_id: number;
    jadwal_id: number;
    keterangan?: string;
    diinput_via?: 'online' | 'offline_sync';
  }>;
}

export interface AbsensiNgajiBulkPayload {
  tanggal: string;
  ngaji_schedule_id: number;
  actor_user_id?: number;
  diinput_oleh?: string;
  diinput_via?: 'online' | 'offline_sync';
  items: Array<{
    siswa_id: number;
    status_code: 'H' | 'I' | 'S' | 'A';
    keterangan?: string;
  }>;
}

export interface ImportResult {
  success: boolean;
  message?: string;
  total_baris: number;
  berhasil: number;
  gagal: number;
  errors: ApiRecord[];
  warnings?: ApiRecord[];
  data: ApiRecord[];
}

const storageKey = 'qomaruddin_admin_session';
const importBatchSize = 100;

function normalizeApiBaseUrl(rawValue?: string): string {
  const cleaned = (rawValue || DEFAULT_API_BASE)
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/g, '');

  if (!cleaned) return DEFAULT_API_BASE;
  return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`;
}

export function apiBaseUrl(): string {
  return normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
}

export function readSession(): UserSession | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeSession(session: UserSession): void {
  localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(storageKey);
}

function authHeaders(): HeadersInit {
  const session = readSession();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
  };
}

function authUploadHeaders(): HeadersInit {
  const session = readSession();
  return {
    Accept: 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
  };
}

function sessionFromData(data: ApiRecord, token: string): UserSession {
  return {
    id: Number(data.id ?? 0),
    name: String(data.name ?? 'Admin'),
    email: data.email ? String(data.email) : undefined,
    no_hp: data.no_hp ? String(data.no_hp) : undefined,
    nis: data.nis ? String(data.nis) : undefined,
    nisn: data.nisn ? String(data.nisn) : undefined,
    foto_url: data.foto_url ? String(data.foto_url) : null,
    role: String(data.role ?? ''),
    admin_type: data.admin_type ? String(data.admin_type) : null,
    status: data.status ? String(data.status) : undefined,
    permissions: data.permissions && typeof data.permissions === 'object' ? (data.permissions as ApiRecord) : undefined,
    token
  };
}

function toQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string | number | boolean | undefined | null>
): Promise<ApiResponse<T>> {
  const url = `${apiBaseUrl()}${path}${toQuery(params)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers ?? {})
      }
    });
  } catch (error) {
    throw new Error(
      `Gagal terhubung ke backend. Cek VITE_API_BASE_URL di Vercel: ${apiBaseUrl()}`
    );
  }
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request gagal (${response.status})`);
  }
  return payload;
}

async function importRowsInBatches(path: string, rows: ApiRecord[]): Promise<ImportResult> {
  if (rows.length === 0) {
    return {
      success: true,
      message: 'Tidak ada data untuk diimport',
      total_baris: 0,
      berhasil: 0,
      gagal: 0,
      errors: [],
      data: []
    };
  }

  let berhasil = 0;
  let gagal = 0;
  const errors: ApiRecord[] = [];
  const warnings: ApiRecord[] = [];
  const data: ApiRecord[] = [];

  for (let start = 0; start < rows.length; start += importBatchSize) {
    const chunk = rows.slice(start, start + importBatchSize);
    const result = await request<ApiRecord>(path, {
      method: 'POST',
      body: JSON.stringify({ rows: chunk })
    });
    const payload = result as ApiRecord;
    berhasil += Number(payload.berhasil ?? 0);
    gagal += Number(payload.gagal ?? 0);
    const chunkErrors = Array.isArray(payload.errors) ? payload.errors : [];
    chunkErrors.forEach((item) => {
      const row: ApiRecord = item && typeof item === 'object' ? { ...(item as ApiRecord) } : { alasan: String(item ?? '') };
      if (typeof row.row === 'number') row.row += start;
      if (typeof row.baris === 'number') row.baris += start;
      errors.push(row);
    });
    if (Array.isArray(payload.warnings)) warnings.push(...(payload.warnings as ApiRecord[]));
    if (Array.isArray(payload.data)) data.push(...(payload.data as ApiRecord[]));
  }

  return {
    success: gagal === 0,
    message: gagal > 0 ? 'Import selesai dengan beberapa catatan.' : 'Import selesai.',
    total_baris: rows.length,
    berhasil,
    gagal,
    errors,
    warnings,
    data
  };
}

export const api = {
  async login(identifier: string, password: string): Promise<UserSession> {
    const payload = await request<ApiRecord>('/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, device_name: 'admin-web' })
    });
    const data = payload.data as ApiRecord;
    const token = String(payload.token ?? '');
    const session = sessionFromData(data, token);
    if (session.role !== 'admin') {
      throw new Error('Web admin hanya untuk Admin Utama dan Bendahara.');
    }
    writeSession(session);
    try {
      const profile = await this.profile();
      const profileData = (profile.data && typeof profile.data === 'object' ? profile.data : {}) as ApiRecord;
      const enriched = { ...sessionFromData(profileData, token), admin_type: session.admin_type ?? null };
      writeSession(enriched);
      return enriched;
    } catch {
      return session;
    }
  },
  logout() {
    return request('/logout', { method: 'POST' }).finally(clearSession);
  },
  profile() {
    return request<ApiRecord>('/profile');
  },
  async refreshProfile(): Promise<UserSession> {
    const current = readSession();
    if (!current?.token) {
      throw new Error('Sesi tidak ditemukan.');
    }
    const response = await request<ApiRecord>('/profile');
    const data = (response.data && typeof response.data === 'object' ? response.data : {}) as ApiRecord;
    const next = { ...sessionFromData(data, current.token), admin_type: current.admin_type ?? (data.admin_type ? String(data.admin_type) : null) };
    writeSession(next);
    return next;
  },
  updateProfile(data: ApiRecord) {
    return request<ApiRecord>('/profile', { method: 'PUT', body: JSON.stringify(data) });
  },
  async uploadProfilePhoto(file: File) {
    const url = `${apiBaseUrl()}/profile/foto`;
    const form = new FormData();
    form.set('foto', file);
    const response = await fetch(url, {
      method: 'POST',
      headers: authUploadHeaders(),
      body: form
    });
    const payload = (await response.json().catch(() => ({}))) as ApiResponse<ApiRecord>;
    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || `Upload foto gagal (${response.status})`);
    }
    return payload;
  },
  deleteProfilePhoto() {
    return request<ApiRecord>('/profile/foto', { method: 'DELETE' });
  },
  changePassword(data: { identifier: string; current_password: string; new_password: string; new_password_confirmation: string }) {
    return request<ApiRecord>('/change-password', { method: 'POST', body: JSON.stringify(data) });
  },
  dashboard(userId?: number) {
    return request<ApiRecord>('/dashboard', {}, userId ? { user_id: userId } : undefined);
  },
  notifications() {
    return request<ApiRecord[]>('/notifications');
  },
  markNotificationRead(id: number) {
    return request<ApiRecord>(`/notifications/${id}/read`, { method: 'PATCH' });
  },
  activeAcademicPeriod() {
    return request<ApiRecord>('/academic-periods/active');
  },
  academicPeriods() {
    return request<ApiRecord[]>('/academic-periods');
  },
  createAcademicPeriod(data: ApiRecord) {
    return request<ApiRecord>('/academic-periods', { method: 'POST', body: JSON.stringify(data) });
  },
  updateAcademicPeriod(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/academic-periods/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  activateAcademicPeriod(id: number, semester?: string) {
    return request<ApiRecord>(`/academic-periods/${id}/activate`, { method: 'POST', body: JSON.stringify(semester ? { semester } : {}) });
  },
  setAcademicSemester(id: number, semester: string) {
    return request<ApiRecord>(`/academic-periods/${id}/semester`, { method: 'POST', body: JSON.stringify({ semester }) });
  },
  syncAcademicPeriodSiswa(id: number, data: ApiRecord = {}) {
    return request<ApiRecord>(`/academic-periods/${id}/sync-siswa`, { method: 'POST', body: JSON.stringify(data) });
  },
  siswa(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/siswa', {}, params);
  },
  importSiswa(rows: ApiRecord[]) {
    return importRowsInBatches('/siswa/import', rows);
  },
  users(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/users', {}, params);
  },
  importUsers(rows: ApiRecord[]) {
    return importRowsInBatches('/users/import', rows);
  },
  importGuru(rows: ApiRecord[]) {
    return importRowsInBatches('/users/import-guru', rows);
  },
  classes() {
    return request<ApiRecord[]>('/classes');
  },
  mataPelajaran(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/mata-pelajaran', {}, params);
  },
  createMataPelajaran(data: ApiRecord) {
    return request<ApiRecord>('/mata-pelajaran', { method: 'POST', body: JSON.stringify(data) });
  },
  updateMataPelajaran(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/mata-pelajaran/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteMataPelajaran(id: number) {
    return request(`/mata-pelajaran/${id}`, { method: 'DELETE' });
  },
  jadwal(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/jadwal', {}, params);
  },
  kelompokBelajar(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/kelompok-belajar', {}, params);
  },
  kelompokBelajarDetail(id: number) {
    return request<ApiRecord>(`/kelompok-belajar/${id}`);
  },
  createKelompokBelajar(data: ApiRecord) {
    return request<ApiRecord>('/kelompok-belajar', { method: 'POST', body: JSON.stringify(data) });
  },
  updateKelompokBelajar(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/kelompok-belajar/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteKelompokBelajar(id: number) {
    return request(`/kelompok-belajar/${id}`, { method: 'DELETE' });
  },
  addSiswaToKelompok(kelompokId: number, siswaId: number) {
    return request<ApiRecord>(`/kelompok-belajar/${kelompokId}/siswa`, { method: 'POST', body: JSON.stringify({ siswa_id: siswaId }) });
  },
  removeSiswaFromKelompok(kelompokId: number, siswaId: number) {
    return request(`/kelompok-belajar/${kelompokId}/siswa/${siswaId}`, { method: 'DELETE' });
  },
  boardingComplexes() {
    return request<ApiRecord[]>('/boarding/complexes');
  },
  createBoardingComplex(data: ApiRecord) {
    return request<ApiRecord>('/boarding/complexes', { method: 'POST', body: JSON.stringify(data) });
  },
  updateBoardingComplex(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/boarding/complexes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteBoardingComplex(id: number) {
    return request(`/boarding/complexes/${id}`, { method: 'DELETE' });
  },
  createBoardingRoom(data: ApiRecord) {
    return request<ApiRecord>('/boarding/rooms', { method: 'POST', body: JSON.stringify(data) });
  },
  updateBoardingRoom(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/boarding/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteBoardingRoom(id: number) {
    return request(`/boarding/rooms/${id}`, { method: 'DELETE' });
  },
  boardingStudents(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/boarding/students', {}, params);
  },
  assignBoardingStudents(data: ApiRecord) {
    return request<ApiRecord>('/boarding/assign-students', { method: 'POST', body: JSON.stringify(data) });
  },
  updateBoardingSantri(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/boarding/santri/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteBoardingSantri(id: number) {
    return request(`/boarding/santri/${id}`, { method: 'DELETE' });
  },
  absensi(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/absensi', {}, params);
  },
  createAbsensiBulk(data: AbsensiMadinBulkPayload) {
    return request<ApiRecord>('/absensi/bulk', { method: 'POST', body: JSON.stringify(data) });
  },
  rekapAbsensi(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/absensi/rekap', {}, params);
  },
  absensiSholatContext(params: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/absensi-sholat/context', {}, params);
  },
  createAbsensiSholatBulk(data: AbsensiSholatBulkPayload) {
    return request<ApiRecord>('/absensi-sholat/bulk', { method: 'POST', body: JSON.stringify(data) });
  },
  cancelAbsensiSholat(data: { tanggal: string; boarding_room_id: number; prayer_attendance_type_id?: number; reason?: string }) {
    return request<ApiRecord>('/absensi-sholat/cancel', { method: 'POST', body: JSON.stringify(data) });
  },
  ngajiSessions(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/absensi-ngaji/sessions', {}, params);
  },
  createNgajiSession(data: ApiRecord) {
    return request<ApiRecord>('/absensi-ngaji/sessions', { method: 'POST', body: JSON.stringify(data) });
  },
  updateNgajiSession(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/absensi-ngaji/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteNgajiSession(id: number) {
    return request(`/absensi-ngaji/sessions/${id}`, { method: 'DELETE' });
  },
  ngajiBooks(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/absensi-ngaji/books', {}, params);
  },
  createNgajiBook(data: ApiRecord) {
    return request<ApiRecord>('/absensi-ngaji/books', { method: 'POST', body: JSON.stringify(data) });
  },
  updateNgajiBook(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/absensi-ngaji/books/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteNgajiBook(id: number) {
    return request(`/absensi-ngaji/books/${id}`, { method: 'DELETE' });
  },
  ngajiSchedules(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/absensi-ngaji/schedules', {}, params);
  },
  createNgajiSchedule(data: ApiRecord) {
    return request<ApiRecord>('/absensi-ngaji/schedules', { method: 'POST', body: JSON.stringify(data) });
  },
  updateNgajiSchedule(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/absensi-ngaji/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteNgajiSchedule(id: number) {
    return request(`/absensi-ngaji/schedules/${id}`, { method: 'DELETE' });
  },
  absensiNgajiContext(params: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/absensi-ngaji/context', {}, params);
  },
  createAbsensiNgajiBulk(data: AbsensiNgajiBulkPayload) {
    return request<ApiRecord>('/absensi-ngaji/bulk', { method: 'POST', body: JSON.stringify(data) });
  },
  cancelAbsensiNgaji(data: { tanggal: string; ngaji_schedule_id: number; reason?: string }) {
    return request<ApiRecord>('/absensi-ngaji/cancel', { method: 'POST', body: JSON.stringify(data) });
  },
  rekapAbsensiNgaji(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/absensi-ngaji/rekap', {}, params);
  },
  prayerAttendanceTypes(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/absensi-sholat/types', {}, params);
  },
  createPrayerAttendanceType(data: ApiRecord) {
    return request<ApiRecord>('/absensi-sholat/types', { method: 'POST', body: JSON.stringify(data) });
  },
  updatePrayerAttendanceType(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/absensi-sholat/types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deletePrayerAttendanceType(id: number) {
    return request(`/absensi-sholat/types/${id}`, { method: 'DELETE' });
  },
  paymentToday() {
    return request<ApiRecord[]>('/pembayaran');
  },
  paymentAll(limit = 150) {
    return request<ApiRecord[]>('/pembayaran', {}, { semua: 1, limit });
  },
  paymentTypes(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/payment-types', {}, params);
  },
  createPaymentType(data: ApiRecord) {
    return request<ApiRecord>('/payment-types', { method: 'POST', body: JSON.stringify(data) });
  },
  updatePaymentType(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/payment-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deletePaymentType(id: number) {
    return request(`/payment-types/${id}`, { method: 'DELETE' });
  },
  paymentMethods(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/payment-methods', {}, params);
  },
  createPaymentMethod(data: ApiRecord) {
    return request<ApiRecord>('/payment-methods', { method: 'POST', body: JSON.stringify(data) });
  },
  updatePaymentMethod(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deletePaymentMethod(id: number) {
    return request(`/payment-methods/${id}`, { method: 'DELETE' });
  },
  paymentPeriodTypes(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/payment-period-types', {}, params);
  },
  createPaymentPeriodType(data: ApiRecord) {
    return request<ApiRecord>('/payment-period-types', { method: 'POST', body: JSON.stringify(data) });
  },
  updatePaymentPeriodType(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/payment-period-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deletePaymentPeriodType(id: number) {
    return request(`/payment-period-types/${id}`, { method: 'DELETE' });
  },
  nilai(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/nilai', {}, params);
  },
  createNilai(data: ApiRecord) {
    return request<ApiRecord>('/nilai', { method: 'POST', body: JSON.stringify(data) });
  },
  updateNilai(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/nilai/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteNilai(id: number) {
    return request(`/nilai/${id}`, { method: 'DELETE' });
  },
  rekapNilai(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/nilai/rekap', {}, params);
  },
  hafalan(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/hafalan', {}, params);
  },
  createHafalan(data: ApiRecord) {
    return request<ApiRecord>('/hafalan', { method: 'POST', body: JSON.stringify(data) });
  },
  updateHafalan(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/hafalan/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteHafalan(id: number) {
    return request(`/hafalan/${id}`, { method: 'DELETE' });
  },
  penilaianRekapExport(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/penilaian/rekap-export', {}, params);
  },
  permissionSettings() {
    return request<ApiRecord>('/settings/permissions');
  },
  permissionMenus() {
    return request<ApiRecord[]>('/settings/menus');
  },
  updatePermissionSettings(permissions: ApiRecord[]) {
    return request<ApiRecord>('/settings/permissions', { method: 'PUT', body: JSON.stringify({ permissions }) });
  },
  references(table: string, params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>(`/references/${table}`, {}, params);
  },
  monthlyOptions(params: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/payment-bills/monthly-options', {}, params);
  },
  studentBillingSummary(params: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/payment-bills/student-summary', {}, params);
  },
  createPayment(data: PaymentFormPayload) {
    return request<ApiRecord>('/pembayaran', { method: 'POST', body: JSON.stringify(data) });
  },
  rekapAbsensiSholat(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/absensi-sholat/rekap', {}, params);
  }
};
