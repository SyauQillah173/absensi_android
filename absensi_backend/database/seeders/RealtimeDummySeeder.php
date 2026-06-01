<?php

namespace Database\Seeders;

use App\Models\Jadwal;
use App\Models\MataPelajaran;
use App\Models\SchoolClass;
use App\Models\SchoolOrigin;
use App\Models\Siswa;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RealtimeDummySeeder extends Seeder
{
    public function run(): void
    {
        $password = config('auth.operational_default_password', 'password');

        $this->seedSchoolOrigins();
        $this->seedClasses();

        $guru = $this->seedGuru($password);
        $mapel = $this->seedMapel($guru);
        $this->seedSchedules($guru, $mapel);
        $this->seedStudentsAndGuardians($password);
    }

    private function seedSchoolOrigins(): void
    {
        foreach ($this->schoolOrigins() as $origin) {
            SchoolOrigin::updateOrCreate(
                ['code' => $origin['code']],
                [
                    'name' => $origin['name'],
                    'is_active' => true,
                ]
            );
        }
    }

    private function seedClasses(): void
    {
        foreach ($this->classes() as $row) {
            $levelId = DB::table('class_levels')->where('code', $row['level_code'])->value('id');
            SchoolClass::updateOrCreate(
                ['code' => $row['code']],
                [
                    'class_level_id' => $levelId,
                    'name' => $row['name'],
                    'gender_group' => $row['gender_group'],
                    'category' => $row['category'],
                    'is_active' => true,
                ]
            );
        }
    }

    private function seedGuru(string $password): User
    {
        return User::updateOrCreate(
            ['email' => 'guru.realtime@absensi.local'],
            [
                'name' => 'Ustadz Mahmud Hidayat',
                'role' => 'guru',
                'nis' => 'GRRT01',
                'nisn' => null,
                'kode_guru' => 'GRRT01',
                'no_hp' => '082233440001',
                'jenis_kelamin' => 'L',
                'status' => 'Aktif',
                'unit_kerja' => ['Madin'],
                'kategori_guru' => ['Guru'],
                'password' => Hash::make($password),
                'password_default_encrypted' => Crypt::encryptString($password),
                'password_current_encrypted' => null,
                'password_changed_at' => null,
            ]
        );
    }

    private function seedMapel(User $guru): MataPelajaran
    {
        $mapel = MataPelajaran::updateOrCreate(
            ['kode' => 'AKH'],
            [
                'nama' => 'AKHLAQ',
                'status' => 'Aktif',
            ]
        );

        $mapel->guru()->syncWithoutDetaching([$guru->id]);

        return $mapel;
    }

    private function seedSchedules(User $guru, MataPelajaran $mapel): void
    {
        $dayId = DB::table('days')->where('name', 'Selasa')->value('id');
        $targets = [
            ['class' => 'Sifir Awal A PA', 'start' => '15:30', 'end' => '16:15'],
            ['class' => 'Sifir Awal F PI', 'start' => '16:20', 'end' => '17:05'],
        ];

        foreach ($targets as $target) {
            $class = SchoolClass::where('name', $target['class'])->first();
            if (!$class) {
                continue;
            }

            Jadwal::updateOrCreate(
                [
                    'mapel_id' => $mapel->id,
                    'teacher_id' => $guru->id,
                    'day_id' => $dayId,
                    'class_id' => $class->id,
                ],
                [
                    'guru' => $guru->name,
                    'hari' => 'Selasa',
                    'jam_mulai' => $target['start'],
                    'jam_selesai' => $target['end'],
                    'sifir' => $class->name,
                    'status' => 'Aktif',
                ]
            );
        }
    }

    private function seedStudentsAndGuardians(string $password): void
    {
        $students = $this->students();
        foreach ($students as $index => $student) {
            $wali = User::updateOrCreate(
                ['email' => $student['wali_email']],
                [
                    'name' => $student['wali_name'],
                    'role' => 'wali',
                    'nis' => 'WLRT' . str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
                    'nisn' => null,
                    'no_hp' => $student['phone'],
                    'jenis_kelamin' => $student['wali_gender'],
                    'status' => 'Aktif',
                    'password' => Hash::make($password),
                    'password_default_encrypted' => Crypt::encryptString($password),
                    'password_current_encrypted' => null,
                    'password_changed_at' => null,
                ]
            );

            $guardianProfileId = $this->syncGuardianProfile($wali, $student);
            $class = SchoolClass::where('name', $student['kelas'])->first();
            $schoolOrigin = SchoolOrigin::where('code', $student['school_origin_code'])->first();

            $siswa = Siswa::updateOrCreate(
                ['nis' => $student['nis']],
                [
                    'nisn' => $student['nisn'],
                    'nama' => $student['nama'],
                    'nama_panggilan' => $student['nama_panggilan'],
                    'tempat_lahir' => 'Gresik',
                    'tanggal_lahir' => $student['tanggal_lahir'],
                    'jenis_kelamin' => $student['jenis_kelamin'],
                    'nama_wali' => $wali->name,
                    'no_telepon_wali' => $wali->no_hp,
                    'kelas' => $student['kelas'],
                    'class_id' => $class?->id,
                    'status' => 'Aktif',
                    'alamat' => $student['alamat'],
                    'asal_sekolah' => $schoolOrigin?->name,
                    'school_origin_id' => $schoolOrigin?->id,
                    'nama_ayah' => $student['ayah'],
                    'nama_ibu' => $student['ibu'],
                    'nama_wali_keluarga' => $wali->name,
                    'alamat_wali_keluarga' => $student['alamat'],
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

    private function syncGuardianProfile(User $wali, array $student): int
    {
        DB::table('guardian_profiles')->updateOrInsert(
            ['user_id' => $wali->id],
            [
                'name' => $wali->name,
                'phone' => $wali->no_hp,
                'address' => $student['alamat'],
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return (int) DB::table('guardian_profiles')
            ->where('user_id', $wali->id)
            ->value('id');
    }

    private function classes(): array
    {
        $rows = [];
        foreach ([
            ['label' => 'Sifir Awal', 'code' => 'awal'],
            ['label' => 'Sifir Tsani', 'code' => 'tsani'],
            ['label' => 'Sifir Tsalis', 'code' => 'tsalis'],
            ['label' => "Sifir Robi'", 'code' => 'robi'],
            ['label' => 'Sifir Khomis', 'code' => 'khomis'],
            ['label' => 'Sifir Sadis', 'code' => 'sadis'],
        ] as $level) {
            foreach (['PA' => ['A', 'B', 'C', 'D', 'E'], 'PI' => ['F', 'G', 'H', 'I', 'J']] as $gender => $letters) {
                foreach ($letters as $letter) {
                    $name = "{$level['label']} {$letter} {$gender}";
                    $rows[] = [
                        'level_code' => $level['code'],
                        'code' => Str::of($name)->lower()->slug('_')->toString(),
                        'name' => $name,
                        'gender_group' => $gender,
                        'category' => "{$level['label']} {$gender}",
                    ];
                }
            }
        }

        return $rows;
    }

    private function schoolOrigins(): array
    {
        return [
            ['code' => 'sd_negeri', 'name' => 'SD Negeri'],
            ['code' => 'mi', 'name' => 'MI'],
            ['code' => 'smp_negeri', 'name' => 'SMP Negeri'],
            ['code' => 'mts', 'name' => 'MTs'],
            ['code' => 'sma_negeri', 'name' => 'SMA Negeri'],
            ['code' => 'ma', 'name' => 'MA'],
            ['code' => 'smk', 'name' => 'SMK'],
            ['code' => 'pondok_pesantren', 'name' => 'Pondok Pesantren'],
            ['code' => 'mi_assaadah_bungah', 'name' => "MI Assa'adah Bungah, Gresik"],
            ['code' => 'sdn_bungah_1', 'name' => 'SDN Bungah 1, Gresik'],
            ['code' => 'mts_qomaruddin', 'name' => 'MTs Qomaruddin Bungah, Gresik'],
            ['code' => 'pondok_qomaruddin', 'name' => 'Pondok Pesantren Qomaruddin, Gresik'],
        ];
    }

    private function students(): array
    {
        return [
            ['nis' => 'RT2026001', 'nisn' => '0067010001', 'nama' => 'Ahmad Zaki Maulana', 'nama_panggilan' => 'Zaki', 'jenis_kelamin' => 'L', 'tanggal_lahir' => '2015-01-12', 'kelas' => 'Sifir Awal A PA', 'wali_name' => 'Wali Ahmad Fauzan', 'wali_email' => 'wali.rt01@absensi.local', 'wali_gender' => 'L', 'phone' => '083800000001', 'ayah' => 'Fauzan', 'ibu' => 'Mufidah', 'alamat' => 'Jl. Bungah Indah No. 1', 'school_origin_code' => 'sdn_bungah_1'],
            ['nis' => 'RT2026002', 'nisn' => '0067010002', 'nama' => 'Muhammad Farhan Hakim', 'nama_panggilan' => 'Farhan', 'jenis_kelamin' => 'L', 'tanggal_lahir' => '2015-02-18', 'kelas' => 'Sifir Awal A PA', 'wali_name' => 'Wali Abdul Hakim', 'wali_email' => 'wali.rt02@absensi.local', 'wali_gender' => 'L', 'phone' => '083800000002', 'ayah' => 'Abdul Hakim', 'ibu' => 'Latifah', 'alamat' => 'Jl. Pesantren No. 2', 'school_origin_code' => 'mi_assaadah_bungah'],
            ['nis' => 'RT2026003', 'nisn' => '0067010003', 'nama' => 'Ali Ridho Hidayat', 'nama_panggilan' => 'Ridho', 'jenis_kelamin' => 'L', 'tanggal_lahir' => '2015-03-20', 'kelas' => 'Sifir Awal A PA', 'wali_name' => 'Wali Hidayatullah', 'wali_email' => 'wali.rt03@absensi.local', 'wali_gender' => 'L', 'phone' => '083800000003', 'ayah' => 'Hidayatullah', 'ibu' => 'Aminah', 'alamat' => 'Jl. Masjid No. 3', 'school_origin_code' => 'sd_negeri'],
            ['nis' => 'RT2026004', 'nisn' => '0067010004', 'nama' => 'Hasan Basri Naufal', 'nama_panggilan' => 'Naufal', 'jenis_kelamin' => 'L', 'tanggal_lahir' => '2015-04-11', 'kelas' => 'Sifir Awal A PA', 'wali_name' => 'Wali Basri Mustofa', 'wali_email' => 'wali.rt04@absensi.local', 'wali_gender' => 'L', 'phone' => '083800000004', 'ayah' => 'Basri Mustofa', 'ibu' => 'Khoiriyah', 'alamat' => 'Jl. Sunan Giri No. 4', 'school_origin_code' => 'pondok_qomaruddin'],
            ['nis' => 'RT2026005', 'nisn' => '0067010005', 'nama' => 'Umar Al Faruq', 'nama_panggilan' => 'Umar', 'jenis_kelamin' => 'L', 'tanggal_lahir' => '2015-05-09', 'kelas' => 'Sifir Awal A PA', 'wali_name' => 'Wali Faruq Hasan', 'wali_email' => 'wali.rt05@absensi.local', 'wali_gender' => 'L', 'phone' => '083800000005', 'ayah' => 'Faruq Hasan', 'ibu' => 'Salamah', 'alamat' => 'Jl. Madrasah No. 5', 'school_origin_code' => 'mi'],
            ['nis' => 'RT2026006', 'nisn' => '0067010006', 'nama' => 'Aisyah Zahra Putri', 'nama_panggilan' => 'Zahra', 'jenis_kelamin' => 'P', 'tanggal_lahir' => '2015-06-14', 'kelas' => 'Sifir Awal F PI', 'wali_name' => 'Wali Siti Rohmah', 'wali_email' => 'wali.rt06@absensi.local', 'wali_gender' => 'P', 'phone' => '083800000006', 'ayah' => 'Muhammad Ridwan', 'ibu' => 'Siti Rohmah', 'alamat' => 'Jl. Kenanga No. 6', 'school_origin_code' => 'mi_assaadah_bungah'],
            ['nis' => 'RT2026007', 'nisn' => '0067010007', 'nama' => 'Khadijah Nur Laila', 'nama_panggilan' => 'Laila', 'jenis_kelamin' => 'P', 'tanggal_lahir' => '2015-07-07', 'kelas' => 'Sifir Awal F PI', 'wali_name' => 'Wali Nur Hayati', 'wali_email' => 'wali.rt07@absensi.local', 'wali_gender' => 'P', 'phone' => '083800000007', 'ayah' => 'Taufiq Rahman', 'ibu' => 'Nur Hayati', 'alamat' => 'Jl. Mawar No. 7', 'school_origin_code' => 'sdn_bungah_1'],
            ['nis' => 'RT2026008', 'nisn' => '0067010008', 'nama' => 'Maryam Shofiyah', 'nama_panggilan' => 'Maryam', 'jenis_kelamin' => 'P', 'tanggal_lahir' => '2015-08-23', 'kelas' => 'Sifir Awal F PI', 'wali_name' => 'Wali Shofiyah Amin', 'wali_email' => 'wali.rt08@absensi.local', 'wali_gender' => 'P', 'phone' => '083800000008', 'ayah' => 'Aminuddin', 'ibu' => 'Shofiyah', 'alamat' => 'Jl. Melati No. 8', 'school_origin_code' => 'pondok_pesantren'],
            ['nis' => 'RT2026009', 'nisn' => '0067010009', 'nama' => 'Hana Muthmainnah', 'nama_panggilan' => 'Hana', 'jenis_kelamin' => 'P', 'tanggal_lahir' => '2015-09-30', 'kelas' => 'Sifir Awal F PI', 'wali_name' => 'Wali Muthmainnah', 'wali_email' => 'wali.rt09@absensi.local', 'wali_gender' => 'P', 'phone' => '083800000009', 'ayah' => 'Syaiful Anam', 'ibu' => 'Muthmainnah', 'alamat' => 'Jl. Dahlia No. 9', 'school_origin_code' => 'sd_negeri'],
            ['nis' => 'RT2026010', 'nisn' => '0067010010', 'nama' => 'Salma Nabila Rahma', 'nama_panggilan' => 'Salma', 'jenis_kelamin' => 'P', 'tanggal_lahir' => '2015-10-19', 'kelas' => 'Sifir Awal F PI', 'wali_name' => 'Wali Rahmawati', 'wali_email' => 'wali.rt10@absensi.local', 'wali_gender' => 'P', 'phone' => '083800000010', 'ayah' => 'Miftahul Huda', 'ibu' => 'Rahmawati', 'alamat' => 'Jl. Flamboyan No. 10', 'school_origin_code' => 'mts_qomaruddin'],
        ];
    }
}
