<?php

use App\Models\Siswa;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Pastikan Mas Fahmi satu-satunya Admin Pengurus dengan email resmi fahmi@absensi.com
        $fahmiAdmin = User::where('email', 'fahmi@absensi.com')->first();
        if ($fahmiAdmin) {
            $fahmiAdmin->update([
                'name' => 'Mas Fahmi',
                'role' => 'admin',
                'admin_type' => 'pengurus',
            ]);
        }

        $defaultWaliPassword = Hash::make('wali123');
        $encryptedWaliPassword = Crypt::encryptString('wali123');

        // 2. Perbaiki semua akun wali santri secara bulk cepat (1 query efisien)
        User::where(function ($q) {
                $q->where('email', '!=', 'fahmi@absensi.com')
                  ->orWhereNull('email');
            })
            ->where(function ($q) {
                $q->where('email', 'like', 'wali_%')
                  ->orWhere('email', 'like', 'wali.%')
                  ->orWhere('email', 'like', '%@absensi.local')
                  ->orWhere('email', 'like', '%@wali.pondok.id')
                  ->orWhere('role', 'wali');
            })
            ->update([
                'role' => 'wali',
                'admin_type' => null,
                'password' => $defaultWaliPassword,
                'password_default_encrypted' => $encryptedWaliPassword,
                'password_current_encrypted' => $encryptedWaliPassword,
            ]);
    }

    public function down(): void
    {
        // No reverse needed
    }
};
