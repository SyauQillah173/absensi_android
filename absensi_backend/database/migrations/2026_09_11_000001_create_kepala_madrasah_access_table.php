<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('kepala_madrasah_access')) {
            Schema::create('kepala_madrasah_access', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('nama_pejabat');
                $table->string('jabatan')->default('Kepala Madrasah');
                $table->boolean('can_monitor_madin')->default(true);
                $table->boolean('can_monitor_sholat')->default(true);
                $table->boolean('can_monitor_ngaji')->default(true);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique('user_id');
            });
        }

        // =========================================================================
        // SEED AKUN KEPALA MADRASAH & DEFAULT CMS PRESETS
        // =========================================================================

        // 1. UST. IMAM BASHORI -> Kepala Madrasah Diniyah (Monitoring Madin Saja)
        $imam = User::where('id', 52)
            ->orWhereRaw('LOWER(name) LIKE ?', ['%imam bashori%'])
            ->first();

        if ($imam) {
            $imam->role = 'admin';
            $imam->admin_type = 'kepala_madrasah';
            $imam->email = $imam->email ?: 'imambashori@absensi.com';
            if (empty($imam->password)) {
                $imam->password = Hash::make('admin123');
            }
            $imam->save();

            DB::table('kepala_madrasah_access')->updateOrInsert(
                ['user_id' => $imam->id],
                [
                    'nama_pejabat' => $imam->name,
                    'jabatan' => 'Kepala Madrasah Diniyah',
                    'can_monitor_madin' => true,
                    'can_monitor_sholat' => false,
                    'can_monitor_ngaji' => false,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        // 2. UST. ABD. WAJID -> Kepala Madrasah Pondok Pesantren (Monitoring Sholat & Ngaji Saja)
        $wajid = User::where('id', 51)
            ->orWhereRaw('LOWER(name) LIKE ?', ['%wajid%'])
            ->first();

        if ($wajid) {
            $wajid->role = 'admin';
            $wajid->admin_type = 'kepala_madrasah';
            $wajid->email = $wajid->email ?: 'abdulwajid@absensi.com';
            if (empty($wajid->password)) {
                $wajid->password = Hash::make('admin123');
            }
            $wajid->save();

            DB::table('kepala_madrasah_access')->updateOrInsert(
                ['user_id' => $wajid->id],
                [
                    'nama_pejabat' => $wajid->name,
                    'jabatan' => 'Kepala Madrasah Pondok Pesantren',
                    'can_monitor_madin' => false,
                    'can_monitor_sholat' => true,
                    'can_monitor_ngaji' => true,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        // 3. BAPAK ERWIN -> Kepala Sekolah Umum (Monitoring Lengkap Madin, Sholat, Ngaji)
        $erwin = User::where('email', 'erwin@absensi.com')
            ->orWhere('admin_type', 'kepala_sekolah')
            ->first();

        if ($erwin) {
            DB::table('kepala_madrasah_access')->updateOrInsert(
                ['user_id' => $erwin->id],
                [
                    'nama_pejabat' => $erwin->name,
                    'jabatan' => 'Kepala Sekolah (Monitoring Lengkap)',
                    'can_monitor_madin' => true,
                    'can_monitor_sholat' => true,
                    'can_monitor_ngaji' => true,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('kepala_madrasah_access');
    }
};
