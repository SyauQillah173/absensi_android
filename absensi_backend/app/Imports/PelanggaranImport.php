<?php

namespace App\Imports;

use App\Models\PelanggaranKategori;
use App\Models\PelanggaranSantri;
use App\Models\Siswa;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class PelanggaranImport implements ToCollection, WithHeadingRow
{
    private int $importedCount = 0;
    private array $skippedRows = [];

    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            $rowNum = $index + 2;
            $nis = trim((string)($row['nis'] ?? ''));
            $nama = trim((string)($row['nama_santri'] ?? $row['nama'] ?? ''));

            $siswa = null;
            if (!empty($nis)) {
                $siswa = Siswa::where('nis', $nis)->first();
            }
            if (!$siswa && !empty($nama)) {
                $siswa = Siswa::whereRaw('LOWER(TRIM(nama)) = ?', [strtolower($nama)])->first();
            }

            if (!$siswa) {
                $this->skippedRows[] = "Baris {$rowNum}: Santri dengan NIS '{$nis}' / Nama '{$nama}' tidak ditemukan.";
                continue;
            }

            $judul = trim((string)($row['judul_pelanggaran'] ?? $row['pelanggaran'] ?? ''));
            if (empty($judul)) {
                $this->skippedRows[] = "Baris {$rowNum}: Judul pelanggaran kosong.";
                continue;
            }

            // Parsing tanggal
            $tanggal = Carbon::now()->toDateString();
            if (!empty($row['tanggal'])) {
                try {
                    $tanggal = Carbon::parse($row['tanggal'])->toDateString();
                } catch (\Throwable $e) {
                    // keep default
                }
            }

            $tingkat = ucfirst(strtolower(trim((string)($row['tingkat'] ?? 'Ringan'))));
            if (!in_array($tingkat, ['Ringan', 'Sedang', 'Berat'])) {
                $tingkat = 'Ringan';
            }

            $poin = isset($row['poin']) && is_numeric($row['poin']) ? (int)$row['poin'] : ($tingkat === 'Berat' ? 25 : ($tingkat === 'Sedang' ? 10 : 5));
            $denda = isset($row['denda_nominal']) && is_numeric($row['denda_nominal']) ? (float)$row['denda_nominal'] : (isset($row['denda']) && is_numeric($row['denda']) ? (float)$row['denda'] : 0);
            $statusDenda = strtolower(trim((string)($row['status_denda'] ?? 'tidak_ada')));
            if (!in_array($statusDenda, ['tidak_ada', 'belum_dibayar', 'lunas'])) {
                $statusDenda = $denda > 0 ? 'belum_dibayar' : 'tidak_ada';
            }

            // Kategori
            $kategoriId = null;
            $namaKategori = trim((string)($row['kategori'] ?? ''));
            if (!empty($namaKategori)) {
                $kat = PelanggaranKategori::firstOrCreate(
                    ['nama_pelanggaran' => $namaKategori],
                    ['tingkat' => $tingkat, 'poin_default' => $poin, 'denda_default' => $denda]
                );
                $kategoriId = $kat->id;
            }

            PelanggaranSantri::create([
                'siswa_id' => $siswa->id,
                'tanggal' => $tanggal,
                'waktu' => !empty($row['waktu']) ? trim((string)$row['waktu']) : null,
                'kategori_id' => $kategoriId,
                'judul_pelanggaran' => $judul,
                'tingkat' => $tingkat,
                'poin' => $poin,
                'denda' => $denda,
                'status_denda' => $statusDenda,
                'tindakan_takzir' => !empty($row['tindakan_takzir']) ? trim((string)$row['tindakan_takzir']) : null,
                'keterangan' => !empty($row['keterangan']) ? trim((string)$row['keterangan']) : null,
                'nama_petugas' => !empty($row['nama_petugas']) ? trim((string)$row['nama_petugas']) : 'Import Excel',
                'status_peringatan' => 'normal',
            ]);

            $this->importedCount++;
        }
    }

    public function getImportedCount(): int
    {
        return $this->importedCount;
    }

    public function getSkippedRows(): array
    {
        return $this->skippedRows;
    }
}
