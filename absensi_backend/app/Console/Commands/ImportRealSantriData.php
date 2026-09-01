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
use PhpOffice\PhpSpreadsheet\IOFactory;

class ImportRealSantriData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'santri:import-real {--fresh : Hapus seluruh data santri lama sebelum import}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import 966 data santri real langsung dari data sementara.xlsx dan ERA BARU 2026.xlsx';

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
        if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $str, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[1], $m[2]);
        }
        if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $str, $m)) {
            return sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
        }
        $ts = strtotime($str);
        return $ts ? date('Y-m-d', $ts) : null;
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

            // 2. Baca data sementara.xlsx
            $dataSpreadsheet = $reader->load($dataSementaraPath);
            $nisCounter = 1;

            foreach (['putra', 'putri'] as $sheetName) {
                $sheet = $dataSpreadsheet->getSheetByName($sheetName);
                if (!$sheet) continue;
                $highestRow = $sheet->getHighestRow();
                $isPutra = ($sheetName === 'putra');

                for ($r = 1; $r <= $highestRow; $r++) {
                    $nama = trim((string)$sheet->getCell("A{$r}")->getValue());
                    if ($nama === '' || strtoupper($nama) === 'NAMA' || strtoupper($nama) === 'NAMA LENGKAP') continue;

                    $key = $this->normName($nama);
                    $jk = $isPutra ? 'L' : 'P';
                    $nisn = trim((string)$sheet->getCell("C{$r}")->getValue()) ?: null;
                    $nik = trim((string)$sheet->getCell("D{$r}")->getValue()) ?: null;
                    $sekolahTujuan = trim((string)$sheet->getCell("S{$r}")->getValue()) ?: null;
                    $waWali = trim((string)$sheet->getCell("AI{$r}")->getValue()) ?: null;
                    $emailWali = trim((string)$sheet->getCell("AJ{$r}")->getValue()) ?: null;

                    $alamatJalan = trim((string)$sheet->getCell("E{$r}")->getValue());
                    $rt = trim((string)$sheet->getCell("F{$r}")->getValue());
                    $rw = trim((string)$sheet->getCell("G{$r}")->getValue());
                    $dusun = trim((string)$sheet->getCell("H{$r}")->getValue());
                    $desa = trim((string)$sheet->getCell("I{$r}")->getValue());
                    $kec = trim((string)$sheet->getCell("J{$r}")->getValue());
                    $kab = trim((string)$sheet->getCell("K{$r}")->getValue());
                    $kodePos = trim((string)$sheet->getCell("L{$r}")->getValue());
                    $prov = trim((string)$sheet->getCell("M{$r}")->getValue());

                    $fullAlamat = implode(', ', array_filter([$alamatJalan, ($rt || $rw) ? "RT {$rt} / RW {$rw}" : null, $dusun, $desa, $kec, $kab, $prov]));

                    $kamar = null;
                    $kelasFormal = null;
                    $statusMondok = 'tidak_mondok';

                    if ($isPutra && isset($eraSantri[$key])) {
                        $kamar = $eraSantri[$key]['kamar'];
                        $kelasFormal = $eraSantri[$key]['kelas_formal'];
                        $statusMondok = 'mondok';
                        unset($eraSantri[$key]);
                    }

                    $santriData[$key] = [
                        'nis' => sprintf('%04d', $nisCounter++),
                        'nama' => $nama,
                        'jenis_kelamin' => $jk,
                        'nisn' => $nisn,
                        'nik' => $nik,
                        'tempat_lahir' => trim((string)$sheet->getCell("N{$r}")->getValue()) ?: null,
                        'tanggal_lahir' => $this->parseDateValue($sheet->getCell("O{$r}")->getValue()),
                        'anak_ke' => (int)trim((string)$sheet->getCell("P{$r}")->getValue()) ?: null,
                        'asal_sekolah' => trim((string)$sheet->getCell("Q{$r}")->getValue()) ?: null,
                        'tahun_lulus' => trim((string)$sheet->getCell("R{$r}")->getValue()) ?: null,
                        'kelas' => $kelasFormal ?: $sekolahTujuan,
                        'alamat' => $fullAlamat ?: 'Pondok Pesantren Qomaruddin',
                        'provinsi' => $prov ?: 'Jawa Timur',
                        'kota' => $kab ?: 'Gresik',
                        'kecamatan' => $kec ?: null,
                        'kelurahan' => $desa ?: null,
                        'kode_pos' => $kodePos ?: null,
                        'nama_ayah' => trim((string)$sheet->getCell("Y{$r}")->getValue()) ?: null,
                        'tempat_lahir_ayah' => trim((string)$sheet->getCell("Z{$r}")->getValue()) ?: null,
                        'pekerjaan_ayah' => trim((string)$sheet->getCell("AB{$r}")->getValue()) ?: null,
                        'pendidikan_ayah' => trim((string)$sheet->getCell("AC{$r}")->getValue()) ?: null,
                        'nama_ibu' => trim((string)$sheet->getCell("AD{$r}")->getValue()) ?: null,
                        'tempat_lahir_ibu' => trim((string)$sheet->getCell("AE{$r}")->getValue()) ?: null,
                        'pekerjaan_ibu' => trim((string)$sheet->getCell("AG{$r}")->getValue()) ?: null,
                        'pendidikan_ibu' => trim((string)$sheet->getCell("AH{$r}")->getValue()) ?: null,
                        'nama_wali' => trim((string)$sheet->getCell("Y{$r}")->getValue()) ?: (trim((string)$sheet->getCell("AD{$r}")->getValue()) ?: 'Wali ' . $nama),
                        'no_telepon_wali' => $waWali,
                        'email_wali' => $emailWali,
                        'kamar' => $kamar,
                        'status_mondok' => $statusMondok,
                    ];
                }
            }

            // Sisa Santri Pondok dari ERA BARU 2026
            foreach ($eraSantri as $key => $data) {
                $santriData[$key] = [
                    'nis' => sprintf('%04d', $nisCounter++),
                    'nama' => $data['nama'],
                    'jenis_kelamin' => 'L',
                    'nisn' => null,
                    'nik' => null,
                    'tempat_lahir' => null,
                    'tanggal_lahir' => null,
                    'anak_ke' => null,
                    'asal_sekolah' => null,
                    'tahun_lulus' => null,
                    'kelas' => $data['kelas_formal'],
                    'alamat' => 'Pondok Pesantren Qomaruddin, Sampurnan Bungah Gresik',
                    'provinsi' => 'Jawa Timur',
                    'kota' => 'Gresik',
                    'kecamatan' => 'Bungah',
                    'kelurahan' => 'Sampurnan',
                    'kode_pos' => '61152',
                    'nama_ayah' => null,
                    'tempat_lahir_ayah' => null,
                    'pekerjaan_ayah' => null,
                    'pendidikan_ayah' => null,
                    'nama_ibu' => null,
                    'tempat_lahir_ibu' => null,
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

        // 1. Setup Komplek Asrama
        $complexes = [
            'KOMPLEK 1' => ['gender' => 'L', 'sort_order' => 1],
            'KOMPLEK 3' => ['gender' => 'L', 'sort_order' => 2],
            'KOMPLEK TAHFIZ' => ['gender' => 'L', 'sort_order' => 3],
        ];

        $complexMap = [];
        foreach ($complexes as $name => $cfg) {
            $complex = BoardingComplex::updateOrCreate(
                ['name' => $name],
                ['sort_order' => $cfg['sort_order'], 'is_active' => true]
            );
            $complexMap[$name] = $complex->id;
        }

        // 2. Setup Kamar Pondok (30 Kamar)
        $rooms = [
            // KOMPLEK 1
            'AL JAELANI' => 'KOMPLEK 1',
            'AL FAROBI' => 'KOMPLEK 1',
            'ABU MANSUR' => 'KOMPLEK 1',
            'IMAM HAMBALI' => 'KOMPLEK 1',
            'IMAM BUKHORI' => 'KOMPLEK 1',
            'ABU HASAN' => 'KOMPLEK 1',
            'SUNAN GUNUNG JATI' => 'KOMPLEK 1',
            'SUNAN BONANG' => 'KOMPLEK 1',
            'SUNAN SENDANG' => 'KOMPLEK 1',
            'SUNAN BEJAGUNG' => 'KOMPLEK 1',
            'SUNAN GIRI' => 'KOMPLEK 1',
            'SUNAN AMPEL' => 'KOMPLEK 1',
            'SUNAN KALIJAGA' => 'KOMPLEK 1',
            'SUNAN MAULANA MALIK IBRAHIM' => 'KOMPLEK 1',

            // KOMPLEK 3
            'IBNU KATSIR' => 'KOMPLEK 3',
            'IBNU ABBAS' => 'KOMPLEK 3',
            'IBNU ROSYID' => 'KOMPLEK 3',
            'IBNU SINA' => 'KOMPLEK 3',
            'IBNU MAJJAH' => 'KOMPLEK 3',
            'IBNU MAS\'UD' => 'KOMPLEK 3',
            'IDAD' => 'KOMPLEK 3',
            'IMAM ABU HANIFAH' => 'KOMPLEK 3',
            'IMAM MALIKI' => 'KOMPLEK 3',
            'IMAM SYAFI\'I' => 'KOMPLEK 3',
            'IMAM NAWAWI' => 'KOMPLEK 3',
            'IBNU AQIL' => 'KOMPLEK 3',
            'IMAM GHOZALI' => 'KOMPLEK 3',

            // KOMPLEK TAHFIZ
            'TAHFIDZ 1' => 'KOMPLEK TAHFIZ',
            'TAHFIDZ 2' => 'KOMPLEK TAHFIZ',
            'TAHFIDZ 3' => 'KOMPLEK TAHFIZ',
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

        // 3. Bersihkan data santri lama (TETAP AMAN: Admin & Guru TIDAK DITIKET)
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

        // 4. Setup Tahun Ajaran
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
                'asal_sekolah' => $data['asal_sekolah'] ?? null,
                'tahun_lulus' => !empty($data['tahun_lulus']) ? substr((string)$data['tahun_lulus'], 0, 4) : null,
                'tahun_akademik_masuk' => '2025/2026',
                'academic_year_id' => $activeYear->id,
                'jenis_santri' => 'Santri Madin',
                'student_type_id' => $studentTypeId,
                'anak_ke' => $data['anak_ke'] ?? null,
                'nama_ayah' => $data['nama_ayah'] ?? null,
                'tempat_lahir_ayah' => $data['tempat_lahir_ayah'] ?? null,
                'pekerjaan_ayah' => $data['pekerjaan_ayah'] ?? null,
                'pendidikan_ayah' => $data['pendidikan_ayah'] ?? null,
                'nama_ibu' => $data['nama_ibu'] ?? null,
                'tempat_lahir_ibu' => $data['tempat_lahir_ibu'] ?? null,
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
                'email_siswa' => $data['email_wali'] ?? null,
            ]);

            DB::table('guardian_student')->insert([
                'guardian_profile_id' => $guardianProfile->id,
                'siswa_id' => $siswa->id,
                'relationship' => 'wali',
                'is_primary' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($statusMondok === 'mondok' && $roomId) {
                $room = BoardingRoom::find($roomId);
                if ($room) {
                    SantriPondok::create([
                        'siswa_id' => $siswa->id,
                        'boarding_complex_id' => $room->boarding_complex_id,
                        'boarding_room_id' => $room->id,
                        'status' => 'Aktif',
                        'is_resident' => true,
                        'participates_prayer' => true,
                        'started_at' => now(),
                    ]);
                }
            }

            SiswaTahunAjaran::create([
                'siswa_id' => $siswa->id,
                'academic_year_id' => $activeYear->id,
                'semester_id' => $activeSemester?->id,
                'tahun_ajaran' => $activeYear->name,
                'semester' => $activeSemester?->name ?? 'Ganjil',
                'class_id' => $siswa->class_id,
                'kelas' => $siswa->kelas,
                'wali_id' => $siswa->wali_id,
                'student_status_id' => $studentStatusId,
                'status_santri' => 'Aktif',
                'is_active' => true,
                'synced_at' => now(),
            ]);

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("=================================================================");
        $this->info("  SUKSES! " . count($santriData) . " SANTRI REAL TELAH BERHASIL DIMIGRASIKAN! ");
        $this->info("=================================================================");

        return 0;
    }
}
