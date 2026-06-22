<?php

namespace Database\Seeders;

use App\Models\MataPelajaran;
use App\Models\Siswa;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $defaultPassword = config('auth.operational_default_password');

        User::updateOrCreate(
            ['email' => 'admin@absensi.com'],
            [
                'name' => 'Admin Madrasah',
                'role' => 'admin',
                'nis' => 'ADM001',
                'nisn' => null,
                'no_hp' => '081111111111',
                'status' => 'Aktif',
                'password' => Hash::make($defaultPassword),
                'password_default_encrypted' => Crypt::encryptString($defaultPassword),
                'password_current_encrypted' => null,
                'password_changed_at' => null,
            ]
        );

        $this->seedReferenceComplements();
        $this->seedMataPelajaran();
        $this->call(SiswaSeeder::class);
        $this->seedTestAccounts($defaultPassword);
    }

    private function seedReferenceComplements(): void
    {
        DB::table('assessment_types')->updateOrInsert(
            ['code' => 'hafalan'],
            [
                'name' => 'Hafalan',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    private function seedMataPelajaran(): void
    {
        $mapelData = [
            ['nama' => 'TAFSIR', 'kode' => 'TAF'],
            ['nama' => 'HADITS', 'kode' => 'HAD'],
            ['nama' => 'FIQIH', 'kode' => 'FIQ'],
            ['nama' => 'NAHWU', 'kode' => 'NAH'],
            ['nama' => 'SHOROF', 'kode' => 'SHO'],
            ['nama' => 'AQIDAH', 'kode' => 'AQI'],
            ['nama' => 'AKHLAQ', 'kode' => 'AKH'],
            ['nama' => 'TAJWID', 'kode' => 'TAJ'],
            ['nama' => 'TARIKH', 'kode' => 'TAR'],
            ['nama' => 'IMLA', 'kode' => 'IML'],
            ['nama' => 'INSYA', 'kode' => 'INS'],
            ['nama' => 'PEGO', 'kode' => 'PEG'],
            ['nama' => 'TAUHID', 'kode' => 'TAU'],
            ['nama' => 'BMK', 'kode' => 'BMK'],
            ['nama' => 'TAHAJI', 'kode' => 'THJ'],
            ['nama' => 'BALAGHO', 'kode' => 'BLG'],
            ['nama' => 'USHUL FIQIH', 'kode' => 'USF'],
            ['nama' => 'QOWAID FIQIH', 'kode' => 'QWF', 'status' => 'Nonaktif'],
        ];

        foreach ($mapelData as $mapel) {
            MataPelajaran::updateOrCreate(
                ['kode' => $mapel['kode']],
                [
                    'nama' => $mapel['nama'],
                    'status' => $mapel['status'] ?? 'Aktif',
                ]
            );
        }
    }

    private function seedTestAccounts(string $defaultPassword): void
    {
        foreach ($this->testUsers() as $userData) {
            User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    ...$userData,
                    'password' => Hash::make($defaultPassword),
                    'password_default_encrypted' => Crypt::encryptString($defaultPassword),
                    'password_current_encrypted' => null,
                    'password_changed_at' => null,
                ]
            );
        }

        foreach ($this->testWaliStudents() as $studentData) {
            $wali = User::where('email', $studentData['wali_email'])->first();
            if (!$wali) {
                continue;
            }

            $guardianProfileId = $this->syncGuardianProfile($wali, $studentData);

            $siswa = Siswa::updateOrCreate(
                ['nis' => $studentData['nis']],
                [
                    'nisn' => $studentData['nisn'],
                    'nama' => $studentData['nama'],
                    'nama_panggilan' => $studentData['nama_panggilan'],
                    'tempat_lahir' => $studentData['tempat_lahir'],
                    'tanggal_lahir' => $studentData['tanggal_lahir'],
                    'jenis_kelamin' => $studentData['jenis_kelamin'],
                    'nama_wali' => $wali->name,
                    'no_telepon_wali' => $wali->no_hp,
                    'kelas' => $studentData['kelas'],
                    'status' => 'Aktif',
                    'alamat' => $studentData['alamat'],
                    'nama_ayah' => $studentData['nama_ayah'],
                    'nama_ibu' => $studentData['nama_ibu'],
                    'nama_wali_keluarga' => $wali->name,
                    'alamat_wali_keluarga' => $studentData['alamat'],
                    'wali_sama_dengan' => 'Wali',
                    'tahun_akademik_masuk' => '2025/2026',
                    'jenis_santri' => 'Santri Madin',
                    'tanggal_masuk' => '2025-07-01',
                    'wali_id' => $wali->id,
                    'guardian_profile_id' => $guardianProfileId,
                ]
            );

            DB::table('guardian_student')->updateOrInsert(
                [
                    'guardian_profile_id' => $guardianProfileId,
                    'siswa_id' => $siswa->id,
                ],
                [
                    'relationship' => 'wali',
                    'is_primary' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function testUsers(): array
    {
        return [
            [
                'name' => 'Admin Madrasah 2',
                'email' => 'admin2@absensi.com',
                'role' => 'admin',
                'nis' => 'ADM002',
                'nisn' => null,
                'no_hp' => '081111111112',
                'status' => 'Aktif',
            ],
            [
                'name' => 'Ustadz Ahmad Fauzi',
                'email' => 'guru1@absensi.com',
                'role' => 'guru',
                'nis' => 'GR001',
                'nisn' => null,
                'kode_guru' => 'GR001',
                'no_hp' => '082111111111',
                'jenis_kelamin' => 'L',
                'status' => 'Aktif',
                'unit_kerja' => ['Madin'],
                'kategori_guru' => ['Guru'],
            ],
            [
                'name' => 'Ustadzah Siti Aminah',
                'email' => 'guru2@absensi.com',
                'role' => 'guru',
                'nis' => 'GR002',
                'nisn' => null,
                'kode_guru' => 'GR002',
                'no_hp' => '082111111112',
                'jenis_kelamin' => 'P',
                'status' => 'Aktif',
                'unit_kerja' => ['Madin'],
                'kategori_guru' => ['Guru'],
            ],
            [
                'name' => 'Wali Hasan Basri',
                'email' => 'wali1@absensi.local',
                'role' => 'wali',
                'nis' => 'WLI001',
                'nisn' => null,
                'no_hp' => '083111111111',
                'jenis_kelamin' => 'L',
                'status' => 'Aktif',
            ],
            [
                'name' => 'Wali Nur Aisyah',
                'email' => 'wali2@absensi.local',
                'role' => 'wali',
                'nis' => 'WLI002',
                'nisn' => null,
                'no_hp' => '083111111112',
                'jenis_kelamin' => 'P',
                'status' => 'Aktif',
            ],
        ];
    }

    private function testWaliStudents(): array
    {
        return [
            [
                'wali_email' => 'wali1@absensi.local',
                'nis' => '2026001',
                'nisn' => '0060012345',
                'nama' => 'Ali Hasan',
                'nama_panggilan' => 'Ali',
                'tempat_lahir' => 'Gresik',
                'tanggal_lahir' => '2015-04-12',
                'jenis_kelamin' => 'L',
                'kelas' => 'Sifir Awal A PA',
                'alamat' => 'Jl. Pendidikan No. 1',
                'nama_ayah' => 'Hasan Basri',
                'nama_ibu' => 'Maryam',
            ],
            [
                'wali_email' => 'wali2@absensi.local',
                'nis' => '2026002',
                'nisn' => '0060012346',
                'nama' => 'Fatimah Aisyah',
                'nama_panggilan' => 'Fatimah',
                'tempat_lahir' => 'Gresik',
                'tanggal_lahir' => '2015-08-20',
                'jenis_kelamin' => 'P',
                'kelas' => 'Sifir Awal F PI',
                'alamat' => 'Jl. Pesantren No. 2',
                'nama_ayah' => 'Abdul Karim',
                'nama_ibu' => 'Nur Aisyah',
            ],
        ];
    }

    private function syncGuardianProfile(User $wali, array $studentData): int
    {
        DB::table('guardian_profiles')->updateOrInsert(
            ['user_id' => $wali->id],
            [
                'name' => $wali->name,
                'phone' => $wali->no_hp,
                'address' => $studentData['alamat'],
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return (int) DB::table('guardian_profiles')
            ->where('user_id', $wali->id)
            ->value('id');
    }
}
