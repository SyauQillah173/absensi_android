<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        $admins = [
            [
                'name' => 'ABDULLAH SYAUQILLAH',
                'email' => 'syauqillah@absensi.com',
                'role' => 'admin',
                'admin_type' => 'utama',
                'gender' => 'L',
                'status' => 'Aktif',
                'password' => Hash::make('admin123'),
            ],
            [
                'name' => 'Mas Fahmi',
                'email' => 'fahmi@absensi.com',
                'role' => 'admin',
                'admin_type' => 'utama',
                'gender' => 'L',
                'status' => 'Aktif',
                'password' => Hash::make('admin123'),
            ],
            [
                'name' => 'Mas Udin',
                'email' => 'udin@absensi.com',
                'role' => 'admin',
                'admin_type' => 'bendahara_1',
                'gender' => 'L',
                'status' => 'Aktif',
                'password' => Hash::make('admin123'),
            ],
            [
                'name' => 'Mas Wildan',
                'email' => 'wildan@absensi.com',
                'role' => 'admin',
                'admin_type' => 'bendahara_2',
                'gender' => 'L',
                'status' => 'Aktif',
                'password' => Hash::make('admin123'),
            ],
            [
                'name' => 'Bapak Erwin',
                'email' => 'erwin@absensi.com',
                'role' => 'admin',
                'admin_type' => 'kepala_sekolah',
                'gender' => 'L',
                'status' => 'Aktif',
                'password' => Hash::make('admin123'),
            ],
        ];

        foreach ($admins as $item) {
            $user = User::where('email', $item['email'])
                ->orWhere('name', $item['name'])
                ->first();

            if ($user) {
                $user->update([
                    'name' => $item['name'],
                    'email' => $item['email'],
                    'role' => $item['role'],
                    'admin_type' => $item['admin_type'],
                    'gender' => $item['gender'],
                    'status' => $item['status'],
                    'password' => $item['password'],
                ]);
            } else {
                User::create($item);
            }
        }
    }

    public function down(): void
    {
        // Safe keep
    }
};
