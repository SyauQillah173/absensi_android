<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Integrasi Dual Role: UST. IMAM BASHORI (ID: 52 / Kode: IM)
        // Beliau adalah Guru KBM Madin + Kepala Madrasah Diniyah (Monitoring Madin Saja)
        $imam = User::where('id', 52)
            ->orWhere('name', 'ilike', '%IMAM BASHORI%')
            ->first();

        if ($imam) {
            $imamEmail = $imam->email;
            if (empty($imamEmail) || str_ends_with($imamEmail, '@absensi.com') || str_ends_with($imamEmail, '@absensi.local')) {
                $imamEmail = 'imambashori@guru.com';
            }

            $imam->update([
                'role' => 'guru',
                'admin_type' => null,
                'kode_guru' => 'IM',
                'email' => $imamEmail,
                'unit_kerja' => $imam->unit_kerja ?: 'Madrasah Diniyah Qomaruddin',
            ]);

            if (Schema::hasTable('kepala_madrasah_access')) {
                DB::table('kepala_madrasah_access')->updateOrInsert(
                    ['user_id' => $imam->id],
                    [
                        'nama_pejabat' => $imam->name,
                        'jabatan' => 'Kepala Madrasah Diniyah',
                        'can_monitor_madin' => true,
                        'can_monitor_sholat' => false,
                        'can_monitor_ngaji' => false,
                        'is_active' => true,
                        'updated_at' => now(),
                    ]
                );
            }
        }

        // 2. Integrasi Dual Role: UST. ABD. WAJID / WAJIB (ID: 51 / Kode: AW)
        // Beliau adalah Guru KBM + Kepala Madrasah Pondok (Monitoring Sholat & Ngaji Saja)
        $wajid = User::where('id', 51)
            ->orWhere('name', 'ilike', '%ABD%WAJID%')
            ->orWhere('name', 'ilike', '%ABD%WAJIB%')
            ->first();

        if ($wajid) {
            $wajidEmail = $wajid->email;
            if (empty($wajidEmail) || str_ends_with($wajidEmail, '@absensi.com') || str_ends_with($wajidEmail, '@absensi.local')) {
                $wajidEmail = 'abdulwajid@guru.com';
            }

            $wajid->update([
                'role' => 'guru',
                'admin_type' => null,
                'kode_guru' => 'AW',
                'email' => $wajidEmail,
                'unit_kerja' => $wajid->unit_kerja ?: 'Pondok Pesantren Qomaruddin',
            ]);

            if (Schema::hasTable('kepala_madrasah_access')) {
                DB::table('kepala_madrasah_access')->updateOrInsert(
                    ['user_id' => $wajid->id],
                    [
                        'nama_pejabat' => $wajid->name,
                        'jabatan' => 'Kepala Madrasah Pondok Pesantren',
                        'can_monitor_madin' => false,
                        'can_monitor_sholat' => true,
                        'can_monitor_ngaji' => true,
                        'is_active' => true,
                        'updated_at' => now(),
                    ]
                );
            }
        }

        // 3. Standarisasi Domain Email Default Lembaga (Eksekusi Bulk SQL PostgreSQL Super Cepat):
        // A. Admin: Ubah default @absensi.com / @absensi.local menjadi @admin.com
        DB::statement("
            UPDATE users 
            SET email = REGEXP_REPLACE(email, '@(absensi\\.com|absensi\\.local)$', '@admin.com', 'i'),
                updated_at = NOW()
            WHERE role = 'admin' 
              AND (email LIKE '%@absensi.com' OR email LIKE '%@absensi.local')
        ");

        // B. Guru: Ubah default @absensi.com / @absensi.local menjadi @guru.com
        DB::statement("
            UPDATE users 
            SET email = REGEXP_REPLACE(email, '@(absensi\\.com|absensi\\.local)$', '@guru.com', 'i'),
                updated_at = NOW()
            WHERE role = 'guru' 
              AND (email LIKE '%@absensi.com' OR email LIKE '%@absensi.local')
        ");

        // C. Wali / Santri: Ubah default @absensi.local / @absensi.com menjadi @santri.com
        DB::statement("
            UPDATE users 
            SET email = REGEXP_REPLACE(email, '@(absensi\\.local|absensi\\.com)$', '@santri.com', 'i'),
                updated_at = NOW()
            WHERE role IN ('wali', 'santri') 
              AND (email LIKE '%@absensi.local' OR email LIKE '%@absensi.com')
        ");

        // D. Berikan default email @santri.com bagi akun wali/santri yang email-nya masih kosong/null
        DB::statement("
            UPDATE users 
            SET email = 'wali_' || LOWER(REPLACE(REPLACE(COALESCE(NULLIF(nis, ''), id::text), 'WLI_', ''), 'wli_', '')) || '@santri.com',
                updated_at = NOW()
            WHERE role IN ('wali', 'santri') 
              AND (email IS NULL OR email = '')
        ");

        // E. Update kolom wali_email di tabel siswa jika kolom tersedia
        if (Schema::hasTable('siswa') && Schema::hasColumn('siswa', 'wali_email')) {
            DB::statement("
                UPDATE siswa 
                SET wali_email = REGEXP_REPLACE(wali_email, '@(absensi\\.local|absensi\\.com)$', '@santri.com', 'i')
                WHERE wali_email LIKE '%@absensi.local' OR wali_email LIKE '%@absensi.com'
            ");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert domain santri kembali ke absensi.local
        DB::statement("
            UPDATE users 
            SET email = REGEXP_REPLACE(email, '@santri\\.com$', '@absensi.local', 'i')
            WHERE role IN ('wali', 'santri') AND email LIKE '%@santri.com'
        ");

        // Revert domain admin kembali ke absensi.com
        DB::statement("
            UPDATE users 
            SET email = REGEXP_REPLACE(email, '@admin\\.com$', '@absensi.com', 'i')
            WHERE role = 'admin' AND email LIKE '%@admin.com'
        ");

        // Revert domain guru kembali ke absensi.com
        DB::statement("
            UPDATE users 
            SET email = REGEXP_REPLACE(email, '@guru\\.com$', '@absensi.com', 'i')
            WHERE role = 'guru' AND email LIKE '%@guru.com'
        ");
    }
};
