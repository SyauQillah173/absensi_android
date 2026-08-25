import * as XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
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

interface RegionMasterRow {
  province: string;
  city: string;
  district: string;
  village: string;
  postalCode: string;
  key: string;
}

interface TemplateMasterData {
  classes: string[];
  schoolOrigins: string[];
  studentTypes: string[];
  provinces: string[];
  cities: string[];
  districts: string[];
  villages: string[];
  postalCodes: string[];
  regionRows: RegionMasterRow[];
}

const passwordHint = 'IsiPasswordAwal!2026';
const maxTemplateRows = 250;
const masterValidationRows = 100000;

const userHeaders = ['name', 'email', 'phone', 'role', 'password', 'status'];
const guruHeaders = ['unit_sekolah', 'name', 'kode_guru', 'phone', 'email', 'jenis_kelamin', 'alamat', 'status', 'status_sebagai', 'password'];
const siswaHeaders = [
  'nis',
  'nisn',
  'nama_lengkap_siswa',
  'nama_lengkap_santri',
  'nama_santri',
  'nama',
  'jenis_kelamin',
  'jk',
  'l_p',
  'nik',
  'no_kk',
  'nama_wali',
  'status_siswa',
  'status_santri',
  'status',
  'kelompok_belajar',
  'kelas_sifir',
  'kelas',
  'sifir',
  'tempat_lahir',
  'tanggal_lahir',
  'alamat_lengkap',
  'alamat',
  'kewarganegaraan',
  'provinsi',
  'kota',
  'kabupaten',
  'kab_kota',
  'kabupaten_kota',
  'kecamatan',
  'kelurahan',
  'desa',
  'desa_kelurahan',
  'kode_pos',
  'no_hp_whatsapp',
  'no_whatsapp',
  'no_whatsapp_hp',
  'no_hp',
  'no_telp',
  'email',
  'email_siswa',
  'nama_ayah',
  'nik_ayah',
  'pekerjaan_ayah',
  'nama_ibu',
  'nik_ibu',
  'pekerjaan_ibu',
  'no_ayah',
  'no_ibu',
  'asal_sekolah',
  'tahun_lulus',
  'tahun_akademik_masuk',
  'jenis_santri',
  'tanggal_masuk',
  'status_mondok',
  'komplek',
  'kamar',
  'catatan',
  'catatan_lain',
  'catatan_santri'
];

const fallbackMasterData: TemplateMasterData = {
  classes: ['Sifir Awal A PA', 'Sifir Awal B PI', 'Sifir Tsani A PA', 'Sifir Tsani B PI'],
  schoolOrigins: ["MI Assa'adah", 'MI Qomaruddin', "MTs Assa'adah 1", "SMP Assa'adah"],
  studentTypes: ['Santri Madin', 'Santri Pondok', 'Keduanya'],
  provinces: ['Jawa Timur', 'Jawa Tengah', 'Jawa Barat', 'DKI Jakarta'],
  cities: ['Kabupaten Gresik', 'Kota Surabaya', 'Kabupaten Lamongan', 'Kabupaten Sidoarjo'],
  districts: ['Bungah', 'Manyar', 'Sidayu', 'Dukun', 'Ujung Pangkah'],
  villages: ['Bungah', 'Sukorejo', 'Indrodelik', 'Pegundan', 'Abar-abir'],
  postalCodes: ['61152', '61152', '61152', '61152', '61152'],
  regionRows: [
    {
      province: 'Jawa Timur',
      city: 'Kabupaten Gresik',
      district: 'Bungah',
      village: 'Bungah',
      postalCode: '61152',
      key: regionKey('Jawa Timur', 'Kabupaten Gresik', 'Bungah', 'Bungah')
    }
  ]
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
          master.cities.find((item) => item.toLowerCase().includes('gresik')) ?? master.cities[0] ?? 'Kabupaten Gresik',
          '2015-01-12',
          'Bungah, Gresik',
          'Indonesia',
          master.provinces.find((item) => item.toLowerCase() === 'jawa timur') ?? master.provinces[0] ?? 'Jawa Timur',
          master.cities.find((item) => item.toLowerCase().includes('gresik')) ?? master.cities[0] ?? 'Kabupaten Gresik',
          master.districts.find((item) => item.toLowerCase() === 'bungah') ?? master.districts[0] ?? 'Bungah',
          master.villages.find((item) => item.toLowerCase() === 'bungah') ?? master.villages[0] ?? 'Bungah',
          '',
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
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;
  const output = type === 'siswa' ? await addSiswaDropdownValidations(buffer) : buffer;
  downloadXlsx(output, config.fileName);
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
    '2. Kolom tempat/tanggal lahir, alamat, kewarganegaraan, provinsi, kota, kecamatan, dan kelurahan punya validasi/dropdown master.',
    '3. Dropdown bersifat bantuan. Jika data resmi belum ada di master, tetap boleh ketik manual lalu cek kembali sebelum import.',
    '4. Kolom cek_* berisi rumus bantu. Jika muncul CEK, periksa lagi sebelum import.',
    '5. Backend tetap memvalidasi data terhadap master database saat import.'
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
  applyTextFormats(worksheet, config.headers, ['kode_pos', 'nis', 'nisn', 'no_hp_whatsapp']);
  applyPostalCodeFormulas(worksheet, config.headers);
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
      f: `IF(${sourceCell}="","${emptyResult}",IF(COUNTIF(Master!$${masterCol}$2:$${masterCol}$${masterValidationRows},${sourceCell})>0,"OK","${invalidResult}"))`,
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
    { title: 'status_user', values: ['Aktif', 'Nonaktif'] },
    { title: 'kode_pos', values: master.postalCodes },
    { title: 'wilayah_key', values: master.regionRows.map((row) => row.key) },
    { title: 'wilayah_key_kode_pos', values: master.regionRows.map((row) => row.postalCode) }
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
    ['Pada template siswa, kolom tempat_lahir, tanggal_lahir, alamat_lengkap, kewarganegaraan, provinsi, kota, kecamatan, dan kelurahan diberi dropdown/validasi master.'],
    ['Dropdown bersifat warning, bukan stop. Jika pilihan belum ada di Master, user tetap boleh mengetik manual agar data baru tidak tertahan.'],
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
  const [classes, schoolOrigins, studentTypes, provinces, cities, gresikCities, allVillages] = await Promise.allSettled([
    api.classes(),
    api.schoolOrigins({ active: 1, limit: 1000 }),
    api.references('student_types'),
    api.regionProvinces(),
    api.regionCities({ limit: 1000 }),
    api.regionCities({ q: 'Gresik', limit: 20 }),
    api.regionVillages({ all: 1, flat: 1, limit: masterValidationRows })
  ]);

  const gresikCity = fulfilledData(gresikCities).find((item) => text(item.name).toLowerCase().includes('gresik'));
  const [districts, bungahVillages] = await Promise.allSettled([
    gresikCity?.id ? api.regionDistricts({ city_id: Number(gresikCity.id), limit: 1000 }) : Promise.resolve({ success: true, data: [] }),
    api.regionVillages({ district_code: '35.25.01', limit: 1000 })
  ]);

  const regionMasterRows = regionRows(fulfilledData(allVillages));
  const villageRows = regionMasterRows.length
    ? regionMasterRows.map((row) => ({ name: row.village, postal_code: row.postalCode }))
    : fulfilledData(bungahVillages);

  return {
    classes: unique([...names(fulfilledData(classes)), ...fallbackMasterData.classes]),
    schoolOrigins: unique([...names(fulfilledData(schoolOrigins)), ...fallbackMasterData.schoolOrigins]),
    studentTypes: unique([...names(fulfilledData(studentTypes)), ...fallbackMasterData.studentTypes]),
    provinces: unique([...regionMasterRows.map((row) => row.province), ...names(fulfilledData(provinces)), ...fallbackMasterData.provinces]),
    cities: unique([...regionMasterRows.map((row) => row.city), ...names(fulfilledData(cities)), ...fallbackMasterData.cities]),
    districts: unique([...regionMasterRows.map((row) => row.district), ...names(fulfilledData(districts)), ...fallbackMasterData.districts]),
    villages: unique([...names(villageRows), ...fallbackMasterData.villages]),
    postalCodes: unique([...postalCodes(villageRows), ...fallbackMasterData.postalCodes]),
    regionRows: regionMasterRows.length ? regionMasterRows : fallbackMasterData.regionRows
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

function postalCodes(rows: ApiRecord[]): string[] {
  return rows.map((row) => text(row.postal_code)).filter(Boolean);
}

function regionRows(rows: ApiRecord[]): RegionMasterRow[] {
  return rows.map((row) => {
    const province = text(row.province_name);
    const city = text(row.city_name);
    const district = text(row.district_name);
    const village = text(row.name);
    const postalCode = text(row.postal_code);
    return {
      province,
      city,
      district,
      village,
      postalCode,
      key: regionKey(province, city, district, village)
    };
  }).filter((row) => row.province && row.city && row.district && row.village);
}

function regionKey(province: string, city: string, district: string, village: string): string {
  return [province, city, district, village].map((value) => value.trim()).join('|');
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

async function addSiswaDropdownValidations(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const templateSheet = zip.file('xl/worksheets/sheet1.xml');
  if (!templateSheet) return buffer;

  const xml = await templateSheet.async('string');
  const patchedXml = insertWorksheetDataValidations(xml, siswaValidationXml(5, maxTemplateRows));
  zip.file('xl/worksheets/sheet1.xml', patchedXml);
  return zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

function siswaValidationXml(startRow: number, endRow: number): string {
  const listValidations = [
    {
      sqref: `D${startRow}:D${endRow}`,
      formula: `Master!$A$2:$A$${masterValidationRows}`,
      prompt: 'Pilih L atau P dari Master.'
    },
    {
      sqref: `H${startRow}:H${endRow}`,
      formula: `Master!$F$2:$F$${masterValidationRows}`,
      prompt: 'Pilih kota/kabupaten resmi untuk tempat lahir, atau ketik manual jika belum ada.'
    },
    {
      sqref: `K${startRow}:K${endRow}`,
      formula: `Master!$D$2:$D$${masterValidationRows}`,
      prompt: 'Pilih kewarganegaraan dari Master, atau ketik manual jika belum tersedia.'
    },
    {
      sqref: `L${startRow}:L${endRow}`,
      formula: `Master!$E$2:$E$${masterValidationRows}`,
      prompt: 'Pilih provinsi dari Master agar ejaan sama dengan database.'
    },
    {
      sqref: `M${startRow}:M${endRow}`,
      formula: `Master!$F$2:$F$${masterValidationRows}`,
      prompt: 'Pilih kota/kabupaten dari Master agar tidak typo.'
    },
    {
      sqref: `N${startRow}:N${endRow}`,
      formula: `Master!$G$2:$G$${masterValidationRows}`,
      prompt: 'Pilih kecamatan dari Master, atau ketik manual jika belum ada.'
    },
    {
      sqref: `O${startRow}:O${endRow}`,
      formula: `Master!$H$2:$H$${masterValidationRows}`,
      prompt: 'Pilih kelurahan/desa dari Master, atau ketik manual jika belum ada.'
    },
    {
      sqref: `P${startRow}:P${endRow}`,
      formula: `Master!$M$2:$M$${masterValidationRows}`,
      prompt: 'Kode pos otomatis dari kelurahan. Jika perlu, pilih dari Master atau ketik manual.'
    }
  ];
  const validations = [
    ...listValidations.map((item) => dataValidationTag({
      type: 'list',
      sqref: item.sqref,
      prompt: item.prompt,
      formula1: item.formula
    })),
    dataValidationTag({
      type: 'date',
      sqref: `I${startRow}:I${endRow}`,
      prompt: 'Isi tanggal_lahir format YYYY-MM-DD. Contoh: 2015-01-12.',
      formula1: 'DATE(1900,1,1)',
      formula2: 'DATE(2099,12,31)',
      operator: 'between'
    }),
    dataValidationTag({
      type: 'textLength',
      sqref: `J${startRow}:J${endRow}`,
      prompt: 'Isi alamat lengkap. Boleh ketik manual karena alamat tidak selalu ada di master.',
      formula1: '255',
      operator: 'lessThanOrEqual'
    })
  ];
  return `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`;
}

function dataValidationTag(options: {
  type: string;
  sqref: string;
  prompt: string;
  formula1: string;
  formula2?: string;
  operator?: string;
}): string {
  const operator = options.operator ? ` operator="${escapeXml(options.operator)}"` : '';
  const formula2 = options.formula2 ? `<formula2>${escapeXml(options.formula2)}</formula2>` : '';
  return [
    `<dataValidation type="${escapeXml(options.type)}"${operator} allowBlank="1" errorStyle="warning" showErrorMessage="1" showInputMessage="1"`,
    ` errorTitle="Di luar master" error="Nilai tidak ada di sheet Master. Boleh lanjut jika data memang baru, tapi cek ulang sebelum import."`,
    ` promptTitle="Bantuan input" prompt="${escapeXml(options.prompt)}" sqref="${escapeXml(options.sqref)}">`,
    `<formula1>${escapeXml(options.formula1)}</formula1>${formula2}</dataValidation>`
  ].join('');
}

function insertWorksheetDataValidations(xml: string, validationsXml: string): string {
  const cleanXml = xml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, '');
  const anchors = ['<ignoredErrors', '<hyperlinks', '<pageMargins', '<pageSetup', '<headerFooter', '<drawing', '<legacyDrawing', '<extLst', '</worksheet>'];
  const anchor = anchors.find((candidate) => cleanXml.includes(candidate));
  return anchor ? cleanXml.replace(anchor, `${validationsXml}${anchor}`) : cleanXml;
}

function downloadXlsx(data: ArrayBuffer, fileName: string) {
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function applyTextFormats(worksheet: XLSX.WorkSheet, headers: string[], textHeaders: string[]) {
  textHeaders.forEach((header) => {
    const index = headers.indexOf(header);
    if (index < 0) return;
    for (let row = 5; row <= maxTemplateRows; row += 1) {
      const cell = worksheet[`${colName(index)}${row}`] as XLSX.CellObject | undefined;
      if (cell) {
        cell.z = '@';
      }
    }
  });
}

function applyPostalCodeFormulas(worksheet: XLSX.WorkSheet, headers: string[]) {
  const villageIndex = headers.indexOf('kelurahan');
  const postalIndex = headers.indexOf('kode_pos');
  if (villageIndex < 0 || postalIndex < 0) return;
  const villageCol = colName(villageIndex);
  const postalCol = colName(postalIndex);
  const provinceIndex = headers.indexOf('provinsi');
  const cityIndex = headers.indexOf('kota');
  const districtIndex = headers.indexOf('kecamatan');
  const provinceCol = provinceIndex >= 0 ? colName(provinceIndex) : '';
  const cityCol = cityIndex >= 0 ? colName(cityIndex) : '';
  const districtCol = districtIndex >= 0 ? colName(districtIndex) : '';
  for (let row = 5; row <= maxTemplateRows; row += 1) {
    const cell = worksheet[`${postalCol}${row}`] as XLSX.CellObject | undefined;
    if (!cell) continue;
    const keyFormula = provinceCol && cityCol && districtCol
      ? `${provinceCol}${row}&"|"&${cityCol}${row}&"|"&${districtCol}${row}&"|"&${villageCol}${row}`
      : `${villageCol}${row}`;
    cell.f = `IF(${villageCol}${row}="","",IFERROR(INDEX(Master!$O$2:$O$${masterValidationRows},MATCH(${keyFormula},Master!$N$2:$N$${masterValidationRows},0)),IFERROR(INDEX(Master!$M$2:$M$${masterValidationRows},MATCH(${villageCol}${row},Master!$H$2:$H$${masterValidationRows},0)),"")))`;
    cell.v = '';
    cell.z = '@';
  }
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
  if (rows.length === 0) return;

  const isSiswa = rows[0] && ('nis' in rows[0] || 'jenis_kelamin' in rows[0] || 'nama_wali' in rows[0]);

  let exportCols: { key: string; label: string; width: number }[] = [];

  if (isSiswa) {
    exportCols = [
      { key: 'nis', label: 'NIS', width: 14 },
      { key: 'nama', label: 'Nama Lengkap Santri', width: 28 },
      { key: 'jenis_kelamin', label: 'L/P', width: 8 },
      { key: 'kelas', label: 'Kelas/Sifir', width: 18 },
      { key: 'status', label: 'Status Santri', width: 14 },
      { key: 'nik', label: 'NIK', width: 20 },
      { key: 'no_kk', label: 'No. KK', width: 20 },
      { key: 'tempat_lahir', label: 'Tempat Lahir', width: 18 },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir', width: 16 },
      { key: 'alamat', label: 'Alamat', width: 30 },
      { key: 'kelurahan', label: 'Desa/Kelurahan', width: 18 },
      { key: 'kecamatan', label: 'Kecamatan', width: 18 },
      { key: 'kota', label: 'Kabupaten/Kota', width: 20 },
      { key: 'provinsi', label: 'Provinsi', width: 18 },
      { key: 'kode_pos', label: 'Kode Pos', width: 12 },
      { key: 'nama_ayah', label: 'Nama Ayah', width: 22 },
      { key: 'nik_ayah', label: 'NIK Ayah', width: 20 },
      { key: 'pekerjaan_ayah', label: 'Pekerjaan Ayah', width: 20 },
      { key: 'nama_ibu', label: 'Nama Ibu', width: 22 },
      { key: 'nik_ibu', label: 'NIK Ibu', width: 20 },
      { key: 'pekerjaan_ibu', label: 'Pekerjaan Ibu', width: 20 },
      { key: 'no_whatsapp', label: 'No. WhatsApp/HP', width: 18 },
      { key: 'nama_wali', label: 'Nama Wali', width: 22 },
      { key: 'no_telepon_wali', label: 'No. Telepon Wali', width: 18 },
      { key: 'asal_sekolah', label: 'Asal Sekolah', width: 24 },
      { key: 'tahun_lulus', label: 'Tahun Lulus', width: 14 },
      { key: 'status_mondok', label: 'Status Mondok', width: 16 },
      { key: 'komplek', label: 'Komplek', width: 20 },
      { key: 'kamar', label: 'Kamar', width: 24 },
      { key: 'catatan_santri', label: 'Catatan', width: 28 },
    ];
  } else {
    const rawKeys = Array.from(
      rows.reduce((acc, row) => {
        Object.keys(row).forEach((key) => {
          if (!['id', 'created_at', 'updated_at', 'deleted_at', 'password'].includes(key)) {
            acc.add(key);
          }
        });
        return acc;
      }, new Set<string>())
    );
    exportCols = rawKeys.map((key) => ({
      key,
      label: key.replace(/_/g, ' ').toUpperCase(),
      width: Math.max(16, key.length + 4),
    }));
  }

  const headerLabels = exportCols.map((c) => c.label);
  const dataRows = rows.map((row) =>
    exportCols.map((c) => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        if (Array.isArray(val)) return val.map((v) => (typeof v === 'object' ? v.name || v.nama || JSON.stringify(v) : v)).join(', ');
        return (val as ApiRecord).name || (val as ApiRecord).nama || '';
      }
      return String(val);
    })
  );

  const aoa = [
    [title],
    [`Dicetak: ${new Date().toLocaleString('id-ID')} | Total Data: ${rows.length} Baris`],
    [],
    headerLabels,
    ...dataRows,
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = exportCols.map((c) => ({ wch: c.width }));
  worksheet['!freeze'] = { xSplit: 0, ySplit: 4 };
  worksheet['!autofilter'] = { ref: `A4:${colName(Math.max(exportCols.length - 1, 0))}${rows.length + 4}` };

  if (exportCols.length > 0) {
    worksheet['!merges'] = [
      XLSX.utils.decode_range(`A1:${colName(exportCols.length - 1)}1`),
      XLSX.utils.decode_range(`A2:${colName(exportCols.length - 1)}2`),
    ];
  }

  styleCell(worksheet, 'A1', styles.title);
  styleCell(worksheet, 'A2', styles.hint);
  exportCols.forEach((_, index) => styleCell(worksheet, `${colName(index)}4`, styles.masterHeader));

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Santri');
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

function normalizeImportDate(value: unknown): string {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';

  const numVal = Number(str);
  if (!isNaN(numVal) && numVal > 1000 && numVal < 100000) {
    const jsDate = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    if (!isNaN(jsDate.getTime())) {
      return jsDate.toISOString().slice(0, 10);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else if (parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return str;
}

function normalizeRow(data: ApiRecord, type: ImportTemplateType, forcedRole?: 'admin' | 'guru' | 'wali'): ApiRecord {
  if (type === 'siswa') {
    return {
      nis: data.nis ?? '',
      nisn: data.nisn ?? '',
      nik: data.nik ?? '',
      no_kk: data.no_kk ?? data.kk ?? '',
      nama: data.nama_lengkap_santri ?? data.nama_lengkap_siswa ?? data.nama_santri ?? data.nama ?? '',
      jenis_kelamin: normalizeGender(data.l_p ?? data.jenis_kelamin ?? data.jk),
      nama_wali: data.nama_wali ?? data.nama_wali_orang_tua ?? data.nama_wali_keluarga ?? '',
      status: normalizeStatus(data.status_santri ?? data.status_siswa ?? data.status),
      kelas: data.kelas_sifir ?? data.kelompok_belajar ?? data.kelas ?? data.sifir ?? '',
      tempat_lahir: data.tempat_lahir ?? '',
      tanggal_lahir: normalizeImportDate(data.tanggal_lahir),
      alamat: data.alamat ?? data.alamat_lengkap ?? '',
      kewarganegaraan: data.kewarganegaraan ?? 'Indonesia',
      provinsi: data.provinsi ?? '',
      kota: data.kabupaten_kota ?? data.kota ?? data.kabupaten ?? data.kab_kota ?? '',
      kecamatan: data.kecamatan ?? '',
      kelurahan: data.desa_kelurahan ?? data.kelurahan ?? data.desa ?? '',
      kode_pos: data.kode_pos ?? '',
      no_whatsapp: data.no_whatsapp_hp ?? data.no_hp_whatsapp ?? data.no_whatsapp ?? data.no_hp ?? data.no_telp ?? '',
      no_telepon_wali: data.no_telepon_wali ?? data.no_whatsapp_hp ?? data.no_hp_whatsapp ?? data.no_whatsapp ?? data.no_hp ?? '',
      email_siswa: data.email ?? data.email_siswa ?? '',
      nama_ayah: data.nama_ayah ?? '',
      nik_ayah: data.nik_ayah ?? '',
      pekerjaan_ayah: data.pekerjaan_ayah ?? '',
      nama_ibu: data.nama_ibu ?? '',
      nik_ibu: data.nik_ibu ?? '',
      pekerjaan_ibu: data.pekerjaan_ibu ?? '',
      no_ayah: data.no_ayah ?? data.no_whatsapp_ayah ?? '',
      no_ibu: data.no_ibu ?? data.no_whatsapp_ibu ?? '',
      asal_sekolah: data.asal_sekolah ?? '',
      tahun_lulus: data.tahun_lulus ? String(data.tahun_lulus).slice(0, 4) : '',
      tahun_akademik_masuk: data.tahun_akademik_masuk ?? '',
      jenis_santri: data.jenis_santri ?? '',
      tanggal_masuk: normalizeImportDate(data.tanggal_masuk),
      status_mondok: data.status_mondok ?? data.mondok ?? (data.kamar || data.komplek ? 'mondok' : ''),
      komplek: data.komplek ?? '',
      kamar: data.kamar ?? '',
      catatan_santri: data.catatan ?? data.catatan_santri ?? data.catatan_lain ?? ''
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
