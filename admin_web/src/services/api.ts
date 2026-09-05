const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL;

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
  jenis_kelamin?: string | null;
  panggilan?: string | null;
  status?: string;
  permissions?: ApiRecord;
  token: string;
  anak?: ApiRecord[];
  hak_akses?: {
    absen_madin?: boolean;
    absen_sholat?: boolean;
    absen_ngaji?: boolean;
    nilai?: boolean;
  };
  must_change_password?: boolean;
  pmb_visible_to_pengurus?: boolean;
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
    name: String(data.name ?? 'Pengguna'),
    email: data.email ? String(data.email) : undefined,
    no_hp: data.no_hp ? String(data.no_hp) : undefined,
    nis: data.nis ? String(data.nis) : undefined,
    nisn: data.nisn ? String(data.nisn) : undefined,
    foto_url: data.foto_url ? String(data.foto_url) : null,
    role: String(data.role ?? ''),
    admin_type: data.admin_type ? String(data.admin_type) : null,
    jenis_kelamin: data.jenis_kelamin ? String(data.jenis_kelamin) : null,
    panggilan: data.panggilan ? String(data.panggilan) : null,
    status: data.status ? String(data.status) : undefined,
    permissions: data.permissions && typeof data.permissions === 'object' ? (data.permissions as ApiRecord) : undefined,
    anak: Array.isArray(data.anak) ? (data.anak as ApiRecord[]) : undefined,
    must_change_password: Boolean(data.must_change_password),
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
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('qomaruddin_auth_expired'));
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request gagal (${response.status})`);
  }
  return payload;
}

async function uploadRequest<T>(
  path: string,
  formData: FormData,
  params?: Record<string, string | number | boolean | undefined | null>
): Promise<ApiResponse<T>> {
  const url = `${apiBaseUrl()}${path}${toQuery(params)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: authUploadHeaders(),
      body: formData
    });
  } catch (error) {
    throw new Error(
      `Gagal terhubung ke backend. Cek VITE_API_BASE_URL: ${apiBaseUrl()}`
    );
  }
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('qomaruddin_auth_expired'));
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Upload gagal (${response.status})`);
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
  get<T = any>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'GET' }, params);
  },
  post<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  },
  put<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  },
  patch<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  },
  delete<T = any>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'DELETE' });
  },
  postForm<T = any>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    return uploadRequest<T>(path, formData);
  },
  getCaptcha() {
    return request<{ img: string; key: string }>('/captcha');
  },
  async login(identifier: string, password: string): Promise<UserSession> {
    const payload = await request<ApiRecord>('/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, device_name: 'admin-web' })
    });
    const data = payload.data as ApiRecord;
    const token = String(payload.token ?? '');
    const session = sessionFromData(data, token);
    if (!['admin', 'wali', 'guru'].includes(session.role)) {
      throw new Error('Role akun tidak dikenali.');
    }
    writeSession(session);
    try {
      const profile = await this.profile();
      const profileData = (profile.data && typeof profile.data === 'object' ? profile.data : {}) as ApiRecord;
      const enriched = {
        ...sessionFromData(profileData, token),
        admin_type: session.admin_type ?? null,
        anak: session.anak ?? (Array.isArray(profileData.anak) ? (profileData.anak as ApiRecord[]) : undefined)
      };
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
  dashboard() {
    return request<ApiRecord>('/dashboard');
  },
  notifications() {
    return request<ApiRecord[]>('/notifications');
  },
  markNotificationRead(id: number) {
    return request<ApiRecord>(`/notifications/${id}/read`, { method: 'PATCH' });
  },
  markAllNotificationsRead() {
    return request<{ success: boolean; message?: string }>('/notifications/mark-all-read', { method: 'POST' });
  },
  deleteNotification(id: number) {
    return request<{ success: boolean; message?: string }>(`/notifications/${id}`, { method: 'DELETE' });
  },
  clearAllNotifications(scope?: 'my' | 'all_system') {
    return request<{ success: boolean; deleted_count?: number; message?: string }>('/notifications/clear-all', {
      method: 'POST',
      body: JSON.stringify(scope ? { scope } : {})
    });
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
  autoPromoteAcademicPeriod(id: number) {
    return request<ApiRecord>(`/academic-periods/${id}/auto-promote`, { method: 'POST' });
  },
  deleteAcademicPeriod(id: number) {
    return request<{ message?: string }>(`/academic-periods/${id}`, { method: 'DELETE' });
  },
  siswa(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/siswa', {}, params);
  },
  createSiswa(data: ApiRecord) {
    return request<ApiRecord>('/siswa', { method: 'POST', body: JSON.stringify(data) });
  },
  updateSiswa(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/siswa/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteSiswa(id: number) {
    return request(`/siswa/${id}`, { method: 'DELETE' });
  },
  bulkUpdateSiswaStatus(ids: number[], status: 'Aktif' | 'Nonaktif' | 'Lulus', extra: ApiRecord = {}) {
    return request<ApiRecord>('/siswa/bulk-status', { method: 'POST', body: JSON.stringify({ ids, status, ...extra }) });
  },
  restoreAlumni(siswaId: number) {
    return request<ApiRecord>(`/siswa/${siswaId}/restore-alumni`, { method: 'POST' });
  },
  importSiswa(rows: ApiRecord[]) {
    return importRowsInBatches('/siswa/import', rows);
  },
  users(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/users', {}, { include_passwords: 1, ...params });
  },
  createUser(data: ApiRecord) {
    return request<ApiRecord>('/users', { method: 'POST', body: JSON.stringify(data) });
  },
  updateUser(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteUser(id: number) {
    return request(`/users/${id}`, { method: 'DELETE' });
  },
  resetUserPassword(id: number) {
    return request<ApiRecord>(`/users/${id}/reset-password`, { method: 'POST' });
  },
  importUsers(rows: ApiRecord[]) {
    return importRowsInBatches('/users/import', rows);
  },
  importGuru(rows: ApiRecord[]) {
    return importRowsInBatches('/users/import-guru', rows);
  },
  classes(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/classes', {}, params);
  },
  createClass(data: ApiRecord) {
    return request<ApiRecord>('/classes', { method: 'POST', body: JSON.stringify(data) });
  },
  updateClass(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteClass(id: number) {
    return request(`/classes/${id}`, { method: 'DELETE' });
  },
  schoolOrigins(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/school-origins', {}, params);
  },
  regionProvinces(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/regions/provinces', {}, params);
  },
  regionCities(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/regions/cities', {}, params);
  },
  regionDistricts(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/regions/districts', {}, params);
  },
  regionVillages(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/regions/villages', {}, params);
  },
  masterReferensi(params?: { kategori?: string; search?: string; active?: boolean }) {
    return request<ApiRecord[]>('/master-referensi', {}, params);
  },
  createMasterReferensi(data: ApiRecord) {
    return request<ApiRecord>('/master-referensi', { method: 'POST', body: JSON.stringify(data) });
  },
  updateMasterReferensi(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/master-referensi/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteMasterReferensi(id: number) {
    return request(`/master-referensi/${id}`, { method: 'DELETE' });
  },
  // PEMASUKAN LAIN / SUMBER DANA KAS
  pemasukanLain(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/pemasukan-lain', {}, params);
  },
  createPemasukanLain(data: ApiRecord) {
    return request<ApiRecord>('/pemasukan-lain', { method: 'POST', body: JSON.stringify(data) });
  },
  updatePemasukanLain(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/pemasukan-lain/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deletePemasukanLain(id: number) {
    return request(`/pemasukan-lain/${id}`, { method: 'DELETE' });
  },
  async exportPemasukanLain(params: Record<string, string | number | boolean> = {}) {
    const session = readSession();
    const query = new URLSearchParams({
      format: 'excel',
      user_id: String(session?.id || ''),
      ...Object.fromEntries(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ),
    });

    const response = await fetch(`${apiBaseUrl()}/pemasukan-lain/export?${query.toString()}`, {
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Gagal mengunduh file Excel (${response.statusText})`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const catText = String(params.kategori || 'Semua').replace(/[/\\ ]/g, '-');
    link.download = `Rekap_Pemasukan_Kas_${catText}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
  createJadwal(data: ApiRecord) {
    return request<ApiRecord>('/jadwal', { method: 'POST', body: JSON.stringify(data) });
  },
  updateJadwal(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/jadwal/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteJadwal(id: number) {
    return request(`/jadwal/${id}`, { method: 'DELETE' });
  },
  syncJadwalGroup(data: ApiRecord) {
    return request<ApiRecord>('/jadwal/sync-group', { method: 'POST', body: JSON.stringify(data) });
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
  exportBoardingSantri() {
    return fetch(`${apiBaseUrl()}/boarding/santri/export`, {
      headers: {
        Authorization: `Bearer ${readSession()?.token ?? ''}`
      }
    }).then(res => {
      if (!res.ok) throw new Error('Gagal mendownload data');
      return res.blob();
    });
  },
  importBoardingSantri(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${apiBaseUrl()}/boarding/santri/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${readSession()?.token ?? ''}`
      },
      body: formData
    }).then(res => res.json()) as Promise<ApiResponse>;
  },
  absensi(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord[]>('/absensi', {}, params);
  },
  createAbsensiBulk(data: AbsensiMadinBulkPayload) {
    return request<ApiRecord>('/absensi/bulk', { method: 'POST', body: JSON.stringify(data) });
  },
  cancelAbsensiSession(data: { tanggal: string; class_id: number; mapel_id: number; jadwal_id: number }) {
    return request<ApiRecord>('/absensi/cancel-session', { method: 'POST', body: JSON.stringify(data) });
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
  paymentChart() {
    return request<ApiRecord[]>('/pembayaran/chart');
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
  deletePaymentTransaction(id: number, type: 'transaction' | 'legacy') {
    if (type === 'transaction') {
      return request(`/pembayaran/transaksi/${id}`, { method: 'DELETE' });
    }
    return request(`/pembayaran/${id}`, { method: 'DELETE' });
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
  documentSettings() {
    return request<ApiRecord>('/document-settings');
  },
  updateDocumentSettings(data: ApiRecord) {
    return request<ApiRecord>('/document-settings', { method: 'PUT', body: JSON.stringify(data) });
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
  sendBillNotification(studentId: number) {
    return request<ApiRecord>(`/payment-bills/student/${studentId}/notify`, { method: 'POST' });
  },
  notifyPaymentBill(id: number, data: { message?: string; channel?: 'in_app' | 'whatsapp' | 'both' }) {
    return request<ApiRecord>(`/payment-bills/${id}/notify`, { method: 'POST', body: JSON.stringify(data) });
  },
  createPayment(data: PaymentFormPayload) {
    return request<ApiRecord>('/pembayaran', { method: 'POST', body: JSON.stringify(data) });
  },
  getPaymentTransaction(id: number) {
    return request<ApiRecord>(`/pembayaran/transaksi/${id}`);
  },
  notifyWaPayment(id: number) {
    return request<ApiRecord>(`/pembayaran/transaksi/${id}/notify-wa`, { method: 'POST' });
  },
  waliGetVerifikasiPembayaran(siswaId: number) {
    return request<ApiRecord[]>('/wali/pembayaran/verifikasi', {}, { siswa_id: siswaId });
  },
  waliUploadBuktiTransfer(formData: FormData) {
    return uploadRequest<ApiRecord>('/wali/pembayaran/verifikasi', formData);
  },
  waliGetTransaksiKwitansi(id: number) {
    return request<ApiRecord>(`/wali/pembayaran/transaksi/${id}`);
  },
  adminGetVerifikasiPembayaran(params?: Record<string, string | number | boolean | undefined | null>) {
    return request<ApiRecord[]>('/pembayaran/verifikasi', {}, params);
  },
  adminApproveVerifikasiPembayaran(id: number, payload?: ApiRecord) {
    return request<ApiRecord>(`/pembayaran/verifikasi/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {})
    });
  },
  adminRejectVerifikasiPembayaran(id: number, payload: { alasan: string }) {
    return request<ApiRecord>(`/pembayaran/verifikasi/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  adminGetProofStorageStatus(days = 60) {
    return request<ApiRecord>('/pembayaran/verifikasi/storage-status', {}, { days });
  },
  adminPurgeOldProofs(days = 60) {
    return request<ApiRecord>('/pembayaran/verifikasi/purge-proofs', {
      method: 'POST',
      body: JSON.stringify({ days })
    });
  },
  async downloadPaymentRecapExcel(params: Record<string, string | number | boolean>) {
    const session = readSession();
    const query = new URLSearchParams({
      format: 'excel',
      user_id: String(session?.id || ''),
      ...Object.fromEntries(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ),
    });

    const response = await fetch(`${apiBaseUrl()}/pembayaran/rekap-export?${query.toString()}`, {
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Gagal mengunduh file Excel (${response.statusText})`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const yearText = String(params.tahun_ajaran || 'Semua').replace(/[/\\ ]/g, '-');
    const semText = String(params.semester || 'Semua').replace(/[/\\ ]/g, '-');
    link.download = `Rekap_Keuangan_${yearText}_${semText}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  rekapAbsensiSholat(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/absensi-sholat/rekap', {}, params);
  },
  whatsappStatus() {
    return request<ApiRecord>('/whatsapp/status');
  },
  whatsappConnect(data: { client_id?: string; client_name?: string }) {
    return request<ApiRecord>('/whatsapp/connect', { method: 'POST', body: JSON.stringify(data) });
  },
  whatsappQr(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/whatsapp/qr', {}, params);
  },
  whatsappReconnect(clientId: string) {
    return request<ApiRecord>('/whatsapp/reconnect', { method: 'POST', body: JSON.stringify({ client_id: clientId }) });
  },
  whatsappLogout(clientId: string) {
    return request<ApiRecord>('/whatsapp/logout', { method: 'POST', body: JSON.stringify({ client_id: clientId }) });
  },
  whatsappSend(data: { phone_number: string; message: string }) {
    return request<ApiRecord>('/whatsapp/send', { method: 'POST', body: JSON.stringify(data) });
  },
  whatsappMessages(params?: Record<string, string | number | boolean>) {
    return request<ApiRecord>('/whatsapp/messages', {}, params);
  },
  whatsappRetry(messageId: number) {
    return request<ApiRecord>(`/whatsapp/messages/${messageId}/retry`, { method: 'POST' });
  },
  whatsappTemplates() {
    return request<ApiRecord[]>('/whatsapp/templates');
  },
  createWhatsappTemplate(data: ApiRecord) {
    return request<ApiRecord>('/whatsapp/templates', { method: 'POST', body: JSON.stringify(data) });
  },
  updateWhatsappTemplate(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/whatsapp/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteWhatsappTemplate(id: number) {
    return request<ApiRecord>(`/whatsapp/templates/${id}`, { method: 'DELETE' });
  },
  notificationSettings() {
    return request<ApiRecord[]>('/notification-settings');
  },
  updateNotificationSettings(settings: ApiRecord[]) {
    return request<ApiRecord[]>('/notification-settings', { method: 'PUT', body: JSON.stringify({ settings }) });
  },
  pengeluaran(params?: Record<string, string | number | boolean>) {
    return request<{ data: ApiRecord[]; summary?: ApiRecord } | ApiRecord[]>('/pengeluaran', {}, params);
  },
  getPengeluaran(id: number) {
    return request<ApiRecord>(`/pengeluaran/${id}`);
  },
  createPengeluaran(data: ApiRecord) {
    return request<ApiRecord>('/pengeluaran', { method: 'POST', body: JSON.stringify(data) });
  },
  updatePengeluaran(id: number, data: ApiRecord) {
    return request<ApiRecord>(`/pengeluaran/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deletePengeluaran(id: number) {
    return request(`/pengeluaran/${id}`, { method: 'DELETE' });
  },
  async exportPengeluaran(params: Record<string, string | number | boolean> = {}) {
    const session = readSession();
    const query = new URLSearchParams({
      format: 'excel',
      user_id: String(session?.id || ''),
      ...Object.fromEntries(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ),
    });

    const response = await fetch(`${apiBaseUrl()}/pengeluaran/export?${query.toString()}`, {
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Gagal mengunduh file Excel (${response.statusText})`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const catText = String(params.kategori || 'Semua').replace(/[/\\ ]/g, '-');
    link.download = `Rekap_Pengeluaran_${catText}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // --- WALI / ORANG TUA PORTAL API ---
  waliAnak() {
    return request<ApiRecord[]>('/wali/anak');
  },
  waliBiodata(siswaId: number) {
    return request<ApiRecord>(`/wali/biodata?siswa_id=${siswaId}`);
  },
  waliAbsensi(siswaId: number, params?: { bulan?: number; tahun?: number }) {
    const q = new URLSearchParams({ siswa_id: String(siswaId) });
    if (params?.bulan) q.set('bulan', String(params.bulan));
    if (params?.tahun) q.set('tahun', String(params.tahun));
    return request<ApiRecord>(`/wali/absensi?${q.toString()}`);
  },
  waliAbsensiSholat(siswaId: number, params?: { bulan?: number; tahun?: number }) {
    const q = new URLSearchParams({ siswa_id: String(siswaId) });
    if (params?.bulan) q.set('bulan', String(params.bulan));
    if (params?.tahun) q.set('tahun', String(params.tahun));
    return request<ApiRecord>(`/wali/absensi/sholat?${q.toString()}`);
  },
  waliAbsensiNgaji(siswaId: number, params?: { bulan?: number; tahun?: number }) {
    const q = new URLSearchParams({ siswa_id: String(siswaId) });
    if (params?.bulan) q.set('bulan', String(params.bulan));
    if (params?.tahun) q.set('tahun', String(params.tahun));
    return request<ApiRecord>(`/wali/absensi/ngaji?${q.toString()}`);
  },
  waliPembayaran(siswaId: number, params?: { academic_year_id?: number; semester_id?: number; tahun_ajaran?: string; semester?: string }) {
    const q = new URLSearchParams({ siswa_id: String(siswaId) });
    if (params?.academic_year_id) q.set('academic_year_id', String(params.academic_year_id));
    if (params?.semester_id) q.set('semester_id', String(params.semester_id));
    if (params?.tahun_ajaran) q.set('tahun_ajaran', String(params.tahun_ajaran));
    if (params?.semester) q.set('semester', String(params.semester));
    return request<ApiRecord>(`/wali/pembayaran?${q.toString()}`);
  },
  waliNilai(siswaId: number, params?: { academic_year_id?: number; semester_id?: number; tahun_ajaran?: string; semester?: string }) {
    const q = new URLSearchParams({ siswa_id: String(siswaId) });
    if (params?.academic_year_id) q.set('academic_year_id', String(params.academic_year_id));
    if (params?.semester_id) q.set('semester_id', String(params.semester_id));
    if (params?.tahun_ajaran) q.set('tahun_ajaran', String(params.tahun_ajaran));
    if (params?.semester) q.set('semester', String(params.semester));
    return request<ApiRecord>(`/wali/nilai?${q.toString()}`);
  },

  // --- PMB & WEB PROFIL CMS API ---
  getPmbInfo() {
    return request<ApiRecord>('/pmb/info');
  },
  getPmbCmsSettings() {
    return request<ApiRecord>('/pmb/cms-settings');
  },
  getPmbPublicAnnouncements(category?: string) {
    const q = category ? `?category=${category}` : '';
    return request<ApiRecord[]>(`/pmb/announcements${q}`);
  },
  getPmbDashboard() {
    return request<ApiRecord>('/pmb/admin/dashboard');
  },
  getPmbRegistrations(params?: Record<string, string | number>) {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<ApiRecord>(`/pmb/admin/registrations${q}`);
  },
  getPmbRegistrationDetail(id: number) {
    return request<ApiRecord>(`/pmb/admin/registrations/${id}`);
  },
  auditPmbRegistration(id: number, data: { status: string; catatan_admin?: string; payment_status?: string; payment_amount?: number; payment_notes?: string; send_wa?: boolean }) {
    return request<ApiRecord>(`/pmb/admin/registrations/${id}/audit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updatePmbPayment(id: number, data: { payment_status: string; payment_amount?: number; payment_notes?: string; send_wa?: boolean }) {
    return request<ApiRecord>(`/pmb/admin/registrations/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  resendPmbWa(id: number) {
    return request<ApiRecord>(`/pmb/admin/registrations/${id}/resend-wa`, {
      method: 'POST',
    });
  },
  convertPmbToSiswa(id: number, data: { nis?: string; class_id?: number; boarding_room_id?: number; create_wali_user?: boolean; catatan_admin?: string }) {
    return request<ApiRecord>(`/pmb/admin/registrations/${id}/convert-to-siswa`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  togglePmbStatus(data: { is_open?: boolean; closed_message?: string }) {
    return request<ApiRecord>('/pmb/admin/toggle-status', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  togglePmbPengurusVisibility(visible?: boolean) {
    return request<{ status: string; pmb_visible_to_pengurus: boolean; message: string }>('/pmb/admin/toggle-pengurus-visibility', {
      method: 'POST',
      body: JSON.stringify(typeof visible === 'boolean' ? { visible } : {}),
    });
  },
  getPmbCmsSettingsAdmin() {
    return request<ApiRecord[]>('/pmb/admin/cms-settings');
  },
  updatePmbCmsSettings(settings: Array<{ key: string; value: any; group?: string; label?: string; type?: string }>) {
    return request<ApiRecord>('/pmb/admin/cms-settings', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    });
  },
  getPmbAnnouncementsAdmin(params?: { category?: string; search?: string }) {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<ApiRecord[]>(`/pmb/admin/announcements${q}`);
  },
  storePmbAnnouncement(data: { title: string; content: string; category: string; event_date?: string; is_pinned?: boolean; is_published?: boolean }) {
    return request<ApiRecord>('/pmb/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updatePmbAnnouncement(id: number, data: { title: string; content: string; category: string; event_date?: string; is_pinned?: boolean; is_published?: boolean }) {
    return request<ApiRecord>(`/pmb/admin/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deletePmbAnnouncement(id: number) {
    return request<ApiRecord>(`/pmb/admin/announcements/${id}`, {
      method: 'DELETE',
    });
  }
};
