<?php

namespace Database\Seeders;

use App\Models\Guru;
use App\Models\Kelas;
use App\Models\Santri;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SEED_DEFAULT_PASSWORD', 'skripsi123');

        $this->upsertUser('admin', 'admin', [
            'name' => 'Admin Madrasah',
            'email' => 'admin@skripsi.local',
            'password' => Hash::make($password),
            'password_hash' => Hash::make($password),
            'role' => 'admin',
            'status' => 'Aktif',
            'status_aktif' => true,
        ]);

        $guruUser = $this->upsertUser('guru', 'guru', [
            'name' => 'Ustadz Ahmad',
            'email' => 'guru@skripsi.local',
            'password' => Hash::make($password),
            'password_hash' => Hash::make($password),
            'role' => 'guru',
            'status' => 'Aktif',
            'status_aktif' => true,
            'no_hp' => '6282111111111',
        ]);
        $guru = Guru::updateOrCreate(
            ['id_user' => $guruUser->id],
            [
                'nama_guru' => 'Ustadz Ahmad',
                'nip_nidm' => 'GR001',
                'nomor_hp' => '6282111111111',
                'status_aktif' => true,
            ]
        );
        $kelas = Kelas::updateOrCreate(
            ['nama_kelas' => 'Kelas 1'],
            ['id_guru' => $guru->id_guru, 'tingkat' => 1, 'status_aktif' => true]
        );
        $demoSantri = [
            ['5150', 'KEYSYA NABILA', 'P', 'Wali Keysha', '08155936131'],
            ['5151', 'Ali Hasan', 'L', 'Hasan Basri', '0881026496046'],
            ['5152', 'Siti Aisyah', 'P', 'Wali Siti Aisyah', '08155936131'],
            ['5153', 'Muhammad Rizky', 'L', 'Wali Muhammad Rizky', '0881026496046'],
            ['5154', 'Nur Azizah', 'P', 'Wali Nur Azizah', '08155936131'],
        ];

        foreach ($demoSantri as [$nisn, $nama, $jk, $wali, $nomor]) {
            Santri::updateOrCreate(
                ['nisn' => $nisn],
                [
                    'id_kelas' => $kelas->id_kelas,
                    'nama_santri' => $nama,
                    'jenis_kelamin' => $jk,
                    'nama_wali' => $wali,
                    'nomor_wa_wali' => $nomor,
                    'status_aktif' => true,
                ]
            );
        }
    }

    private function upsertUser(string $username, string $role, array $values): User
    {
        $user = User::query()
            ->where('username', $username)
            ->orWhere(function ($query) use ($role): void {
                $query->where('role', $role)->orderBy('id');
            })
            ->first();

        if ($user) {
            $user->forceFill(['username' => $username] + $values)->save();
            return $user->refresh();
        }

        return User::create(['username' => $username] + $values);
    }
}
