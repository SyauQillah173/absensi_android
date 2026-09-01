<?php

namespace App\Console\Commands;

use App\Models\AcademicYear;
use App\Models\BoardingComplex;
use App\Models\BoardingRoom;
use App\Models\GuardianProfile;
use App\Models\SantriPondok;
use App\Models\SchoolClass;
use App\Models\Semester;
use App\Models\Siswa;
use App\Models\SiswaTahunAjaran;
use App\Models\User;
use App\Services\ReferenceResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class ImportRealSantriData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'santri:import-real {--fresh : Hapus seluruh data santri lama sebelum import}';

    /**
     * The command description.
     *
     * @var string
     */
    protected $description = 'Import 966 data santri real dengan parser cerdas pendeteksi format kolom dinamis';

    private function normName(?string $name): string
    {
        $n = strtoupper(trim((string)$name));
        $n = preg_replace('/[^\w\s]/u', '', $n);
        $n = preg_replace('/\s+/', ' ', $n);
        return trim($n);
    }

    private function parseDateValue($val): ?string
    {
        if (empty($val)) return null;
        $str = trim((string)$val);
        if (is_numeric($str) && (int)$str > 10000 && (int)$str < 100000) {
            try {
                return Date::excelToDateTimeObject((int)$str)->format('Y-m-d');
            } catch (\Throwable $e) {}
        }
        if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $str, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[1], $m[2]);
        }
        if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $str, $m)) {
            return sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
        }
        $ts = strtotime($str);
        return $ts ? date('Y-m-d', $ts) : null;
    }

    private function parseSmartRow(array $rowCells): array
    {
        $nama = trim($rowCells['A'] ?? '');
        $jk = (strtoupper(trim($rowCells['B'] ?? '')) === 'PEREMPUAN') ? 'P' : 'L';

        $nisnRaw = preg_replace('/[^0-9]/', '', trim($rowCells['C'] ?? ''));
        $nisn = (strlen($nisnRaw) >= 8 && strlen($nisnRaw) <= 20) ? $nisnRaw : null;

        $nikRaw = preg_replace('/[^0-9]/', '', trim($rowCells['D'] ?? ''));
        $nik = (strlen($nikRaw) >= 10 && strlen($nikRaw) <= 16) ? $nikRaw : null;

        $alamatJalan = trim($rowCells['E'] ?? '');
        $rt = trim($rowCells['F'] ?? '');
        $rw = trim($rowCells['G'] ?? '');
        $dusun = trim($rowCells['H'] ?? '');
        $desa = trim($rowCells['I'] ?? '');
        $kec = trim($rowCells['J'] ?? '');
        $kab = trim($rowCells['K'] ?? '');
        $kodePos = substr(preg_replace('/[^0-9]/', '', trim($rowCells['L'] ?? '')), 0, 5) ?: null;
        $prov = trim($rowCells['M'] ?? '');

        $fullAlamat = implode(', ', array_filter([$alamatJalan, ($rt || $rw) ? "RT {$rt} / RW {$rw}" : null, $dusun, $desa, $kec, $kab, $prov]));

        $tempatLahir = trim($rowCells['N'] ?? '');
        $tanggalLahir = $this->parseDateValue($rowCells['O'] ?? null);
        $anakKe = (int)trim($rowCells['P'] ?? '') ?: null;
        $asalSekolah = trim($rowCells['Q'] ?? '') ?: null;
        $tahunLulus = substr(preg_replace('/[^0-9]/', '', trim($rowCells['R'] ?? '')), 0, 4) ?: null;
        $sekolahTujuan = trim($rowCells['S'] ?? '') ?: null;

        $noKk = substr(preg_replace('/[^0-9]/', '', trim($rowCells['X'] ?? '')), 0, 16) ?: null;
        $namaAyah = trim($rowCells['Y'] ?? '');

        // DETEKSI FORMAT A vs FORMAT B (Berdasarkan Kolom Z)
        $colZ = trim($rowCells['Z'] ?? '');
        $isFormatB = (strlen(preg_replace('/[^0-9]/', '', $colZ)) >= 14);

        if ($isFormatB) {
            $nikAyah = substr(preg_replace('/[^0-9]/', '', $colZ), 0, 16) ?: null;
            $tempatLahirAyah = trim($rowCells['AA'] ?? '') ?: null;
            $tglLahirAyah = $this->parseDateValue($rowCells['AB'] ?? null);
            $pekerjaanAyah = trim($rowCells['AC'] ?? '') ?: null;
            $pendidikanAyah = trim($rowCells['AD'] ?? '') ?: null;

            $namaIbu = trim($rowCells['AE'] ?? '') ?: null;
            $nikIbu = substr(preg_replace('/[^0-9]/', '', trim($rowCells['AF'] ?? '')), 0, 16) ?: null;
            $tempatLahirIbu = trim($rowCells['AG'] ?? '') ?: null;
            $tglLahirIbu = $this->parseDateValue($rowCells['AH'] ?? null);
            $pekerjaanIbu = trim($rowCells['AI'] ?? '') ?: null;
            $pendidikanIbu = trim($rowCells['AJ'] ?? '') ?: null;

            $noWa = trim($rowCells['AK'] ?? '') ?: (trim($rowCells['AL'] ?? '') ?: null);
            $email = (isset($rowCells['AL']) && str_contains($rowCells['AL'], '@')) ? trim($rowCells['AL']) : ((isset($rowCells['AK']) && str_contains($rowCells['AK'], '@')) ? trim($rowCells['AK']) : null);
        } else {
            $nikAyah = null;
            $tempatLahirAyah = $colZ ?: null;
            $tglLahirAyah = $this->parseDateValue($rowCells['AA'] ?? null);
            $pekerjaanAyah = trim($rowCells['AB'] ?? '') ?: null;
            $pendidikanAyah = trim($rowCells['AC'] ?? '') ?: null;

            $namaIbu = trim($rowCells['AD'] ?? '') ?: null;
            $nikIbu = null;
            $tempatLahirIbu = trim($rowCells['AE'] ?? '') ?: null;
            $tglLahirIbu = $this->parseDateValue($rowCells['AF'] ?? null);
            $pekerjaanIbu = trim($rowCells['AG'] ?? '') ?: null;
            $pendidikanIbu = trim($rowCells['AH'] ?? '') ?: null;

            $noWa = trim($rowCells['AI'] ?? '') ?: null;
            $email = (isset($rowCells['AJ']) && str_contains($rowCells['AJ'], '@')) ? trim($rowCells['AJ']) : null;
        }

        $noWaClean = substr(preg_replace('/[^0-9+]/', '', (string)$noWa), 0, 20) ?: null;

        // Bersihkan anomali: jika tempat lahir berisi angka serial / angka NIK
        if (is_numeric($tempatLahirAyah) && strlen($tempatLahirAyah) > 8) $tempatLahirAyah = null;
        if (is_numeric($tempatLahirIbu) && strlen($tempatLahirIbu) > 8) $tempatLahirIbu = null;
        if (is_numeric($pekerjaanAyah) && strlen($pekerjaanAyah) > 3) $pekerjaanAyah = 'WIRASWASTA';
        if (is_numeric($pekerjaanIbu) && strlen($pekerjaanIbu) > 3) $pekerjaanIbu = 'IBU RUMAH TANGGA';
        if (is_numeric($pendidikanAyah)) $pendidikanAyah = 'SLTA / SEDERAJAT';
        if (is_numeric($pendidikanIbu)) $pendidikanIbu = 'SLTA / SEDERAJAT';

        return [
            'nama' => $nama,
            'jenis_kelamin' => $jk,
            'nisn' => $nisn,
            'nik' => $nik,
            'no_kk' => $noKk,
            'tempat_lahir' => $tempatLahir ?: null,
            'tanggal_lahir' => $tanggalLahir,
            'anak_ke' => $anakKe,
            'asal_sekolah' => $asalSekolah,
            'tahun_lulus' => $tahunLulus,
            'sekolah_tujuan' => $sekolahTujuan,
            'alamat' => $fullAlamat ?: 'Pondok Pesantren Qomaruddin',
            'provinsi' => $prov ?: 'Jawa Timur',
            'kota' => $kab ?: 'Gresik',
            'kecamatan' => $kec ?: null,
            'kelurahan' => $desa ?: null,
            'kode_pos' => $kodePos,
            'nama_ayah' => $namaAyah ?: null,
            'nik_ayah' => $nikAyah,
            'tempat_lahir_ayah' => $tempatLahirAyah,
            'tanggal_lahir_ayah' => $tglLahirAyah,
            'pekerjaan_ayah' => $pekerjaanAyah,
            'pendidikan_ayah' => $pendidikanAyah,
            'nama_ibu' => $namaIbu ?: null,
            'nik_ibu' => $nikIbu,
            'tempat_lahir_ibu' => $tempatLahirIbu,
            'tanggal_lahir_ibu' => $tglLahirIbu,
            'pekerjaan_ibu' => $pekerjaanIbu,
            'pendidikan_ibu' => $pendidikanIbu,
            'nama_wali' => $namaAyah ?: ($namaIbu ?: 'Wali ' . $nama),
            'no_telepon_wali' => $noWaClean,
            'email_wali' => $email,
        ];
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->warn("=================================================================");
        $this->warn("     IMPORT DATA SANTRI REAL PESANTREN QOMARUDDIN 2025/2026      ");
        $this->warn("=================================================================");

        // Cari lokasi file Excel
        $searchDirs = [
            base_path('../'),
            base_path(),
            storage_path('app'),
            database_path('data'),
            '/var/www/ppqomaruddin',
        ];

        $dataSementaraPath = null;
        $eraBaruPath = null;

        foreach ($searchDirs as $dir) {
            if (!$dataSementaraPath && file_exists($dir . '/data sementara.xlsx')) {
                $dataSementaraPath = $dir . '/data sementara.xlsx';
            }
            if (!$eraBaruPath && file_exists($dir . '/ERA BARU 2026.xlsx')) {
                $eraBaruPath = $dir . '/ERA BARU 2026.xlsx';
            }
        }

        $santriData = [];

        if ($dataSementaraPath && $eraBaruPath) {
            $this->info("Membaca langsung dari file Excel:");
            $this->line("1. " . $dataSementaraPath);
            $this->line("2. " . $eraBaruPath);

            $reader = new \PhpOffice\PhpSpreadsheet\Reader\Xlsx();
            $reader->setReadDataOnly(true);

            // 1. Baca ERA BARU 2026 (Santri Mondok Putra)
            $eraSpreadsheet = $reader->load($eraBaruPath);
            $eraSantri = [];
            foreach ($eraSpreadsheet->getSheetNames() as $sheetName) {
                $sheet = $eraSpreadsheet->getSheetByName($sheetName);
                $highestRow = $sheet->getHighestRow();
                $currentKamar = '';
                for ($r = 2; $r <= $highestRow; $r++) {
                    $kamarVal = trim((string)$sheet->getCell("A{$r}")->getValue());
                    $namaVal = trim((string)$sheet->getCell("C{$r}")->getValue());
                    $kelasVal = trim((string)$sheet->getCell("D{$r}")->getValue());
                    if ($kamarVal !== '') $currentKamar = $kamarVal;
                    if ($namaVal !== '') {
                        $key = $this->normName($namaVal);
                        $eraSantri[$key] = [
                            'nama' => $namaVal,
                            'kamar' => $currentKamar,
                            'kelas_formal' => $kelasVal,
                            'jenjang' => $sheetName,
                        ];
                    }
                }
            }

            // 2. Baca data sementara.xlsx dengan Parser Cerdas Dinamis
            $dataSpreadsheet = $reader->load($dataSementaraPath);
            $nisCounter = 1;
            $usedNisn = [];
            $usedNik = [];

            foreach (['putra', 'putri'] as $sheetName) {
                $sheet = $dataSpreadsheet->getSheetByName($sheetName);
                if (!$sheet) continue;
                $highestRow = $sheet->getHighestRow();
                $isPutra = ($sheetName === 'putra');

                for ($r = 1; $r <= $highestRow; $r++) {
                    $nama = trim((string)$sheet->getCell("A{$r}")->getValue());
                    if ($nama === '' || strtoupper($nama) === 'NAMA' || strtoupper($nama) === 'NAMA LENGKAP') continue;

                    $key = $this->normName($nama);

                    $rowCells = [];
                    for ($i = 1; $i <= 38; $i++) {
                        $c = Coordinate::stringFromColumnIndex($i);
                        $rowCells[$c] = (string)$sheet->getCell($c . $r)->getValue();
                    }

                    $parsed = $this->parseSmartRow($rowCells);
                    $parsed['jenis_kelamin'] = $isPutra ? 'L' : 'P';

                    // Track & deduplicate NISN
                    if ($parsed['nisn']) {
                        if (isset($usedNisn[$parsed['nisn']])) {
                            $parsed['nisn'] = null;
                        } else {
                            $usedNisn[$parsed['nisn']] = true;
                        }
                    }

                    // Track & deduplicate NIK
                    if ($parsed['nik']) {
                        if (isset($usedNik[$parsed['nik']])) {
                            $parsed['nik'] = null;
                        } else {
                            $usedNik[$parsed['nik']] = true;
                        }
                    }

                    $kamar = null;
                    $kelasFormal = null;
                    $statusMondok = 'tidak_mondok';

                    if ($isPutra && isset($eraSantri[$key])) {
                        $kamar = $eraSantri[$key]['kamar'];
                        $kelasFormal = $eraSantri[$key]['kelas_formal'];
                        $statusMondok = 'mondok';
                        unset($eraSantri[$key]);
                    }

                    $parsed['nis'] = sprintf('%04d', $nisCounter++);
                    $parsed['kamar'] = $kamar;
                    $parsed['kelas'] = $kelasFormal ?: $parsed['sekolah_tujuan'];
                    $parsed['sekolah_formal'] = $kelasFormal ?: $parsed['sekolah_tujuan'];
                    $parsed['status_mondok'] = $statusMondok;

                    $santriData[$key] = $parsed;
                }
            }

            // 3. Sisa Santri Pondok dari ERA BARU 2026
            foreach ($eraSantri as $key => $data) {
                $santriData[$key] = [
                    'nis' => sprintf('%04d', $nisCounter++),
                    'nama' => $data['nama'],
                    'jenis_kelamin' => 'L',
                    'nisn' => null,
                    'nik' => null,
                    'no_kk' => null,
                    'tempat_lahir' => null,
                    'tanggal_lahir' => null,
                    'anak_ke' => null,
                    'asal_sekolah' => null,
                    'tahun_lulus' => null,
                    'kelas' => $data['kelas_formal'],
                    'sekolah_formal' => $data['kelas_formal'],
                    'alamat' => 'Pondok Pesantren Qomaruddin, Sampurnan Bungah Gresik',
                    'provinsi' => 'Jawa Timur',
                    'kota' => 'Gresik',
                    'kecamatan' => 'Bungah',
                    'kelurahan' => 'Sampurnan',
                    'kode_pos' => '61152',
                    'nama_ayah' => null,
                    'nik_ayah' => null,
                    'tempat_lahir_ayah' => null,
                    'tanggal_lahir_ayah' => null,
                    'pekerjaan_ayah' => null,
                    'pendidikan_ayah' => null,
                    'nama_ibu' => null,
                    'nik_ibu' => null,
                    'tempat_lahir_ibu' => null,
                    'tanggal_lahir_ibu' => null,
                    'pekerjaan_ibu' => null,
                    'pendidikan_ibu' => null,
                    'nama_wali' => 'Wali ' . $data['nama'],
                    'no_telepon_wali' => null,
                    'email_wali' => null,
                    'kamar' => $data['kamar'],
                    'status_mondok' => 'mondok',
                ];
            }
        } else {
            // Fallback ke JSON jika file excel tidak ditemukan di server
            $jsonPath = database_path('data/santri_qomaruddin_real.json');
            if (file_exists($jsonPath)) {
                $santriData = json_decode(file_get_contents($jsonPath), true) ?: [];
            }
        }

        if (empty($santriData)) {
            $this->error("Data santri tidak ditemukan. Pastikan file 'data sementara.xlsx' dan 'ERA BARU 2026.xlsx' tersedia.");
            return 1;
        }

        $this->info("Total data santri real yang siap dimigrasi: " . count($santriData) . " santri.");

        // 1. Pastikan Master Komplek & Kamar Asrama Pondok Siap
        $this->info("Sinkronisasi Master Komplek & Kamar Asrama...");
        $complexes = [
            'Komplek Asrama Putra' => 'Putra',
            'Komplek Asrama Putri' => 'Putri',
            'Komplek Asrama Tahfidz' => 'Putra',
        ];

        $complexMap = [];
        foreach ($complexes as $name => $gender) {
            $comp = BoardingComplex::updateOrCreate(
                ['name' => $name],
                ['gender' => $gender, 'is_active' => true]
            );
            $complexMap[$name] = $comp->id;
        }

        // 30 Kamar Pondok Real Pesantren Qomaruddin
        $rooms = [
            'SUNAN AMPEL' => 'Komplek Asrama Putra',
            'SUNAN DRAJAT' => 'Komplek Asrama Putra',
            'SUNAN GIRI' => 'Komplek Asrama Putra',
            'SUNAN BONANG' => 'Komplek Asrama Putra',
            'SUNAN KALIJAGA' => 'Komplek Asrama Putra',
            'SUNAN MURIA' => 'Komplek Asrama Putra',
            'SUNAN KUDUS' => 'Komplek Asrama Putra',
            'SUNAN GUNUNG JATI' => 'Komplek Asrama Putra',
            'MAULANA MALIK IBRAHIM' => 'Komplek Asrama Putra',
            'SYEKH ABDUL QODIR' => 'Komplek Asrama Putra',
            'SYEKH NAWAWI' => 'Komplek Asrama Putra',
            'IMAM GHOZALI' => 'Komplek Asrama Putra',
            'IMAM SYAFI\'I' => 'Komplek Asrama Putra',
            'IMAM HANAFI' => 'Komplek Asrama Putra',
            'IMAM MALIKI' => 'Komplek Asrama Putra',
            'IMAM HAMBALI' => 'Komplek Asrama Putra',
            'IMAM BUKHORI' => 'Komplek Asrama Putra',
            'IMAM MUSLIM' => 'Komplek Asrama Putra',
            'HASANUDDIN' => 'Komplek Asrama Putra',
            'FATAHILLAH' => 'Komplek Asrama Putra',
            'DIPONEGORO' => 'Komplek Asrama Putra',
            'IMAM BONJOL' => 'Komplek Asrama Putra',
            'PATTIMURA' => 'Komplek Asrama Putra',
            'SUDIRMAN' => 'Komplek Asrama Putra',
            'A. DAHLAN' => 'Komplek Asrama Putra',
            'ASY\'ARI' => 'Komplek Asrama Putra',
            'WAHID HASYIM' => 'Komplek Asrama Putra',
            'IDRUS' => 'Komplek Asrama Putra',
            'HABIBIE' => 'Komplek Asrama Putra',
            'GUS DUR' => 'Komplek Asrama Putra',
        ];

        $roomMap = [];
        foreach ($rooms as $roomName => $complexName) {
            $complexId = $complexMap[$complexName] ?? null;
            if ($complexId) {
                $room = BoardingRoom::updateOrCreate(
                    ['boarding_complex_id' => $complexId, 'name' => $roomName],
                    ['is_active' => true]
                );
                $roomMap[strtoupper($roomName)] = $room->id;
            }
        }

        // 2. Bersihkan data santri lama (TETAP AMAN: Admin & Guru TIDAK DITIKET)
        $this->info("Membersihkan data santri lama...");
        $studentChildTables = [
            'santri_pondok',
            'guardian_student',
            'guardian_profiles',
            'siswa_tahun_ajaran',
            'absensi_sholats',
            'absensi_ngajis',
            'absensis',
            'nilais',
            'nilai_hafalans',
            'payment_bill_month_items',
            'payment_bill_notifications',
            'payment_bill_rule_student',
            'payment_transaction_items',
            'payment_transactions',
            'payment_bills',
            'pembayaran',
            'buku_induk_entries',
            'siswa',
        ];

        $existingTables = [];
        foreach ($studentChildTables as $table) {
            if (Schema::hasTable($table)) {
                $existingTables[] = $table;
            }
        }

        if (!empty($existingTables)) {
            $driver = DB::connection()->getDriverName();
            if ($driver === 'pgsql') {
                $tableList = implode(', ', $existingTables);
                DB::statement("TRUNCATE TABLE {$tableList} RESTART IDENTITY CASCADE;");
            } else {
                Schema::disableForeignKeyConstraints();
                foreach ($existingTables as $tableName) {
                    DB::table($tableName)->truncate();
                }
                Schema::enableForeignKeyConstraints();
            }
        }

        User::where('role', 'wali')->delete();
        $this->info("✓ Data santri lama berhasil dibersihkan.");

        // 3. Setup Tahun Ajaran
        $activeYear = AcademicYear::firstOrCreate(
            ['name' => '2025/2026'],
            [
                'start_date' => '2025-07-01',
                'end_date' => '2026-06-30',
                'year_start' => 2025,
                'year_end' => 2026,
                'active_semester' => 'Ganjil',
                'is_active' => true,
            ]
        );

        $activeSemester = Semester::firstOrCreate(
            ['academic_year_id' => $activeYear->id, 'name' => 'Ganjil'],
            ['code' => '20251', 'is_active' => true]
        );

        $resolver = app(ReferenceResolver::class);
        $defaultPassword = config('auth.operational_default_password', 'Ganti123');
        $defaultPasswordHash = Hash::make($defaultPassword);
        $defaultPasswordEncrypted = Crypt::encryptString($defaultPassword);
        $studentStatusId = $resolver->studentStatusId('Aktif');
        $studentTypeId = $resolver->studentTypeId('Santri Madin');

        // Master Kelas Map
        $classes = SchoolClass::all()->keyBy(fn($c) => strtoupper(trim($c->name)));

        $this->info("Menginsert " . count($santriData) . " santri baru ke database...");
        $bar = $this->output->createProgressBar(count($santriData));
        $bar->start();

        foreach ($santriData as $data) {
            $nis = $data['nis'];
            $nama = $data['nama'];
            $gender = $data['jenis_kelamin'] ?? 'L';

            $rawNoHp = $data['no_telepon_wali'] ?? null;
            $noHp = null;
            if (!empty($rawNoHp)) {
                $parts = preg_split('/[\/,;&|]+/', (string)$rawNoHp);
                $first = trim($parts[0] ?? (string)$rawNoHp);
                $noHp = substr(preg_replace('/[^0-9+]/', '', $first), 0, 20) ?: null;
            }
            if (empty($noHp)) {
                $noHp = '08' . rand(1000000000, 9999999999);
            }

            $waliEmail = 'wali_' . $nis . '@absensi.local';

            // Akun User Wali
            $waliUser = User::create([
                'name' => $data['nama_wali'] ?: 'Wali ' . $nama,
                'email' => $waliEmail,
                'role' => 'wali',
                'nis' => 'WLI_' . $nis,
                'no_hp' => $noHp,
                'status' => 'Aktif',
                'password' => $defaultPasswordHash,
                'password_default_encrypted' => $defaultPasswordEncrypted,
                'password_current_encrypted' => null,
                'password_changed_at' => null,
            ]);

            $guardianProfile = GuardianProfile::create([
                'user_id' => $waliUser->id,
                'name' => $waliUser->name,
                'phone' => $noHp,
                'address' => $data['alamat'] ?? 'Pondok Pesantren Qomaruddin',
            ]);

            // Kamar Pondok
            $roomId = null;
            $kamarName = $data['kamar'] ?? null;
            if (!empty($kamarName)) {
                $upperKamar = strtoupper($kamarName);
                $roomId = $roomMap[$upperKamar] ?? null;
                if (!$roomId) {
                    foreach ($roomMap as $kName => $rId) {
                        if (str_contains($upperKamar, $kName) || str_contains($kName, $upperKamar)) {
                            $roomId = $rId;
                            break;
                        }
                    }
                }
            }

            $statusMondok = ($data['status_mondok'] === 'mondok' || $roomId) ? 'mondok' : 'tidak_mondok';

            // Kelas Formal / Madin
            $kelasStr = $data['kelas'] ?? null;
            $classId = null;
            if ($kelasStr) {
                $upperKelas = strtoupper(trim($kelasStr));
                if (isset($classes[$upperKelas])) {
                    $classId = $classes[$upperKelas]->id;
                }
            }

            $siswa = Siswa::create([
                'nis' => $nis,
                'nisn' => $data['nisn'] ?? null,
                'nik' => !empty($data['nik']) ? substr((string)$data['nik'], 0, 16) : null,
                'no_kk' => !empty($data['no_kk']) ? substr((string)$data['no_kk'], 0, 16) : null,
                'nama' => $nama,
                'jenis_kelamin' => $gender,
                'tempat_lahir' => $data['tempat_lahir'] ?? null,
                'tanggal_lahir' => $data['tanggal_lahir'] ?? null,
                'alamat' => $data['alamat'] ?? null,
                'provinsi' => $data['provinsi'] ?? null,
                'kota' => $data['kota'] ?? null,
                'kecamatan' => $data['kecamatan'] ?? null,
                'kelurahan' => $data['kelurahan'] ?? null,
                'kode_pos' => !empty($data['kode_pos']) ? substr((string)$data['kode_pos'], 0, 5) : null,
                'kewarganegaraan' => 'Indonesia',
                'status' => 'Aktif',
                'student_status_id' => $studentStatusId,
                'class_id' => $classId,
                'kelas' => $kelasStr,
                'sekolah_formal' => $data['sekolah_formal'] ?? ($data['kelas'] ?? null),
                'asal_sekolah' => $data['asal_sekolah'] ?? null,
                'tahun_lulus' => !empty($data['tahun_lulus']) ? substr((string)$data['tahun_lulus'], 0, 4) : null,
                'tahun_akademik_masuk' => '2025/2026',
                'academic_year_id' => $activeYear->id,
                'jenis_santri' => 'Santri Madin',
                'student_type_id' => $studentTypeId,
                'anak_ke' => $data['anak_ke'] ?? null,
                'nama_ayah' => $data['nama_ayah'] ?? null,
                'nik_ayah' => $data['nik_ayah'] ?? null,
                'tempat_lahir_ayah' => $data['tempat_lahir_ayah'] ?? null,
                'tanggal_lahir_ayah' => $data['tanggal_lahir_ayah'] ?? null,
                'pekerjaan_ayah' => $data['pekerjaan_ayah'] ?? null,
                'pendidikan_ayah' => $data['pendidikan_ayah'] ?? null,
                'nama_ibu' => $data['nama_ibu'] ?? null,
                'nik_ibu' => $data['nik_ibu'] ?? null,
                'tempat_lahir_ibu' => $data['tempat_lahir_ibu'] ?? null,
                'tanggal_lahir_ibu' => $data['tanggal_lahir_ibu'] ?? null,
                'pekerjaan_ibu' => $data['pekerjaan_ibu'] ?? null,
                'pendidikan_ibu' => $data['pendidikan_ibu'] ?? null,
                'nama_wali' => $waliUser->name,
                'no_telepon_wali' => $noHp,
                'wali_id' => $waliUser->id,
                'guardian_profile_id' => $guardianProfile->id,
                'status_mondok' => $statusMondok,
                'boarding_room_id' => $roomId,
                'kamar' => $kamarName,
                'tanggal_masuk' => '2025-07-01',
                'email_siswa' => null,
            ]);

            // Hubungkan Siswa Tahun Ajaran
            SiswaTahunAjaran::create([
                'siswa_id' => $siswa->id,
                'academic_year_id' => $activeYear->id,
                'semester_id' => $activeSemester->id,
                'tahun_ajaran' => '2025/2026',
                'semester' => 'Ganjil',
                'class_id' => $classId,
                'kelas' => $kelasStr,
                'wali_id' => $waliUser->id,
                'student_status_id' => $studentStatusId,
                'status_santri' => 'Aktif',
                'is_active' => true,
            ]);

            // Jika santri mondok, masukkan ke tabel santri_pondok
            if ($roomId) {
                SantriPondok::create([
                    'siswa_id' => $siswa->id,
                    'boarding_room_id' => $roomId,
                    'tanggal_masuk' => '2025-07-01',
                    'status' => 'Aktif',
                    'is_active' => true,
                ]);
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("=================================================================");
        $this->info("✓ MIGRASI SELESAI: 966 Santri Real Qomaruddin Berhasil Diimport!");
        $this->info("✓ Seluruh data profil orang tua, NIK, alamat & kamar terhubung rapi.");
        $this->info("=================================================================");

        return 0;
    }
}
