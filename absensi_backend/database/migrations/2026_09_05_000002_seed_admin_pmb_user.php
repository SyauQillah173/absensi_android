<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $defaultPassword = 'admin123';
        User::firstOrCreate(
            ['email' => 'admin.pmb@absensi.com'],
            [
                'name' => 'Panitia PMB Qomaruddin',
                'role' => 'admin',
                'admin_type' => 'pmb',
                'nis' => 'ADM_PMB_01',
                'no_hp' => '081234567890',
                'status' => 'Aktif',
                'password' => Hash::make($defaultPassword),
                'password_default_encrypted' => Crypt::encryptString($defaultPassword),
            ]
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        User::where('email', 'admin.pmb@absensi.com')->delete();
    }
};
