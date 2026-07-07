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

        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Admin Madrasah',
                'email' => 'admin@skripsi.local',
                'password' => Hash::make($password),
                'password_hash' => Hash::make($password),
                'role' => 'admin',
                'status' => 'Aktif',
                'status_aktif' => true,
            ]
        );

        $guruUser = User::updateOrCreate(
            ['username' => 'guru'],
            [
                'name' => 'Ustadz Ahmad',
                'email' => 'guru@skripsi.local',
                'password' => Hash::make($password),
                'password_hash' => Hash::make($password),
                'role' => 'guru',
                'status' => 'Aktif',
                'status_aktif' => true,
                'no_hp' => '6282111111111',
            ]
        );
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
        Santri::updateOrCreate(
            ['nisn' => '0060012345'],
            [
                'id_kelas' => $kelas->id_kelas,
                'nama_santri' => 'Ali Hasan',
                'jenis_kelamin' => 'L',
                'nama_wali' => 'Hasan Basri',
                'nomor_wa_wali' => '6283111111111',
                'status_aktif' => true,
            ]
        );
    }
}
