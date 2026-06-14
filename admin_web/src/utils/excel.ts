import * as XLSX from 'xlsx';
import type { ApiRecord } from '../services/api';

function asText(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function asNumber(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Rekap';
}

export function exportPrayerRekapExcel(rows: ApiRecord[], summary: ApiRecord, fileName = 'rekap_absensi_sholat.xlsx') {
  const headers = ['No', 'Tanggal', "Waktu Jama'ah", 'Nama Santri', 'NIS', 'NISN', 'Kelas', 'Komplek', 'Kamar', 'Status', 'Petugas', 'Waktu Input'];
  const dataRows = rows.map((row, index) => [
    index + 1,
    asText(row.tanggal),
    asText(row.jenis_sholat),
    asText(row.nama),
    asText(row.nis),
    asText(row.nisn),
    asText(row.kelas),
    asText(row.komplek),
    asText(row.kamar),
    asText(row.status_label ?? row.status),
    asText(row.petugas ?? row.diinput_oleh),
    asText(row.waktu_input)
  ]);
  const statusRangeEnd = Math.max(5, dataRows.length + 4);
  const aoa = [
    ['REKAP ABSENSI JAMA\'AH SHOLAT'],
    [`Dicetak: ${new Date().toLocaleString('id-ID')}`],
    [],
    headers,
    ...dataRows,
    [],
    ['Ringkasan', 'Masuk', 'Izin', 'Sakit', 'Kosong', 'Dibatalkan', 'Persentase Hadir'],
    [
      'Total',
      { f: `COUNTIF(J5:J${statusRangeEnd},"Masuk")+COUNTIF(J5:J${statusRangeEnd},"M")`, v: asNumber(summary.M) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Izin")+COUNTIF(J5:J${statusRangeEnd},"I")`, v: asNumber(summary.I) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Sakit")+COUNTIF(J5:J${statusRangeEnd},"S")`, v: asNumber(summary.S) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Kosong")`, v: asNumber(summary.Kosong) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Dibatalkan")`, v: asNumber(summary.Dibatalkan) },
      `${asNumber(summary.persentase_hadir)}%`
    ]
  ];
  writeWorkbook(aoa, fileName, 'Rekap Sholat');
}

export function exportMadinRekapExcel(rows: ApiRecord[], month: number, year: number, fileName = 'rekap_absensi_madin.xlsx') {
  const headers = ['No', 'Nama Siswa/Santri', 'NIS', 'Kelas', 'Mapel', 'Hadir', 'Izin', 'Sakit', 'Alfa', 'Total', 'Kehadiran %', 'Petugas'];
  const dataRows = rows.map((row, index) => {
    const siswa = (row.siswa && typeof row.siswa === 'object' ? row.siswa : {}) as ApiRecord;
    const hadir = asNumber(row.total_hadir ?? row.hadir);
    const izin = asNumber(row.total_izin ?? row.izin);
    const sakit = asNumber(row.total_sakit ?? row.sakit);
    const alfa = asNumber(row.total_alfa ?? row.alfa);
    const total = hadir + izin + sakit + alfa;
    return [
      index + 1,
      asText(siswa.nama ?? row.nama),
      asText(siswa.nis ?? row.nis),
      asText(row.kelas),
      asText(row.mapel),
      hadir,
      izin,
      sakit,
      alfa,
      total,
      total > 0 ? `${Math.round((hadir / total) * 100)}%` : '0%',
      asText(row.diinput_oleh ?? row.petugas)
    ];
  });
  const aoa = [
    [`REKAP ABSENSI MADIN - ${month}/${year}`],
    [`Dicetak: ${new Date().toLocaleString('id-ID')}`],
    [],
    headers,
    ...dataRows,
    [],
    ['Ringkasan', 'Hadir', 'Izin', 'Sakit', 'Alfa'],
    ['Total', { f: 'SUM(F5:F1048576)' }, { f: 'SUM(G5:G1048576)' }, { f: 'SUM(H5:H1048576)' }, { f: 'SUM(I5:I1048576)' }]
  ];
  writeWorkbook(aoa, fileName, 'Rekap Madin');
}

export function exportNgajiRekapExcel(rows: ApiRecord[], summary: ApiRecord, fileName = 'rekap_absensi_ngaji.xlsx') {
  const headers = ['No', 'Tanggal', 'Sesi', 'Kitab', 'Nama Santri', 'NIS', 'Kelas', 'Komplek', 'Kamar', 'Status', 'Petugas', 'Waktu Input'];
  const dataRows = rows.map((row, index) => [
    index + 1,
    asText(row.tanggal),
    asText(row.sesi),
    asText(row.kitab),
    asText(row.nama),
    asText(row.nis),
    asText(row.kelas),
    asText(row.komplek),
    asText(row.kamar),
    asText(row.status_label ?? row.status),
    asText(row.petugas ?? row.diinput_oleh),
    asText(row.waktu_input)
  ]);
  const statusRangeEnd = Math.max(5, dataRows.length + 4);
  const aoa = [
    ['REKAP ABSENSI NGAJI KITAB'],
    [`Dicetak: ${new Date().toLocaleString('id-ID')}`],
    [],
    headers,
    ...dataRows,
    [],
    ['Ringkasan', 'Hadir', 'Izin', 'Sakit', 'Alfa', 'Kosong', 'Dibatalkan', 'Persentase Hadir'],
    [
      'Total',
      { f: `COUNTIF(J5:J${statusRangeEnd},"Hadir")+COUNTIF(J5:J${statusRangeEnd},"H")`, v: asNumber(summary.H) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Izin")+COUNTIF(J5:J${statusRangeEnd},"I")`, v: asNumber(summary.I) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Sakit")+COUNTIF(J5:J${statusRangeEnd},"S")`, v: asNumber(summary.S) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Alfa")+COUNTIF(J5:J${statusRangeEnd},"A")`, v: asNumber(summary.A) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Kosong")`, v: asNumber(summary.Kosong) },
      { f: `COUNTIF(J5:J${statusRangeEnd},"Dibatalkan")`, v: asNumber(summary.Dibatalkan) },
      `${asNumber(summary.persentase_hadir)}%`
    ]
  ];
  writeWorkbook(aoa, fileName, 'Rekap Ngaji');
}

function writeWorkbook(aoa: unknown[][], fileName: string, sheetName: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 24 }
  ];
  worksheet['!freeze'] = { xSplit: 0, ySplit: 4 };
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
  XLSX.writeFile(workbook, fileName);
}
