<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
        // 1. Tabel Pengaturan Ambang Batas Poin Pelanggaran (Settings)
        if (!Schema::hasTable('pelanggaran_settings')) {
            Schema::create('pelanggaran_settings', function (Blueprint $table) {
                $table->id();
                $table->integer('warning_threshold_points')->default(100);
                $table->boolean('enable_denda')->default(true);
                $table->string('surat_template_title')->default('SURAT PANGGILAN WALI SANTRI');
                $table->text('surat_template_body')->nullable();
                $table->timestamps();
            });

            // Default seed settings
            DB::table('pelanggaran_settings')->insert([
                'warning_threshold_points' => 100,
                'enable_denda' => true,
                'surat_template_title' => 'SURAT PANGGILAN WALI SANTRI',
                'surat_template_body' => 'Sehubungan dengan akumulasi poin pelanggaran kedisiplinan santri yang telah mencapai ambang batas peringatan, kami mengharap kehadiran Bapak/Ibu Wali Santri ke Kantor Pengurus Keamanan Pondok Pesantren Qomaruddin untuk berkoordinasi dan berdiskusi terkait pembinaan santri.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 2. Tabel Master Kategori & Jenis Pelanggaran
        if (!Schema::hasTable('pelanggaran_kategori')) {
            Schema::create('pelanggaran_kategori', function (Blueprint $table) {
                $table->id();
                $table->string('nama_pelanggaran');
                $table->enum('tingkat', ['Ringan', 'Sedang', 'Berat'])->default('Ringan');
                $table->integer('poin_default')->default(10);
                $table->decimal('denda_default', 12, 2)->default(0);
                $table->text('tindakan_rekomendasi')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });

            // Seed master kategori pelanggaran standar pesantren
            $kategoriList = [
                [
                    'nama_pelanggaran' => 'Terlambat Mengikuti Sholat Jamaah',
                    'tingkat' => 'Ringan',
                    'poin_default' => 5,
                    'denda_default' => 0,
                    'tindakan_rekomendasi' => 'Membaca Al-Waqi\'ah 1x & sholat sunnah taubah',
                ],
                [
                    'nama_pelanggaran' => 'Tidak Memakai Busana/Kopyah Sesuai Tata Tertib',
                    'tingkat' => 'Ringan',
                    'poin_default' => 5,
                    'denda_default' => 0,
                    'tindakan_rekomendasi' => 'Teguran lisan & merapikan atribut santri',
                ],
                [
                    'nama_pelanggaran' => 'Tidur / Mengantuk Berlebihan Saat Pengajian Kitab',
                    'tingkat' => 'Ringan',
                    'poin_default' => 10,
                    'denda_default' => 0,
                    'tindakan_rekomendasi' => 'Berwudhu & berdiri di barisan belakang selama pengajian',
                ],
                [
                    'nama_pelanggaran' => 'Tidak Mengikuti KBM Madin Tanpa Keterangan (Alfa)',
                    'tingkat' => 'Ringan',
                    'poin_default' => 15,
                    'denda_default' => 0,
                    'tindakan_rekomendasi' => 'Menulis istighfar 100x & membersihkan kelas',
                ],
                [
                    'nama_pelanggaran' => 'Merokok di Lingkungan Pesantren / Asrama',
                    'tingkat' => 'Sedang',
                    'poin_default' => 30,
                    'denda_default' => 20000,
                    'tindakan_rekomendasi' => 'Membersihkan MCK musholla komplek & sita barang bukti',
                ],
                [
                    'nama_pelanggaran' => 'Keluar Lingkungan Pondok Tanpa Izin Pengurus',
                    'tingkat' => 'Sedang',
                    'poin_default' => 35,
                    'denda_default' => 25000,
                    'tindakan_rekomendasi' => 'Piket dapur pesantren selama 3 hari & menghafal surat pilihan',
                ],
                [
                    'nama_pelanggaran' => 'Membawa Handphone / Barang Elektronik Terlarang',
                    'tingkat' => 'Sedang',
                    'poin_default' => 40,
                    'denda_default' => 50000,
                    'tindakan_rekomendasi' => 'Penyitaan HP oleh bagian keamanan sampai liburan semester',
                ],
                [
                    'nama_pelanggaran' => 'Berkelahi / Memicu Keributan Antar Santri',
                    'tingkat' => 'Berat',
                    'poin_default' => 60,
                    'denda_default' => 50000,
                    'tindakan_rekomendasi' => 'Islah damai, takzir berdiri di halaman pondok & pemanggilan wali',
                ],
                [
                    'nama_pelanggaran' => 'Mengambil Barang Milik Orang Lain (Ghosob Berat / Mencuri)',
                    'tingkat' => 'Berat',
                    'poin_default' => 80,
                    'denda_default' => 100000,
                    'tindakan_rekomendasi' => 'Mengembalikan barang, ganti rugi, dan terbit Surat Peringatan Keras',
                ],
                [
                    'nama_pelanggaran' => 'Kabur / Melompati Pagar Pondok Malam Hari',
                    'tingkat' => 'Berat',
                    'poin_default' => 90,
                    'denda_default' => 50000,
                    'tindakan_rekomendasi' => 'Pemberian SP2 & pemanggilan wali santri wajib hadir ke pondok',
                ],
            ];

            foreach ($kategoriList as $k) {
                DB::table('pelanggaran_kategori')->insert([
                    'nama_pelanggaran' => $k['nama_pelanggaran'],
                    'tingkat' => $k['tingkat'],
                    'poin_default' => $k['poin_default'],
                    'denda_default' => $k['denda_default'],
                    'tindakan_rekomendasi' => $k['tindakan_rekomendasi'],
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 3. Tabel Riwayat Pencatatan Pelanggaran Santri
        if (!Schema::hasTable('pelanggaran_santri')) {
            Schema::create('pelanggaran_santri', function (Blueprint $table) {
                $table->id();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->date('tanggal')->index();
                $table->string('waktu', 20)->nullable();
                $table->foreignId('kategori_id')->nullable()->constrained('pelanggaran_kategori')->nullOnDelete();
                $table->string('judul_pelanggaran');
                $table->enum('tingkat', ['Ringan', 'Sedang', 'Berat'])->default('Ringan')->index();
                $table->integer('poin')->default(10);
                $table->decimal('denda', 12, 2)->default(0);
                $table->enum('status_denda', ['tidak_ada', 'belum_dibayar', 'lunas'])->default('tidak_ada')->index();
                $table->text('keterangan')->nullable();
                $table->text('tindakan_takzir')->nullable();
                $table->string('bukti_foto')->nullable();
                $table->foreignId('petugas_keamanan_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('nama_petugas')->nullable();
                $table->enum('status_peringatan', ['normal', 'sp1', 'sp2', 'panggilan_ortu'])->default('normal')->index();
                $table->string('surat_panggilan_nomor', 100)->nullable();
                $table->timestamp('surat_panggilan_diterbitkan_at')->nullable();
                $table->text('catatan_wali')->nullable();
                $table->timestamps();

                $table->index(['siswa_id', 'tanggal'], 'pelanggaran_siswa_tanggal_idx');
            });
        }

        // 4. Mendaftarkan role 'keamanan' & akun default Pengurus Keamanan jika belum ada
        if (Schema::hasTable('roles')) {
            $hasCode = Schema::hasColumn('roles', 'code');
            $roleQuery = DB::table('roles')->where('name', 'keamanan')->orWhere('name', 'Pengurus Keamanan');
            if ($hasCode) {
                $roleQuery->orWhere('code', 'keamanan');
            }
            $roleExists = $roleQuery->exists();

            if (!$roleExists) {
                $roleInsert = [
                    'name' => 'Pengurus Keamanan',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                if ($hasCode) {
                    $roleInsert['code'] = 'keamanan';
                }
                DB::table('roles')->insert($roleInsert);
            }
        }

        if (class_exists(\App\Models\User::class)) {
            $user = \App\Models\User::where('email', 'keamanan@absensi.com')
                ->orWhere('name', 'Pengurus Keamanan Pondok')
                ->first();

            if (!$user) {
                \App\Models\User::create([
                    'name' => 'Pengurus Keamanan Pondok',
                    'email' => 'keamanan@absensi.com',
                    'password' => Hash::make('keamanan123'),
                    'role' => 'admin',
                    'admin_type' => 'keamanan',
                    'status' => 'Aktif',
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pelanggaran_santri');
        Schema::dropIfExists('pelanggaran_kategori');
        Schema::dropIfExists('pelanggaran_settings');
    }
};
