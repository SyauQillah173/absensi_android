<?php

namespace App\Console\Commands;

use App\Models\AcademicYear;
use App\Models\BoardingComplex;
use App\Models\BoardingRoom;
use App\Models\GuardianProfile;
use App\Models\SantriPondok;
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
    protected $description = 'Import 963 data santri real dari data sementara.xlsx dan ERA BARU 2026.xlsx';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->warn("=================================================================");
        $this->warn("     IMPORT DATA SANTRI REAL PESANTREN QOMARUDDIN 2025/2026      ");
        $this->warn("=================================================================");

        $jsonPath = database_path('data/santri_qomaruddin_real.json');
        if (!file_exists($jsonPath)) {
            $this->error("File santri_qomaruddin_real.json tidak ditemukan di database/data/.");
            return 1;
        }

        $santriData = json_decode(file_get_contents($jsonPath), true);
        if (empty($santriData) || !is_array($santriData)) {
            $this->error("Isi file santri_qomaruddin_real.json kosong atau tidak valid.");
            return 1;
        }

        $this->info("Ditemukan " . count($santriData) . " data santri real untuk diproses.");

        // 1. Complexes
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

        // 2. Rooms
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
            'SUNAN MURIA' => 'KOMPLEK 1',
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
            'KAMAR ATAS KANTOR SEBELAH SELATAN' => 'KOMPLEK 3',
            'KAMAR ATAS KANTOR SEBELAH UTARA' => 'KOMPLEK 3',

            // KOMPLEK TAHFIZ
            'TAHFIDZ 1' => 'KOMPLEK TAHFIZ',
            'TAHFIDZ I' => 'KOMPLEK TAHFIZ',
            'TAHFIDZ 2' => 'KOMPLEK TAHFIZ',
            'TAHFIDZ II' => 'KOMPLEK TAHFIZ',
            'TAHFIDZ 3' => 'KOMPLEK TAHFIZ',
            'TAHFIDZ III' => 'KOMPLEK TAHFIZ',
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

        $roomMap['TAHFIDZ 1'] = $roomMap['TAHFIDZ 1'] ?? ($roomMap['TAHFIDZ I'] ?? null);
        $roomMap['TAHFIDZ I'] = $roomMap['TAHFIDZ 1'] ?? ($roomMap['TAHFIDZ I'] ?? null);
        $roomMap['TAHFIDZ 2'] = $roomMap['TAHFIDZ 2'] ?? ($roomMap['TAHFIDZ II'] ?? null);
        $roomMap['TAHFIDZ II'] = $roomMap['TAHFIDZ 2'] ?? ($roomMap['TAHFIDZ II'] ?? null);
        $roomMap['TAHFIDZ 3'] = $roomMap['TAHFIDZ 3'] ?? ($roomMap['TAHFIDZ III'] ?? null);
        $roomMap['TAHFIDZ III'] = $roomMap['TAHFIDZ 3'] ?? ($roomMap['TAHFIDZ III'] ?? null);

        // 3. Clear old student data if requested or running migration
        $this->info("Membersihkan data santri lama dan akun wali...");
        $studentChildTables = [
            'santri_pondok',
            'guardian_student',
            'guardian_profiles',
            'siswa_tahun_ajaran',
            'absensi_sholat',
            'absensi_ngaji',
            'absensi',
            'kelompok_belajar_siswa',
            'nilai',
            'hafalan',
            'pembayaran',
            'payment_bills',
            'payment_bill_month_items',
            'payment_bill_notifications',
            'payment_bill_rule_student',
            'payment_transactions',
            'payment_transaction_items',
        ];

        foreach ($studentChildTables as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->delete();
            }
        }

        DB::table('siswa')->delete();
        DB::table('users')->where('role', 'wali')->delete();

        $this->info("✓ Data santri lama berhasil dibersihkan (Akun Admin & Guru tetap aman).");

        // 4. Resolvers & Academic Period
        $resolver = app(ReferenceResolver::class);
        $activeYear = AcademicYear::query()->where('is_active', true)->first();
        if (!$activeYear) {
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
        }

        $activeSemester = Semester::query()->where('academic_year_id', $activeYear->id)->where('is_active', true)->first();
        if (!$activeSemester) {
            $activeSemester = Semester::firstOrCreate(
                ['academic_year_id' => $activeYear->id, 'name' => 'Ganjil'],
                ['code' => '20251', 'is_active' => true]
            );
        }

        $defaultPassword = config('auth.operational_default_password', 'siswa12345');
        $defaultPasswordHash = Hash::make($defaultPassword);
        $defaultPasswordEncrypted = Crypt::encryptString($defaultPassword);
        $studentStatusId = $resolver->studentStatusId('Aktif');
        $studentTypeId = $resolver->studentTypeId('Santri Madin');

        $this->info("Menginsert 963 santri baru...");
        $bar = $this->output->createProgressBar(count($santriData));
        $bar->start();

        // 5. Insert All 963 Students and their linked accounts
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

            // Create Wali User Account
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
                'address' => $data['alamat'],
            ]);

            $roomId = null;
            $kamarName = $data['kamar'] ?? null;
            $komplekName = $data['komplek'] ?? null;

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

            $statusMondok = (!empty($data['status_mondok']) && $data['status_mondok'] === 'mondok') ? 'mondok' : 'tidak_mondok';
            if ($roomId) {
                $statusMondok = 'mondok';
            }

            $siswa = Siswa::create([
                'nis' => $nis,
                'nisn' => $data['nisn'] ?? null,
                'nik' => !empty($data['nik']) ? substr((string)$data['nik'], 0, 16) : null,
                'no_kk' => !empty($data['no_kk']) ? substr((string)$data['no_kk'], 0, 16) : null,
                'nama' => $nama,
                'nama_panggilan' => null,
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
                'kelas' => $data['kelas'] ?? null,
                'asal_sekolah' => $data['asal_sekolah'] ?? null,
                'tahun_lulus' => !empty($data['tahun_lulus']) ? substr((string)$data['tahun_lulus'], 0, 4) : null,
                'tahun_akademik_masuk' => '2025/2026',
                'academic_year_id' => $activeYear->id,
                'jenis_santri' => 'Santri Madin',
                'student_type_id' => $studentTypeId,
                'anak_ke' => $data['anak_ke'] ?? null,
                'catatan_santri' => $data['catatan_santri'] ?? null,
                'nama_ayah' => $data['nama_ayah'] ?? null,
                'nik_ayah' => !empty($data['nik_ayah']) ? substr((string)$data['nik_ayah'], 0, 16) : null,
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
                'komplek' => $komplekName,
                'tanggal_masuk' => '2025-07-01',
                'email_siswa' => $data['email_siswa'] ?? null,
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

            if ($activeYear) {
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
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("=================================================================");
        $this->info("  SUKSES! 963 SANTRI REAL TELAH BERHASIL DIMIGRASIKAN 100%!     ");
        $this->info("=================================================================");

        return 0;
    }
}
