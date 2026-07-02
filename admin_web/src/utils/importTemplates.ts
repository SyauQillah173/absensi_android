import * as XLSX from 'xlsx-js-style';
import { api, type ApiRecord } from '../services/api';

export type ImportTemplateType = 'siswa' | 'guru' | 'user-admin' | 'user-wali' | 'user';

interface TemplateConfig {
  fileName: string;
  title: string;
  hint: string;
  headers: string[];
  mandatoryHeaders: Set<string>;
  sampleRows: string[][];
  checks?: TemplateCheck[];
}

interface TemplateCheck {
  label: string;
  sourceHeader: string;
  masterColumn?: number;
  required?: boolean;
  message?: string;
}

interface MasterColumn {
  title: string;
  values: string[];
}

interface TemplateMasterData {
  classes: string[];
  schoolOrigins: string[];
  studentTypes: string[];
  provinces: string[];
  cities: string[];
  districts: string[];
  villages: string[];
}

const passwordHint = 'IsiPasswordAwal!2026';
const maxTemplateRows = 250;

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

const fallbackMasterData: TemplateMasterData = {
  classes: ['Sifir Awal A PA', 'Sifir Awal B PI', 'Sifir Tsani A PA', 'Sifir Tsani B PI'],
  schoolOrigins: ["MI Assa'adah", 'MI Qomaruddin', "MTs Assa'adah 1", "SMP Assa'adah"],
  studentTypes: ['Santri Madin', 'Santri Pondok', 'Keduanya'],
  provinces: ['Jawa Timur', 'Jawa Tengah', 'Jawa Barat', 'DKI Jakarta'],
  cities: ['Kabupaten Gresik', 'Kota Surabaya', 'Kabupaten Lamongan', 'Kabupaten Sidoarjo'],
  districts: ['Bungah', 'Manyar', 'Sidayu', 'Dukun', 'Ujung Pangkah'],
  villages: ['Bungah', 'Sukorejo', 'Indrodelik', 'Pegundan', 'Abar-abir']
};

const styles = {
  title: {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: '138F81' } }
  },
  hint: {
    font: { bold: true, sz: 11, color: { rgb: '0D6F65' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: 'E8F7F3' } }
  },
  note: {
    font: { sz: 10, color: { rgb: '8A5A00' } },
    alignment: { vertical: 'top', wrapText: true },
    fill: { fgColor: { rgb: 'FFF3D6' } }
  },
  mandatoryHeader: {
    font: { bold: true, color: { rgb: '0D6F65' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: 'D8F3EE' } },
    border: thinBorder('9DD8D0')
  },
  optionalHeader: {
    font: { bold: true, color: { rgb: '2E5AAC' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: 'EAF1FF' } },
    border: thinBorder('B7C9EA')
  },
  checkHeader: {
    font: { bold: true, color: { rgb: '8A5A00' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: 'FFE7B8' } },
    border: thinBorder('E6B95F')
  },
  sample: {
    alignment: { vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: 'F8FBFF' } },
    border: thinBorder('E2E8F0')
  },
  masterHeader: {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: '2D3436' } },
    border: thinBorder('2D3436')
  },
  masterCell: {
    alignment: { vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: 'F7FAFC' } },
    border: thinBorder('E2E8F0')
  },
  ok: {
    font: { bold: true, color: { rgb: '138F81' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'E8F7F3' } },
    border: thinBorder('9DD8D0')
  }
} satisfies Record<string, XLSX.CellStyle>;

function thinBorder(rgb: string): XLSX.CellStyle['border'] {
  return {
    top: { style: 'thin', color: { rgb } },
    bottom: { style: 'thin', color: { rgb } },
    left: { style: 'thin', color: { rgb } },
    right: { style: 'thin', color: { rgb } }
  };
}

function configFor(type: ImportTemplateType, master: TemplateMasterData): TemplateConfig {
  if (type === 'siswa') {
    return {
      fileName: 'template_import_siswa.xlsx',
      title: 'TEMPLATE IMPORT DATA SISWA',
      hint: 'PETUNJUK: Jangan ubah nama header. Isi wilayah dan master sesuai sheet Master agar tidak typo.',
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
          master.classes[0] ?? 'Sifir Awal A PA',
          'Gresik',
          '2015-01-12',
          'Bungah, Gresik',
          'Indonesia',
          master.provinces.find((item) => item.toLowerCase() === 'jawa timur') ?? master.provinces[0] ?? 'Jawa Timur',
          master.cities.find((item) => item.toLowerCase().includes('gresik')) ?? master.cities[0] ?? 'Kabupaten Gresik',
          master.districts.find((item) => item.toLowerCase() === 'bungah') ?? master.districts[0] ?? 'Bungah',
          master.villages.find((item) => item.toLowerCase() === 'bungah') ?? master.villages[0] ?? 'Bungah',
          '61152',
          '081234567890',
          'zaki@example.com',
          'Ahmad Fauzan',
          'Siti Aminah',
          master.schoolOrigins[0] ?? "MI Assa'adah",
          '2025/2026',
          master.studentTypes[0] ?? 'Santri Madin',
          '2025-07-01',
          ''
        ]
      ],
      checks: [
        { label: 'cek_jk', sourceHeader: 'jenis_kelamin', masterColumn: 0, required: true },
        { label: 'cek_status', sourceHeader: 'status_siswa', masterColumn: 1, required: true },
        { label: 'cek_kelas', sourceHeader: 'kelompok_belajar', masterColumn: 2, required: true },
        { label: 'cek_kewarganegaraan', sourceHeader: 'kewarganegaraan', masterColumn: 3, required: false },
        { label: 'cek_provinsi', sourceHeader: 'provinsi', masterColumn: 4, required: false },
        { label: 'cek_kota', sourceHeader: 'kota', masterColumn: 5, required: false },
        { label: 'cek_kecamatan', sourceHeader: 'kecamatan', masterColumn: 6, required: false, message: 'CEK MASTER' },
        { label: 'cek_kelurahan', sourceHeader: 'kelurahan', masterColumn: 7, required: false, message: 'CEK MASTER' },
        { label: 'cek_asal_sekolah', sourceHeader: 'asal_sekolah', masterColumn: 8, required: false },
        { label: 'cek_jenis_santri', sourceHeader: 'jenis_santri', masterColumn: 9, required: false },
        { label: 'cek_tgl_lahir', sourceHeader: 'tanggal_lahir', required: false, message: 'YYYY-MM-DD' },
        { label: 'cek_tgl_masuk', sourceHeader: 'tanggal_masuk', required: false, message: 'YYYY-MM-DD' }
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
      sampleRows: [["MTs Assa'adah 1|Aliyah Assa'adah", 'Ust. Contoh Guru', 'GRU099', '081234567890', 'gurucontoh@absensi.com', 'L', 'Bungah, Gresik', 'Aktif', 'guru|sertifikasi', passwordHint]],
      checks: [
        { label: 'cek_jk', sourceHeader: 'jenis_kelamin', masterColumn: 0, required: false },
        { label: 'cek_status', sourceHeader: 'status', masterColumn: 1, required: true }
      ]
    };
  }

  if (type === 'user-admin') {
    return {
      fileName: 'template_import_login_admin.xlsx',
      title: 'TEMPLATE IMPORT LOGIN ADMIN',
      hint: 'PETUNJUK: Kolom role boleh dikosongi, web akan mengunci sebagai admin saat import.',
      headers: userHeaders,
      mandatoryHeaders: new Set(['name', 'email', 'phone', 'role', 'password', 'status']),
      sampleRows: [['Admin Baru', 'adminbaru@absensi.com', '081234567890', 'admin', passwordHint, 'Aktif']],
      checks: userChecks()
    };
  }

  if (type === 'user-wali') {
    return {
      fileName: 'template_import_login_wali.xlsx',
      title: 'TEMPLATE IMPORT LOGIN WALI',
      hint: 'PETUNJUK: Kolom role boleh dikosongi, web akan mengunci sebagai wali saat import.',
      headers: userHeaders,
      mandatoryHeaders: new Set(['name', 'email', 'phone', 'role', 'password', 'status']),
      sampleRows: [['Wali Baru', 'walibaru@absensi.com', '081277788899', 'wali', passwordHint, 'Aktif']],
      checks: userChecks()
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
    ],
    checks: userChecks()
  };
}

function userChecks(): TemplateCheck[] {
  return [
    { label: 'cek_role', sourceHeader: 'role', masterColumn: 10, required: true },
    { label: 'cek_status', sourceHeader: 'status', masterColumn: 1, required: true }
  ];
}

export async function downloadImportTemplate(type: ImportTemplateType) {
  const master = type === 'siswa' ? await loadTemplateMasterData() : fallbackMasterData;
  const config = configFor(type, master);
  const workbook = XLSX.utils.book_new();
  const worksheet = buildTemplateSheet(config, master);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  XLSX.utils.book_append_sheet(workbook, buildMasterSheet(type, master), 'Master');
  XLSX.utils.book_append_sheet(workbook, buildGuideSheet(type), 'Petunjuk');
  XLSX.writeFile(workbook, config.fileName, { bookType: 'xlsx', cellStyles: true });
}

function buildTemplateSheet(config: TemplateConfig, master: TemplateMasterData): XLSX.WorkSheet {
  const checkLabels = config.checks?.map((check) => check.label) ?? [];
  const headers = [...config.headers, ...checkLabels];
  const headerLabels = [
    ...config.headers.map((header) => (config.mandatoryHeaders.has(header) ? `${header} *` : header)),
    ...checkLabels
  ];
  const note = [
    'Catatan:',
    '1. Kolom bertanda * wajib diisi.',
    '2. Isi kolom master persis seperti sheet Master.',
    '3. Kolom cek_* berisi rumus bantu. Jika muncul CEK, periksa lagi sebelum import.',
    '4. Backend tetap memvalidasi data terhadap master database saat import.'
  ].join(' ');

  const aoa: unknown[][] = [
    [config.title],
    [config.hint],
    [note],
    headerLabels,
    ...config.sampleRows.map((row, index) => [...row, ...buildCheckFormulas(config, headers, 5 + index)])
  ];

  for (let row = 6; row <= maxTemplateRows; row += 1) {
    aoa.push([...config.headers.map(() => ''), ...buildCheckFormulas(config, headers, row)]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const lastColumn = colName(headers.length - 1);
  worksheet['!merges'] = [
    XLSX.utils.decode_range(`A1:${lastColumn}1`),
    XLSX.utils.decode_range(`A2:${lastColumn}2`),
    XLSX.utils.decode_range(`A3:${lastColumn}3`)
  ];
  worksheet['!cols'] = headers.map((header) => ({ wch: columnWidth(header, master) }));
  worksheet['!freeze'] = { xSplit: 0, ySplit: 4 };
  worksheet['!autofilter'] = { ref: `A4:${lastColumn}${maxTemplateRows}` };

  styleCell(worksheet, 'A1', styles.title);
  styleCell(worksheet, 'A2', styles.hint);
  styleCell(worksheet, 'A3', styles.note);

  headers.forEach((header, index) => {
    const address = `${colName(index)}4`;
    const style = index >= config.headers.length
      ? styles.checkHeader
      : config.mandatoryHeaders.has(header)
        ? styles.mandatoryHeader
        : styles.optionalHeader;
    styleCell(worksheet, address, style);
  });

  for (let row = 5; row <= maxTemplateRows; row += 1) {
    headers.forEach((_, index) => {
      styleCell(worksheet, `${colName(index)}${row}`, index >= config.headers.length ? styles.ok : styles.sample);
    });
  }

  applyDateFormats(worksheet, config.headers, ['tanggal_lahir', 'tanggal_masuk']);
  return worksheet;
}

function buildCheckFormulas(config: TemplateConfig, headers: string[], rowNumber: number): unknown[] {
  return (config.checks ?? []).map((check) => {
    const sourceIndex = headers.indexOf(check.sourceHeader);
    if (sourceIndex < 0) return '';
    const sourceCell = `${colName(sourceIndex)}${rowNumber}`;
    if (check.sourceHeader.includes('tanggal')) {
      return {
        f: `IF(${sourceCell}="","",IF(ISNUMBER(DATEVALUE(TEXT(${sourceCell},"yyyy-mm-dd"))),"OK","${check.message ?? 'CEK'}"))`,
        v: ''
      };
    }
    if (check.masterColumn === undefined) {
      return '';
    }
    const masterCol = colName(check.masterColumn);
    const emptyResult = check.required ? 'WAJIB' : '';
    const invalidResult = check.message ?? 'CEK';
    return {
      f: `IF(${sourceCell}="","${emptyResult}",IF(COUNTIF(Master!$${masterCol}$2:$${masterCol}$1000,${sourceCell})>0,"OK","${invalidResult}"))`,
      v: ''
    };
  });
}

function buildMasterSheet(type: ImportTemplateType, master: TemplateMasterData): XLSX.WorkSheet {
  const columns: MasterColumn[] = [
    { title: 'jenis_kelamin', values: ['L', 'P'] },
    { title: 'status', values: ['Aktif', 'Nonaktif', 'Lulus'] },
    { title: 'kelompok_belajar', values: master.classes },
    { title: 'kewarganegaraan', values: ['Indonesia', 'WNA'] },
    { title: 'provinsi', values: master.provinces },
    { title: 'kota', values: master.cities },
    { title: 'kecamatan_contoh', values: master.districts },
    { title: 'kelurahan_contoh', values: master.villages },
    { title: 'asal_sekolah', values: master.schoolOrigins },
    { title: 'jenis_santri', values: master.studentTypes },
    { title: 'role', values: ['admin', 'guru', 'wali'] },
    { title: 'status_user', values: ['Aktif', 'Nonaktif'] }
  ];
  const maxRows = Math.max(...columns.map((column) => column.values.length), 1);
  const aoa = [
    columns.map((column) => column.title),
    ...Array.from({ length: maxRows }, (_, rowIndex) => columns.map((column) => column.values[rowIndex] ?? ''))
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = columns.map(() => ({ wch: type === 'siswa' ? 26 : 18 }));
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  columns.forEach((_, index) => styleCell(worksheet, `${colName(index)}1`, styles.masterHeader));
  for (let row = 2; row <= maxRows + 1; row += 1) {
    columns.forEach((_, index) => styleCell(worksheet, `${colName(index)}${row}`, styles.masterCell));
  }
  return worksheet;
}

function buildGuideSheet(type: ImportTemplateType): XLSX.WorkSheet {
  const rows = [
    ['PANDUAN IMPORT'],
    ['Gunakan sheet Template untuk mengisi data. Sheet Master hanya rujukan pilihan resmi.'],
    ['Jangan mengubah nama header karena parser mencari header tersebut.'],
    ['Kolom cek_* boleh dibiarkan. Rumusnya membantu menemukan typo sebelum upload.'],
    ['tanggal_lahir dan tanggal_masuk gunakan format YYYY-MM-DD, contoh 2015-01-12.'],
    ['Untuk wilayah, gunakan nama resmi dari master database. Jika kecamatan/kelurahan tidak ada di contoh, pastikan ejaannya sama dengan master backend.'],
    ['Saat import, backend tetap memvalidasi relasi ID master dan akan menampilkan error/warning jika tidak cocok.'],
    type === 'siswa'
      ? ['Khusus siswa: provinsi, kota, kecamatan, kelurahan, asal_sekolah, jenis_santri, dan kelompok_belajar harus mengikuti master.']
      : ['Khusus user/guru: role, status, dan jenis_kelamin harus mengikuti pilihan master.']
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 120 }];
  styleCell(worksheet, 'A1', styles.title);
  for (let row = 2; row <= rows.length; row += 1) {
    styleCell(worksheet, `A${row}`, styles.note);
  }
  return worksheet;
}

async function loadTemplateMasterData(): Promise<TemplateMasterData> {
  const [classes, schoolOrigins, studentTypes, provinces, cities, gresikCities] = await Promise.allSettled([
    api.classes(),
    api.schoolOrigins({ active: 1, limit: 1000 }),
    api.references('student_types'),
    api.regionProvinces(),
    api.regionCities({ limit: 1000 }),
    api.regionCities({ q: 'Gresik', limit: 20 })
  ]);

  const gresikCity = fulfilledData(gresikCities).find((item) => text(item.name).toLowerCase().includes('gresik'));
  const [districts, bungahVillages] = await Promise.allSettled([
    gresikCity?.id ? api.regionDistricts({ city_id: Number(gresikCity.id), limit: 1000 }) : Promise.resolve({ success: true, data: [] }),
    api.regionVillages({ district_code: '35.25.01', limit: 1000 })
  ]);

  return {
    classes: unique([...names(fulfilledData(classes)), ...fallbackMasterData.classes]),
    schoolOrigins: unique([...names(fulfilledData(schoolOrigins)), ...fallbackMasterData.schoolOrigins]),
    studentTypes: unique([...names(fulfilledData(studentTypes)), ...fallbackMasterData.studentTypes]),
    provinces: unique([...names(fulfilledData(provinces)), ...fallbackMasterData.provinces]),
    cities: unique([...names(fulfilledData(cities)), ...fallbackMasterData.cities]),
    districts: unique([...names(fulfilledData(districts)), ...fallbackMasterData.districts]),
    villages: unique([...names(fulfilledData(bungahVillages)), ...fallbackMasterData.villages])
  };
}

function fulfilledData(result: PromiseSettledResult<unknown>): ApiRecord[] {
  if (result.status !== 'fulfilled') return [];
  const value = result.value as ApiRecord;
  return Array.isArray(value.data) ? value.data as ApiRecord[] : [];
}

function names(rows: ApiRecord[]): string[] {
  return rows.map((row) => text(row.name)).filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function styleCell(worksheet: XLSX.WorkSheet, address: string, style: XLSX.CellStyle) {
  const cell = worksheet[address] as XLSX.CellObject | undefined;
  if (cell) cell.s = style;
}

function applyDateFormats(worksheet: XLSX.WorkSheet, headers: string[], dateHeaders: string[]) {
  dateHeaders.forEach((header) => {
    const index = headers.indexOf(header);
    if (index < 0) return;
    for (let row = 5; row <= maxTemplateRows; row += 1) {
      const cell = worksheet[`${colName(index)}${row}`] as XLSX.CellObject | undefined;
      if (cell) cell.z = 'yyyy-mm-dd';
    }
  });
}

function columnWidth(header: string, master: TemplateMasterData): number {
  if (header.includes('nama_lengkap')) return 28;
  if (header.includes('alamat') || header.includes('catatan')) return 32;
  if (header.includes('tanggal') || header.includes('tempat_lahir')) return 18;
  if (header.includes('kelompok') || header.includes('asal_sekolah')) return Math.max(22, Math.min(34, longest(master.classes) + 2));
  if (header.includes('cek_')) return 16;
  return 20;
}

function longest(values: string[]): number {
  return values.reduce((max, value) => Math.max(max, value.length), 0);
}

function colName(index: number): string {
  let dividend = index + 1;
  let name = '';
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return name;
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
    if (header && !header.startsWith('cek_')) headerMap.set(index, header);
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
  worksheet['!freeze'] = { xSplit: 0, ySplit: 4 };
  worksheet['!autofilter'] = { ref: `A4:${colName(Math.max(keys.length - 1, 0))}${rows.length + 4}` };
  if (keys.length > 0) {
    worksheet['!merges'] = [
      XLSX.utils.decode_range(`A1:${colName(keys.length - 1)}1`),
      XLSX.utils.decode_range(`A2:${colName(keys.length - 1)}2`)
    ];
  }
  styleCell(worksheet, 'A1', styles.title);
  styleCell(worksheet, 'A2', styles.hint);
  keys.forEach((_, index) => styleCell(worksheet, `${colName(index)}4`, styles.masterHeader));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });
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
  if (['l', 'laki-laki', 'laki laki', 'male'].includes(clean)) return 'L';
  return '';
}

function splitList(value: unknown): string[] {
  return String(value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}
