<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        $now = now();
        $password = Hash::make('skripsi123');
        $adminRoleId = $this->roleId('admin');
        $guruRoleId = $this->roleId('guru');
        $userStatus = $this->userStatusValues('Aktif');

        foreach ([
            ['username' => 'admin_uji1', 'name' => 'Admin Penguji 1', 'email' => 'admin.uji1@skripsi.local'],
            ['username' => 'admin_uji2', 'name' => 'Admin Penguji 2', 'email' => 'admin.uji2@skripsi.local'],
        ] as $row) {
            $this->upsert('users', ['username' => $row['username']], [
                'name' => $row['name'],
                'email' => $row['email'],
                'password' => $password,
                'password_hash' => $password,
                'role' => 'admin',
                'status_aktif' => true,
            ] + ($adminRoleId ? ['role_id' => $adminRoleId] : []) + $userStatus, $now);
        }

        foreach ([
            [
                'username' => 'guru_uji1',
                'name' => 'Guru Penguji 1',
                'email' => 'guru.uji1@skripsi.local',
                'guru' => 'Ustadz Penguji 1',
                'nip' => 'GUJI001',
                'phone' => '628155936131',
                'kelas' => 'Kelas Pengujian A',
                'tingkat' => 1,
                'santri_prefix' => 'PUA',
            ],
            [
                'username' => 'guru_uji2',
                'name' => 'Guru Penguji 2',
                'email' => 'guru.uji2@skripsi.local',
                'guru' => 'Ustadz Penguji 2',
                'nip' => 'GUJI002',
                'phone' => '62881026496046',
                'kelas' => 'Kelas Pengujian B',
                'tingkat' => 2,
                'santri_prefix' => 'PUB',
            ],
        ] as $row) {
            $this->upsert('users', ['username' => $row['username']], [
                'name' => $row['name'],
                'email' => $row['email'],
                'password' => $password,
                'password_hash' => $password,
                'role' => 'guru',
                'status_aktif' => true,
            ] + ($guruRoleId ? ['role_id' => $guruRoleId] : []) + $userStatus, $now);

            $userId = DB::table('users')->where('username', $row['username'])->value('id');
            $this->upsert('guru', ['id_user' => $userId], [
                'nama_guru' => $row['guru'],
                'nip_nidm' => $row['nip'],
                'nomor_hp' => $row['phone'],
                'alamat' => 'Akun uji coba pengujian black box',
                'status_aktif' => true,
            ], $now);

            $guruId = DB::table('guru')->where('id_user', $userId)->value('id_guru');
            $this->upsert('kelas', ['nama_kelas' => $row['kelas']], [
                'id_guru' => $guruId,
                'tingkat' => $row['tingkat'],
                'status_aktif' => true,
            ], $now);

            $kelasId = DB::table('kelas')->where('nama_kelas', $row['kelas'])->value('id_kelas');
            foreach ([1, 2, 3, 4] as $number) {
                $this->upsert('santri', ['nisn' => $row['santri_prefix'].str_pad((string) $number, 4, '0', STR_PAD_LEFT)], [
                    'id_kelas' => $kelasId,
                    'nama_santri' => 'Santri Pengujian '.$row['santri_prefix'].' '.$number,
                    'jenis_kelamin' => $number % 2 === 0 ? 'P' : 'L',
                    'tgl_lahir' => '2012-01-0'.$number,
                    'alamat' => 'Data santri uji coba',
                    'nama_wali' => 'Wali Santri Uji',
                    'nomor_wa_wali' => $number % 2 === 0 ? '62881026496046' : '628155936131',
                    'status_aktif' => true,
                ], $now);
            }
        }
    }

    public function down(): void
    {
        DB::table('santri')->where('nisn', 'like', 'PUA%')->orWhere('nisn', 'like', 'PUB%')->delete();
        DB::table('kelas')->whereIn('nama_kelas', ['Kelas Pengujian A', 'Kelas Pengujian B'])->delete();
        DB::table('guru')->whereIn('nip_nidm', ['GUJI001', 'GUJI002'])->delete();
        DB::table('users')->whereIn('username', ['admin_uji1', 'admin_uji2', 'guru_uji1', 'guru_uji2'])->delete();
    }

    private function upsert(string $table, array $where, array $values, mixed $now): void
    {
        $exists = DB::table($table)->where($where)->exists();
        if ($exists) {
            DB::table($table)->where($where)->update($values + ['updated_at' => $now]);
            return;
        }

        DB::table($table)->insert($where + $values + ['created_at' => $now, 'updated_at' => $now]);
    }

    private function roleId(string $role): mixed
    {
        if (!Schema::hasColumn('users', 'role_id')) {
            return null;
        }

        $fromUser = DB::table('users')
            ->where('role', $role)
            ->whereNotNull('role_id')
            ->value('role_id');
        if ($fromUser) {
            return $fromUser;
        }

        if (!Schema::hasTable('roles')) {
            return null;
        }

        $columns = Schema::getColumnListing('roles');
        foreach (['slug', 'name', 'code', 'key'] as $column) {
            if (in_array($column, $columns, true)) {
                $id = DB::table('roles')->whereRaw("LOWER($column) = ?", [$role])->value('id');
                if ($id) {
                    return $id;
                }
            }
        }

        return null;
    }

    private function userStatusValues(string $status): array
    {
        $values = [];
        $id = null;

        if (Schema::hasTable('user_statuses')) {
            $columns = Schema::getColumnListing('user_statuses');
            foreach (['name', 'code'] as $column) {
                if (in_array($column, $columns, true)) {
                    $id = DB::table('user_statuses')
                        ->whereRaw("LOWER($column) = ?", [strtolower($status)])
                        ->value('id');
                    if ($id) {
                        break;
                    }
                }
            }
        }

        if (!$id && Schema::hasColumn('users', 'user_status_id')) {
            $id = DB::table('users')
                ->whereNotNull('user_status_id')
                ->value('user_status_id');
        }

        if ($id && Schema::hasColumn('users', 'user_status_id')) {
            $values['user_status_id'] = $id;
        }
        if ($id && Schema::hasColumn('users', 'status_id')) {
            $values['status_id'] = $id;
        }

        return $values;
    }

};
