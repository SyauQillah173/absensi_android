<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        $this->createTechnicalBaseline();
        $this->prepareUsers();
        $this->createDomainTables();
        $this->migrateExistingData();
        $this->dropOutOfScopeTables();
    }

    private function createTechnicalBaseline(): void
    {
        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('email')->unique();
                $table->string('username')->nullable()->unique();
                $table->string('password');
                $table->string('password_hash')->nullable();
                $table->string('role', 10)->default('admin');
                $table->string('status', 20)->default('Aktif');
                $table->boolean('status_aktif')->default(true);
                $table->string('no_hp', 20)->nullable();
                $table->text('alamat')->nullable();
                $table->timestamp('login_failed_at')->nullable();
                $table->unsignedSmallInteger('login_failed_count')->default(0);
                $table->timestamp('locked_until')->nullable();
                $table->rememberToken();
                $table->timestamps();
            });
        }
        if (!Schema::hasTable('api_access_tokens')) {
            Schema::create('api_access_tokens', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('name')->default('android');
                $table->string('token_hash', 64)->unique();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();
            });
        }
    }

    private function prepareUsers(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (!Schema::hasColumn('users', 'username')) {
                $table->string('username')->nullable();
            }
            if (!Schema::hasColumn('users', 'password_hash')) {
                $table->string('password_hash')->nullable();
            }
            if (!Schema::hasColumn('users', 'status_aktif')) {
                $table->boolean('status_aktif')->default(true);
            }
            if (!Schema::hasColumn('users', 'login_failed_at')) {
                $table->timestamp('login_failed_at')->nullable();
            }
            if (!Schema::hasColumn('users', 'login_failed_count')) {
                $table->unsignedSmallInteger('login_failed_count')->default(0);
            }
            if (!Schema::hasColumn('users', 'locked_until')) {
                $table->timestamp('locked_until')->nullable();
            }
        });

        foreach (DB::table('users')->orderBy('id')->get() as $user) {
            if (!in_array(strtolower((string) $user->role), ['admin', 'guru'], true)) {
                continue;
            }
            $base = Str::slug((string) ($user->name ?: Str::before($user->email, '@')), '_') ?: 'user_'.$user->id;
            $username = $base;
            $suffix = 1;
            while (DB::table('users')->where('username', $username)->where('id', '!=', $user->id)->exists()) {
                $username = $base.'_'.$suffix++;
            }
            DB::table('users')->where('id', $user->id)->update([
                'username' => $user->username ?: $username,
                'password_hash' => $user->password_hash ?: $user->password,
                'status_aktif' => ($user->status ?? 'Aktif') === 'Aktif',
                'role' => strtolower((string) $user->role),
            ]);
        }

        DB::table('api_access_tokens')->delete();
    }

    private function createDomainTables(): void
    {
        Schema::create('guru', function (Blueprint $table): void {
            $table->id('id_guru');
            $table->foreignId('id_user')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('nama_guru');
            $table->string('nip_nidm')->nullable()->unique();
            $table->string('nomor_hp', 20);
            $table->text('alamat')->nullable();
            $table->boolean('status_aktif')->default(true);
            $table->json('audit_log')->nullable();
            $table->timestamps();
        });

        Schema::create('kelas', function (Blueprint $table): void {
            $table->id('id_kelas');
            $table->foreignId('id_guru')->constrained('guru', 'id_guru')->restrictOnDelete();
            $table->string('nama_kelas')->unique();
            $table->unsignedSmallInteger('tingkat')->default(1);
            $table->boolean('status_aktif')->default(true);
            $table->json('audit_log')->nullable();
            $table->timestamps();
        });

        Schema::create('santri', function (Blueprint $table): void {
            $table->id('id_santri');
            $table->foreignId('id_kelas')->constrained('kelas', 'id_kelas')->restrictOnDelete();
            $table->string('nisn', 30)->unique();
            $table->string('nama_santri');
            $table->string('jenis_kelamin', 1);
            $table->date('tgl_lahir')->nullable();
            $table->text('alamat')->nullable();
            $table->string('nama_wali');
            $table->string('nomor_wa_wali', 20);
            $table->boolean('status_aktif')->default(true);
            $table->json('audit_log')->nullable();
            $table->timestamps();
        });

        Schema::create('presensi', function (Blueprint $table): void {
            $table->id('id_presensi');
            $table->foreignId('id_guru')->constrained('guru', 'id_guru')->restrictOnDelete();
            $table->foreignId('id_kelas')->constrained('kelas', 'id_kelas')->restrictOnDelete();
            $table->date('tanggal');
            $table->time('waktu_mulai');
            $table->time('waktu_selesai')->nullable();
            $table->text('catatan')->nullable();
            $table->boolean('sync_flag')->default(true);
            $table->uuid('operation_id')->unique();
            $table->timestamps();
            $table->unique(['id_kelas', 'tanggal', 'waktu_mulai'], 'presensi_sesi_unique');
        });

        Schema::create('detail_presensi', function (Blueprint $table): void {
            $table->id('id_detail_presensi');
            $table->foreignId('id_presensi')->constrained('presensi', 'id_presensi')->cascadeOnDelete();
            $table->foreignId('id_santri')->constrained('santri', 'id_santri')->restrictOnDelete();
            $table->string('status_presensi', 10);
            $table->text('keterangan')->nullable();
            $table->boolean('sync_flag')->default(true);
            $table->timestamps();
            $table->unique(['id_presensi', 'id_santri'], 'detail_presensi_unique');
        });

        Schema::create('sync_operations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('operation_id')->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('entity_type', 40);
            $table->string('action', 20);
            $table->string('status', 20)->default('completed');
            $table->json('result')->nullable();
            $table->timestamps();
        });

        Schema::dropIfExists('whatsapp_message_logs');
        Schema::create('whatsapp_message_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('id_detail_presensi')->nullable()
                ->constrained('detail_presensi', 'id_detail_presensi')->cascadeOnDelete();
            $table->string('nomor_tujuan', 20);
            $table->text('pesan');
            $table->string('status', 20)->default('pending');
            $table->string('message_id')->nullable();
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->timestamp('next_retry_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });

        Schema::dropIfExists('audit_logs');
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 40);
            $table->string('entity_type', 80);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    private function migrateExistingData(): void
    {
        $guruByUser = [];
        foreach (DB::table('users')->where('role', 'guru')->orderBy('id')->get() as $user) {
            $profile = Schema::hasTable('teacher_profiles')
                ? DB::table('teacher_profiles')->where('user_id', $user->id)->first()
                : null;
            $guruByUser[$user->id] = DB::table('guru')->insertGetId([
                'id_user' => $user->id,
                'nama_guru' => $user->name,
                'nip_nidm' => $profile->teacher_code ?? $user->kode_guru ?? null,
                'nomor_hp' => $user->no_hp ?: '-',
                'alamat' => $profile->address ?? $user->alamat ?? null,
                'status_aktif' => (bool) $user->status_aktif,
                'created_at' => now(),
                'updated_at' => now(),
            ], 'id_guru');
        }

        if (!$guruByUser) {
            $admin = DB::table('users')->where('role', 'admin')->first();
            if ($admin) {
                $guruByUser[$admin->id] = DB::table('guru')->insertGetId([
                    'id_user' => $admin->id,
                    'nama_guru' => $admin->name,
                    'nomor_hp' => $admin->no_hp ?: '-',
                    'status_aktif' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ], 'id_guru');
            }
        }
        $defaultGuru = reset($guruByUser);

        $kelasMap = [];
        if (Schema::hasTable('classes')) {
            foreach (DB::table('classes')->orderBy('id')->get() as $old) {
                $kelasMap[$old->id] = DB::table('kelas')->insertGetId([
                    'id_guru' => $defaultGuru,
                    'nama_kelas' => $old->name,
                    'tingkat' => max(1, (int) preg_replace('/\D+/', '', (string) $old->code)),
                    'status_aktif' => (bool) $old->is_active,
                    'created_at' => $old->created_at ?: now(),
                    'updated_at' => $old->updated_at ?: now(),
                ], 'id_kelas');
            }
        }
        if (!$kelasMap && $defaultGuru) {
            $kelasMap[0] = DB::table('kelas')->insertGetId([
                'id_guru' => $defaultGuru,
                'nama_kelas' => 'Kelas 1',
                'tingkat' => 1,
                'status_aktif' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ], 'id_kelas');
        }
        $defaultKelas = reset($kelasMap) ?: null;

        $santriMap = [];
        if (Schema::hasTable('siswa')) {
            foreach (DB::table('siswa')->orderBy('id')->get() as $old) {
                $oldClassId = $old->class_id ?? null;
                $santriMap[$old->id] = DB::table('santri')->insertGetId([
                    'id_kelas' => $kelasMap[$oldClassId] ?? $defaultKelas,
                    'nisn' => $old->nisn ?: $old->nis,
                    'nama_santri' => $old->nama,
                    'jenis_kelamin' => in_array($old->jenis_kelamin, ['L', 'P'], true) ? $old->jenis_kelamin : 'L',
                    'tgl_lahir' => $old->tanggal_lahir,
                    'alamat' => $old->alamat,
                    'nama_wali' => $old->nama_wali ?: ($old->nama_ayah ?: $old->nama_ibu ?: '-'),
                    'nomor_wa_wali' => $old->no_telepon_wali ?: ($old->no_whatsapp_ayah ?: $old->no_whatsapp_ibu ?: '-'),
                    'status_aktif' => ($old->status ?? 'Aktif') === 'Aktif',
                    'created_at' => $old->created_at ?: now(),
                    'updated_at' => $old->updated_at ?: now(),
                ], 'id_santri');
            }
        }

        if (Schema::hasTable('absensi')) {
            $groups = DB::table('absensi')->orderBy('tanggal')->orderBy('id')->get()
                ->groupBy(fn ($row) => implode('|', [
                    $row->tanggal,
                    $row->class_id ?: 0,
                    $row->actor_user_id ?: 0,
                ]));
            foreach ($groups as $rows) {
                $first = $rows->first();
                $classId = $kelasMap[$first->class_id] ?? ($santriMap[$first->siswa_id]
                    ? DB::table('santri')->where('id_santri', $santriMap[$first->siswa_id])->value('id_kelas')
                    : $defaultKelas);
                $guruId = $guruByUser[$first->actor_user_id] ?? DB::table('kelas')
                    ->where('id_kelas', $classId)->value('id_guru');
                $createdAt = $first->created_at ?: now();
                $presensiId = DB::table('presensi')->insertGetId([
                    'id_guru' => $guruId,
                    'id_kelas' => $classId,
                    'tanggal' => $first->tanggal,
                    'waktu_mulai' => date('H:i:s', strtotime((string) $createdAt)),
                    'sync_flag' => true,
                    'operation_id' => (string) Str::uuid(),
                    'created_at' => $createdAt,
                    'updated_at' => $first->updated_at ?: $createdAt,
                ], 'id_presensi');
                foreach ($rows as $row) {
                    if (!isset($santriMap[$row->siswa_id])) {
                        continue;
                    }
                    DB::table('detail_presensi')->insert([
                        'id_presensi' => $presensiId,
                        'id_santri' => $santriMap[$row->siswa_id],
                        'status_presensi' => in_array($row->status, ['Alfa', 'Alpha'], true) ? 'Alpa' : $row->status,
                        'keterangan' => $row->keterangan,
                        'sync_flag' => true,
                        'created_at' => $row->created_at ?: now(),
                        'updated_at' => $row->updated_at ?: now(),
                    ]);
                }
            }
        }
    }

    private function dropOutOfScopeTables(): void
    {
        $keep = [
            'migrations', 'users',
            'api_access_tokens', 'guru', 'kelas', 'santri', 'presensi',
            'detail_presensi', 'sync_operations', 'whatsapp_message_logs',
            'audit_logs',
        ];

        if (DB::getDriverName() === 'pgsql') {
            $tables = DB::table('information_schema.tables')
                ->where('table_schema', 'public')
                ->where('table_type', 'BASE TABLE')
                ->pluck('table_name');
        } elseif (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            $tables = DB::table('information_schema.tables')
                ->where('table_schema', DB::getDatabaseName())
                ->where('table_type', 'BASE TABLE')
                ->pluck('table_name');
        } else {
            $tables = DB::select("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'");
            $tables = collect($tables)->pluck('name');
        }

        foreach ($tables as $table) {
            if (!in_array($table, $keep, true)) {
                if (DB::getDriverName() === 'pgsql') {
                    DB::statement('drop table if exists "'.str_replace('"', '""', $table).'" cascade');
                } elseif (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
                    DB::statement('drop table if exists `'.str_replace('`', '``', $table).'`');
                } else {
                    DB::statement('drop table if exists "'.str_replace('"', '""', $table).'"');
                }
            }
        }
        DB::table('users')->whereNotIn('role', ['admin', 'guru'])->delete();
    }

    public function down(): void
    {
        foreach (['whatsapp_message_logs', 'sync_operations', 'detail_presensi', 'presensi', 'santri', 'kelas', 'guru'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
