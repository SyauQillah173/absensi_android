import * as XLSX from 'xlsx';
import type { ApiRecord } from '../services/api';

export type ImportTemplateType = 'siswa' | 'guru' | 'user-admin' | 'user-wali' | 'user';

interface TemplateConfig {
  fileName: string;
  title: string;
  hint: string;
  headers: string[];
  mandatoryHeaders: Set<string>;
  sampleRows: string[][];
}

const passwordHint = 'IsiPasswordAwal!2026';

const userHeaders = ['name', 'email', 'phone', 'role', 'password', 'status'];
const guruHeaders = ['unit_sekolah', 'name', 'kode_guru', 'phone', 'email', 'jenis_kelamin', 'alamat', 'status', 'status_sebagai', 'password'];
const siswaHeaders = [
  'nis',
  'nisn',
  'nama_lengkap_siswa',
  'jenis_kelamin',
  'nama_wali',
  'status_siswa',
  'kelompok_belajar',
  'tempat_lahir',
  'tanggal_lahir',
  'alamat_lengkap',
  'kewarganegaraan',
  'provinsi',
  'kota',
  'kecamatan',
  'kelurahan',
  'kode_pos',
  'no_hp_whatsapp',
  'email',
  'nama_ayah',
  'nama_ibu',
  'asal_sekolah',
  'tahun_akademik_masuk',
  'jenis_santri',
  'tanggal_masuk',
  'catatan_lain'
];

function configFor(type: ImportTemplateType): TemplateConfig {
  if (type === 'siswa') {
    return {
      fileName: 'template_import_siswa.xlsx',
      title: 'TEMPLATE IMPORT DATA SISWA',
      hint: 'PETUNJUK: Jangan ubah nama header. Isi data siswa sesuai format Buku Induk Android.',
      headers: siswaHeaders,
      mandatoryHeaders: new Set(['nis', 'nama_lengkap_siswa', 'jenis_kelamin', 'nama_wali', 'status_siswa', 'kelompok_belajar']),
      sampleRows: [
        [
          'RT2026001',
          '0067010001',
          'Ahmad Zaki Maulana',
          'L',
          'Wali Ahmad Fauzan',
          'Aktif',
          'Sifir Awal A PA',
          'Gresik',
          '2015-01-12',
          'Bungah, Gresik',
          'Indonesia',
          'Jawa Timur',
          'Gresik',
          'Bungah',
          'Bungah',
          '61152',
          '081234567890',
          'zaki@example.com',
          'Ahmad Fauzan',
          'Siti Aminah',
          'MI Assa\'adah',
          '2025/2026',
          'mondok',
          '2025-07-01',
          ''
        ]
      ]
    };
  }

  if (type === 'guru') {
    return {
      fileName: 'template_import_guru.xlsx',
      title: 'TEMPLATE IMPORT DATA GURU',
      hint: 'PETUNJUK: unit_sekolah dan status_sebagai bisa lebih dari satu, pisahkan dengan tanda |.',
      headers: guruHeaders,
      mandatoryHeaders: new Set(['name', 'kode_guru', 'phone', 'email', 'status', 'password']),
      sampleRows: [["MTs Assa'adah 1|Aliyah Assa'adah", 'Ust. Contoh Guru', 'GRU099', '081234567890', 'gurucontoh@absensi.com', 'L', 'Bungah, Gresik', 'Aktif', 'guru|sertifikasi', passwordHint]]
    };
  }

  if (type === 'user-admin') {
    return {
      fileName: 'template_import_login_admin.xlsx',
      title: 'TEMPLATE IMPORT LOGIN ADMIN',
      hint: 'PETUNJUK: Kolom role boleh dikosongi, web akan mengunci sebagai admin saat import.',
      headers: userHeaders,
      mandatoryHeaders: new Set(['name', 'email', 'phone', 'role', 'password', 'status']),
      sampleRows: [['Admin Baru', 'adminbaru@absensi.com', '081234567890', 'admin', passwordHint, 'Aktif']]
    };
  }

  if (type === 'user-wali') {
    return {
      fileName: 'template_import_login_wali.xlsx',
      title: 'TEMPLATE IMPORT LOGIN WALI',
      hint: 'PETUNJUK: Kolom role boleh dikosongi, web akan mengunci sebagai wali saat import.',
      headers: userHeaders,
      mandatoryHeaders: new Set(['name', 'email', 'phone', 'role', 'password', 'status']),
      sampleRows: [['Wali Baru', 'walibaru@absensi.com', '081277788899', 'wali', passwordHint, 'Aktif']]
    };
  }

  return {
    fileName: 'template_import_user.xlsx',
    title: 'TEMPLATE IMPORT USER / AKUN APLIKASI',
    hint: 'PETUNJUK: role isi admin, guru, atau wali. status isi Aktif atau Nonaktif.',
    headers: userHeaders,
    mandatoryHeaders: new Set(['name', 'email', 'phone', 'role', 'password', 'status']),
    sampleRows: [
      ['Admin Baru', 'adminbaru@absensi.com', '081234567890', 'admin', passwordHint, 'Aktif'],
      ['Wali Baru', 'walibaru@absensi.com', '081277788899', 'wali', passwordHint, 'Aktif']
    ]
  };
}

export function downloadImportTemplate(type: ImportTemplateType) {
  const config = configFor(type);
  const aoa = [
    [config.title],
    [config.hint],
    [],
    config.headers.map((header) => (config.mandatoryHeaders.has(header) ? `${header} *` : header)),
    ...config.sampleRows
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = config.headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  XLSX.writeFile(workbook, config.fileName);
}

export async function parseImportFile(file: File, type: ImportTemplateType, forcedRole?: 'admin' | 'guru' | 'wali'): Promise<ApiRecord[]> {
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: 'array' });
  const expectedHeaders = expectedHeadersFor(type);
  let selectedRows: unknown[][] = [];
  let headerRowIndex = -1;

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const candidate = findHeaderRowIndex(rows, expectedHeaders);
    if (candidate >= 0) {
      selectedRows = rows;
      headerRowIndex = candidate;
      break;
    }
  }

  if (headerRowIndex < 0) {
    throw new Error('Header template tidak ditemukan. Pastikan memakai template terbaru.');
  }

  const headerMap = new Map<number, string>();
  const headerRow = selectedRows[headerRowIndex] ?? [];
  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(String(cell ?? ''));
    if (header) headerMap.set(index, header);
  });

  const parsed: ApiRecord[] = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < selectedRows.length; rowIndex += 1) {
    const row = selectedRows[rowIndex] ?? [];
    const data: ApiRecord = {};
    row.forEach((cell, colIndex) => {
      const header = headerMap.get(colIndex);
      if (header) data[header] = String(cell ?? '').trim();
    });
    if (Object.values(data).every((value) => String(value ?? '').trim() === '')) continue;
    parsed.push(normalizeRow(data, type, forcedRole));
  }

  return parsed;
}

export function exportRowsExcel(rows: ApiRecord[], fileName: string, title: string) {
  const keys = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row).forEach((key) => acc.add(key));
      return acc;
    }, new Set<string>())
  );
  const aoa = [[title], [`Dicetak: ${new Date().toLocaleString('id-ID')}`], [], keys, ...rows.map((row) => keys.map((key) => row[key] ?? ''))];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = keys.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, fileName);
}

function expectedHeadersFor(type: ImportTemplateType): Set<string> {
  if (type === 'siswa') return new Set(siswaHeaders.map(normalizeHeader));
  if (type === 'guru') return new Set(guruHeaders.map(normalizeHeader));
  return new Set(userHeaders.map(normalizeHeader));
}

function findHeaderRowIndex(rows: unknown[][], expectedHeaders: Set<string>): number {
  for (let rowIndex = 0; rowIndex < rows.length && rowIndex < 12; rowIndex += 1) {
    const normalized = new Set((rows[rowIndex] ?? []).map((cell) => normalizeHeader(String(cell ?? ''))).filter(Boolean));
    let matches = 0;
    expectedHeaders.forEach((header) => {
      if (normalized.has(header)) matches += 1;
    });
    if (matches >= 3) return rowIndex;
  }
  return -1;
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeRow(data: ApiRecord, type: ImportTemplateType, forcedRole?: 'admin' | 'guru' | 'wali'): ApiRecord {
  if (type === 'siswa') {
    return {
      nis: data.nis ?? '',
      nisn: data.nisn ?? '',
      nama: data.nama_lengkap_siswa ?? data.nama ?? '',
      jenis_kelamin: normalizeGender(data.jenis_kelamin),
      nama_wali: data.nama_wali ?? data.nama_wali_orang_tua ?? data.nama_wali_keluarga ?? '',
      status: normalizeStatus(data.status_siswa ?? data.status),
      kelas: data.kelompok_belajar ?? data.kelas_sifir ?? data.kelas ?? data.sifir ?? '',
      tempat_lahir: data.tempat_lahir ?? '',
      tanggal_lahir: data.tanggal_lahir ?? '',
      alamat: data.alamat_lengkap ?? data.alamat ?? '',
      kewarganegaraan: data.kewarganegaraan ?? 'Indonesia',
      provinsi: data.provinsi ?? '',
      kota: data.kota ?? '',
      kecamatan: data.kecamatan ?? '',
      kelurahan: data.kelurahan ?? '',
      kode_pos: data.kode_pos ?? '',
      no_whatsapp: data.no_hp_whatsapp ?? data.no_whatsapp ?? '',
      no_telepon_wali: data.no_telepon_wali ?? data.no_hp_whatsapp ?? data.no_whatsapp ?? '',
      email_siswa: data.email ?? data.email_siswa ?? '',
      nama_ayah: data.nama_ayah ?? '',
      nama_ibu: data.nama_ibu ?? '',
      asal_sekolah: data.asal_sekolah ?? '',
      tahun_akademik_masuk: data.tahun_akademik_masuk ?? '',
      jenis_santri: data.jenis_santri ?? '',
      tanggal_masuk: data.tanggal_masuk ?? '',
      catatan_santri: data.catatan_lain ?? data.catatan_santri ?? ''
    };
  }

  if (type === 'guru') {
    return {
      name: data.name ?? '',
      email: data.email ?? '',
      no_hp: data.phone ?? data.no_hp ?? '',
      role: 'guru',
      password: data.password ?? '',
      status: normalizeStatus(data.status),
      kode_guru: data.kode_guru ?? '',
      jenis_kelamin: normalizeGender(data.jenis_kelamin),
      alamat: data.alamat ?? '',
      unit_kerja: splitList(data.unit_sekolah ?? data.unit_kerja),
      kategori_guru: splitList(data.status_sebagai ?? data.kategori_guru)
    };
  }

  return {
    name: data.name ?? '',
    email: data.email ?? '',
    no_hp: data.phone ?? data.no_hp ?? '',
    role: forcedRole ?? String(data.role ?? '').toLowerCase(),
    password: data.password ?? '',
    status: normalizeStatus(data.status)
  };
}

function normalizeStatus(value: unknown): string {
  const clean = String(value ?? '').trim().toLowerCase();
  if (clean === 'nonaktif' || clean === 'non aktif' || clean === 'inactive') return 'Nonaktif';
  if (clean === 'lulus') return 'Lulus';
  return 'Aktif';
}

function normalizeGender(value: unknown): string {
  const clean = String(value ?? '').trim().toLowerCase();
  if (['p', 'perempuan', 'female'].includes(clean)) return 'P';
  return 'L';
}

function splitList(value: unknown): string[] {
  return String(value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}
