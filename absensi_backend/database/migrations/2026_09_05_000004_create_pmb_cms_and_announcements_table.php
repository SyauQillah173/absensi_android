<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Tabel CMS Web Profil & PMB Settings (Fleksibel ala WordPress)
        if (!Schema::hasTable('pmb_cms_settings')) {
            Schema::create('pmb_cms_settings', function (Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->longText('value')->nullable();
                $table->string('group')->default('general'); // general, hero, profil, program, fasilitas, kontak
                $table->string('type')->default('text'); // text, textarea, json, boolean, image
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });

            // Seed default settings
            $defaultSettings = [
                // General & Status PMB
                ['key' => 'pmb_is_open', 'value' => 'true', 'group' => 'general', 'type' => 'boolean'],
                ['key' => 'pmb_closed_message', 'value' => 'Mohon maaf, pendaftaran santri baru saat ini sedang ditutup. Silakan nantikan pembukaan gelombang berikutnya atau hubungi sekretariat PMB kami.', 'group' => 'general', 'type' => 'textarea'],
                
                // Hero Section
                ['key' => 'hero_badge', 'value' => 'PENERIMAAN SANTRI BARU (PMB) TA 2026/2027', 'group' => 'hero', 'type' => 'text'],
                ['key' => 'hero_title', 'value' => 'Mencetak Generasi Qur\'ani, Berakhlak Mulia & Berwawasan Global', 'group' => 'hero', 'type' => 'text'],
                ['key' => 'hero_description', 'value' => 'Pondok Pesantren Qomaruddin Sampurnan Bungah Gresik membuka pendaftaran santri baru untuk jenjang Madrasah Diniyah Salafiyah, Tahfidzul Qur\'an, dan Pendidikan Formal Terpadu.', 'group' => 'hero', 'type' => 'textarea'],

                // Sejarah & Profil Pesantren
                ['key' => 'profil_nama', 'value' => 'Pondok Pesantren Qomaruddin', 'group' => 'profil', 'type' => 'text'],
                ['key' => 'profil_pendiri', 'value' => 'Kiai Qomaruddin (Mbah Kiai Qomaruddin)', 'group' => 'profil', 'type' => 'text'],
                ['key' => 'profil_tahun', 'value' => '1775 M (Lebih dari 250 Tahun Berkhidmah)', 'group' => 'profil', 'type' => 'text'],
                ['key' => 'profil_sejarah', 'value' => 'Pondok Pesantren Qomaruddin didirikan pada tahun 1775 M oleh Kiai Qomaruddin di Desa Sampurnan, Bungah, Gresik. Sebagai salah satu pesantren tertua di Jawa Timur, pesantren ini konsisten memadukan tradisi keilmuan salaf Ahlussunnah wal Jama\'ah dengan dinamika modern, mencetak ribuan ulama, pendidik, dan tokoh masyarakat di seluruh penjuru nusantara.', 'group' => 'profil', 'type' => 'textarea'],

                // Visi & Misi
                ['key' => 'profil_visi', 'value' => 'Terwujudnya insan bertakwa, berakhlakul karimah, tafaqquh fiddin, mandiri, dan berdaya saing global.', 'group' => 'profil', 'type' => 'textarea'],
                ['key' => 'profil_misi', 'value' => json_encode([
                    'Menyelenggarakan pendidikan Islam berbasis kitab kuning salafiyah yang berkarakter.',
                    'Membina tahfidzul Qur\'an bersanad dan berfashahah tinggi.',
                    'Menyelenggarakan pendidikan formal unggulan yang terintegrasi nilai-nilai kepesantrenan.',
                    'Menanamkan kemandirian, kedisiplinan, dan kepemimpinan santri dalam kehidupan bermasyarakat.'
                ]), 'group' => 'profil', 'type' => 'json'],

                // Program Unggulan
                ['key' => 'program_unggulan', 'value' => json_encode([
                    [
                        'title' => 'Madrasah Diniyah Salafiyah',
                        'desc' => 'Kajian mendalam kitab kuning berjenjang (Sifir, Awal, Tsani, Tsalis, Robi\', Khomis, Sadis) dengan metode sorogan dan bandongan klasik.',
                        'icon' => 'BookOpen'
                    ],
                    [
                        'title' => 'Tahfidzul Qur\'an 30 Juz',
                        'desc' => 'Bimbingan intensif hafalan Al-Qur\'an bersanad muttashil dengan target tajwid mutqin, ziyadah teratur, dan fashahah.',
                        'icon' => 'Award'
                    ],
                    [
                        'title' => 'Pendidikan Formal Terpadu',
                        'desc' => 'Sinergi kurikulum nasional (MI, MTs, MA, SMA, SMK Assa\'adah) hingga Universitas Qomaruddin (UQ).',
                        'icon' => 'GraduationCap'
                    ],
                    [
                        'title' => 'Pembinaan Karakter & Kemandirian',
                        'desc' => 'Pembiasaan disiplin sholat jama\'ah 5 waktu di masjid, dzikir ratib, qiyamul lail, kepemimpinan, dan bahasa Arab-Inggris.',
                        'icon' => 'ShieldCheck'
                    ]
                ]), 'group' => 'program', 'type' => 'json'],

                // Fasilitas Pesantren
                ['key' => 'fasilitas_list', 'value' => json_encode([
                    'Masjid Jami\' Qomaruddin yang Megah & Bersejarah',
                    'Komplek Asrama Santri Putra & Putri Representatif',
                    'Perpustakaan Khazanah Kitab Salaf & Referensi Modern',
                    'Laboratorium Komputer & Multimedia Terkoneksi Internet',
                    'Klinik Kesehatan Pesantren (Poskestren Qomaruddin)',
                    'Kantin, Koperasi Pesantren & Dapur Bersih Higienis',
                    'Sarana Olahraga & Seni Hadrah Al-Banjari'
                ]), 'group' => 'fasilitas', 'type' => 'json'],

                // Kontak & Narahubung
                ['key' => 'kontak_alamat', 'value' => 'Jl. Sampurnan No. 01, Bungah, Kabupaten Gresik, Jawa Timur 61152', 'group' => 'kontak', 'type' => 'text'],
                ['key' => 'kontak_wa', 'value' => '0812-3456-7890', 'group' => 'kontak', 'type' => 'text'],
                ['key' => 'kontak_email', 'value' => 'pmb@ppqomaruddin.itqom.net', 'group' => 'kontak', 'type' => 'text'],
                ['key' => 'kontak_jam_kerja', 'value' => 'Setiap Hari: 08.00 - 16.00 WIB (Kecuali Hari Libur Pesantren)', 'group' => 'kontak', 'type' => 'text'],
            ];

            foreach ($defaultSettings as $setting) {
                $setting['created_at'] = now();
                $setting['updated_at'] = now();
                DB::table('pmb_cms_settings')->insert($setting);
            }
        }

        // 2. Tabel Berita & Pengumuman / Agenda Kedatangan Santri
        if (!Schema::hasTable('pmb_announcements')) {
            Schema::create('pmb_announcements', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->string('slug')->unique();
                $table->string('category')->default('pengumuman'); // pengumuman, agenda, berita
                $table->text('summary')->nullable();
                $table->longText('content');
                $table->date('event_date')->nullable(); // Tanggal wajib hadir / agenda kedatangan
                $table->string('badge_label')->nullable(); // misal: 'Wajib Hadir', 'Penting'
                $table->boolean('is_published')->default(true);
                $table->boolean('is_pinned')->default(false);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
            });

            // Seed default announcement
            DB::table('pmb_announcements')->insert([
                'title' => 'Informasi Jadwal Kedatangan & Penyerahan Santri Baru TA 2026/2027',
                'slug' => 'jadwal-kedatangan-santri-baru-2026-2027',
                'category' => 'agenda',
                'summary' => 'Jadwal resmi sowan pengasuh, penyerahan santri baru ke asrama, dan perlengkapan wajib yang harus dibawa.',
                'content' => "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nDiberitahukan kepada seluruh Bapak/Ibu Wali Santri Baru Pondok Pesantren Qomaruddin Tahun Ajaran 2026/2027 bahwa jadwal kedatangan dan penyerahan santri ke asrama pondok ditetapkan sebagai berikut:\n\n1. Tanggal Kedatangan: Ahad, 12 Juli 2026 pukul 08.00 - 15.00 WIB.\n2. Tempat: Aula Utama Yayasan Pondok Pesantren Qomaruddin Sampurnan Bungah Gresik.\n3. Agenda: Sowan Pengasuh Masyayikh, registrasi ulang asrama, dan penempatan lemari/kamar.\n4. Perlengkapan Wajib:\n   - Membawa bukti Kartu Pendaftaran / Registrasi Digital PMB.\n   - Pakaian muslim/muslimah rapi dan sopan (sarung, baju takwa putih, kopyah hitam untuk santri putra; busana muslimah longgar dan jilbab syar'i untuk santri putri).\n   - Kitab suci Al-Qur'an dan perlengkapan ibadah pribadi.\n\nDemikian pengumuman ini disampaikan untuk diperhatikan. Jazakumullahu Khairan Katsiran.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nPanitia PMB Pondok Pesantren Qomaruddin",
                'event_date' => '2026-07-12',
                'badge_label' => 'Wajib Hadir',
                'is_published' => true,
                'is_pinned' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 3. Kolom Tambahan di Tabel pmb_registrations untuk Status Pembayaran
        if (Schema::hasTable('pmb_registrations')) {
            Schema::table('pmb_registrations', function (Blueprint $table) {
                if (!Schema::hasColumn('pmb_registrations', 'payment_status')) {
                    $table->string('payment_status')->default('unpaid')->after('status'); // unpaid, paid, waived
                }
                if (!Schema::hasColumn('pmb_registrations', 'payment_amount')) {
                    $table->decimal('payment_amount', 14, 2)->default(0)->after('payment_status');
                }
                if (!Schema::hasColumn('pmb_registrations', 'payment_notes')) {
                    $table->text('payment_notes')->nullable()->after('payment_amount');
                }
                if (!Schema::hasColumn('pmb_registrations', 'payment_verified_at')) {
                    $table->timestamp('payment_verified_at')->nullable()->after('payment_notes');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pmb_announcements');
        Schema::dropIfExists('pmb_cms_settings');

        if (Schema::hasTable('pmb_registrations')) {
            Schema::table('pmb_registrations', function (Blueprint $table) {
                $columns = ['payment_status', 'payment_amount', 'payment_notes', 'payment_verified_at'];
                foreach ($columns as $col) {
                    if (Schema::hasColumn('pmb_registrations', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
