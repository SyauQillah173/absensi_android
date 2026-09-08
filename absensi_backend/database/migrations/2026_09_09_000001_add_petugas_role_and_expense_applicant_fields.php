<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Perbarui check constraint users_role_check jika di PostgreSQL agar menerima 'petugas'
        try {
            DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY['admin'::text, 'guru'::text, 'wali'::text, 'petugas'::text])))");
        } catch (\Throwable $e) {
            // Abaikan jika bukan PostgreSQL atau database engine lain
        }

        // 2. Daftarkan role 'petugas' ke tabel master roles jika ada
        if (Schema::hasTable('roles')) {
            $existingPetugasRole = DB::table('roles')->where('code', 'petugas')->first();
            if (!$existingPetugasRole) {
                DB::table('roles')->insert([
                    'code' => 'petugas',
                    'name' => 'Petugas Anggaran',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 3. Tambahkan kolom pendukung di tabel pengeluaran
        if (Schema::hasTable('pengeluaran')) {
            Schema::table('pengeluaran', function (Blueprint $table) {
                if (!Schema::hasColumn('pengeluaran', 'nama_petugas')) {
                    $table->string('nama_petugas', 255)->nullable()->after('diinput_oleh');
                }
                if (!Schema::hasColumn('pengeluaran', 'status_pengajuan')) {
                    $table->string('status_pengajuan', 50)->default('tercatat')->after('pos_pengeluaran');
                }
            });
        }

        // 4. Seed akun default Petugas Pengaju Anggaran (admin_type = 'petugas')
        if (Schema::hasTable('users')) {
            $roleId = null;
            if (Schema::hasTable('roles')) {
                $roleId = DB::table('roles')->where('code', 'petugas')->value('id')
                    ?: DB::table('roles')->where('code', 'admin')->value('id')
                    ?: 1;
            }

            $userStatusId = null;
            if (Schema::hasTable('user_statuses')) {
                $userStatusId = DB::table('user_statuses')->where('code', 'aktif')->value('id') ?: 1;
            }

            $existingPetugasUser = DB::table('users')->where('email', 'petugas@absensi.com')->first();

            $petugasUserData = [
                'name' => 'Petugas Operasional Anggaran',
                'email' => 'petugas@absensi.com',
                'role' => 'admin',
                'role_id' => $roleId,
                'admin_type' => 'petugas',
                'password' => Hash::make('petugas123'),
                'password_default_encrypted' => Crypt::encryptString('petugas123'),
                'status' => 'Aktif',
                'user_status_id' => $userStatusId,
                'updated_at' => now(),
            ];

            if ($existingPetugasUser) {
                DB::table('users')->where('id', $existingPetugasUser->id)->update($petugasUserData);
            } else {
                $petugasUserData['created_at'] = now();
                DB::table('users')->insert($petugasUserData);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('pengeluaran')) {
            Schema::table('pengeluaran', function (Blueprint $table) {
                if (Schema::hasColumn('pengeluaran', 'nama_petugas')) {
                    $table->dropColumn('nama_petugas');
                }
                if (Schema::hasColumn('pengeluaran', 'status_pengajuan')) {
                    $table->dropColumn('status_pengajuan');
                }
            });
        }

        if (Schema::hasTable('users')) {
            DB::table('users')->where('email', 'petugas@absensi.com')->delete();
        }

        if (Schema::hasTable('roles')) {
            DB::table('roles')->where('code', 'petugas')->delete();
        }
    }
};
