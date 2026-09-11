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

        // 2. Perbaiki semua akun yang keliru ter-update menjadi 'Mas Fahmi' / 'pengurus',
        // padahal mereka adalah akun Wali Santri
        $mistakenUsers = User::where(function ($q) {
                $q->where('email', '!=', 'fahmi@absensi.com')
                  ->orWhereNull('email');
            })
            ->where(function ($q) {
                $q->where('email', 'like', 'wali_%')
                  ->orWhere('email', 'like', 'wali.%')
                  ->orWhere('email', 'like', '%@absensi.local')
                  ->orWhere('email', 'like', '%@wali.pondok.id')
                  ->orWhere('name', 'Mas Fahmi')
                  ->orWhere('role', 'wali');
            })
            ->get();

        foreach ($mistakenUsers as $user) {
            // Cari siswa terkait
            $siswa = Siswa::where('wali_id', $user->id)
                ->orWhere('id', $user->santri_id ?? 0)
                ->first();

            // Tentukan nama yang benar jika sebelumnya tertimpa Mas Fahmi
            $correctName = $user->name;
            if ($user->name === 'Mas Fahmi' || empty($user->name)) {
                if ($siswa) {
                    $correctName = $siswa->nama_wali ?: ($siswa->nama_ayah ?: ('Wali ' . $siswa->nama));
                } else {
                    $correctName = 'Wali Santri';
                }
            }

            // Tentukan NIS santri agar wali bisa login via NIS
            $nis = $user->nis;
            if (empty($nis) && $siswa && !empty($siswa->nis)) {
                $nis = $siswa->nis;
            }

            $updateData = [
                'name' => $correctName,
                'role' => 'wali',
                'admin_type' => null,
                'email' => null, // KOSONGKAN EMAIL WALI
                'nis' => $nis,
                'password_default_encrypted' => $encryptedWaliPassword,
            ];

            // Jika user belum pernah mengganti sandi mandiri, set ke default wali123
            if (empty($user->password_changed_at)) {
                $updateData['password'] = $defaultWaliPassword;
                $updateData['password_current_encrypted'] = $encryptedWaliPassword;
            }

            $user->update($updateData);

            if ($siswa && $siswa->wali_id !== $user->id) {
                $siswa->update(['wali_id' => $user->id]);
            }
        }

        // 3. Pastikan SEMUA user role 'wali' memiliki email = null dan password default = wali123
        $allWalis = User::where('role', 'wali')->get();
        foreach ($allWalis as $wali) {
            $waliUpdates = [
                'email' => null, // Selalu kosongkan email agar wali yang mengisinya sendiri nanti
                'admin_type' => null,
                'password_default_encrypted' => $encryptedWaliPassword,
            ];

            if (empty($wali->nis)) {
                $linkedStudent = Siswa::where('wali_id', $wali->id)->first();
                if ($linkedStudent && !empty($linkedStudent->nis)) {
                    $waliUpdates['nis'] = $linkedStudent->nis;
                }
            }

            if (empty($wali->password_changed_at)) {
                $waliUpdates['password'] = $defaultWaliPassword;
                $waliUpdates['password_current_encrypted'] = $encryptedWaliPassword;
            }

            $wali->update($waliUpdates);
        }
    }

    public function down(): void
    {
        // No reverse needed
    }
};
