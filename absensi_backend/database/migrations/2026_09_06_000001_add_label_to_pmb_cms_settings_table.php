<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('pmb_cms_settings') && !Schema::hasColumn('pmb_cms_settings', 'label')) {
            Schema::table('pmb_cms_settings', function (Blueprint $table) {
                $table->string('label')->nullable()->after('group');
            });

            // Beri label deskriptif untuk setting yang sudah ada
            $labels = [
                'pmb_is_open' => 'Status Pendaftaran PMB Dibuka/Ditutup',
                'pmb_closed_message' => 'Pesan Saat PMB Ditutup',
                'pmb_visible_to_pengurus' => 'Tampilkan Modul & Manajemen PMB ke Admin Pengurus',
                'hero_badge' => 'Teks Badge Banner Hero',
                'hero_title' => 'Judul Utama (Headline) PMB',
                'hero_description' => 'Deskripsi Singkat PMB',
                'hero_cta_primary' => 'Teks Tombol Daftar',
                'hero_cta_secondary' => 'Teks Tombol Download Brosur',
                'profil_nama' => 'Nama Lembaga / Pesantren',
                'profil_pendiri' => 'Nama Muassis / Pendiri',
                'profil_tahun' => 'Tahun Berdiri Pesantren',
                'profil_sejarah' => 'Sejarah Singkat Pesantren',
                'profil_visi' => 'Visi Lembaga',
                'profil_misi' => 'Misi Lembaga',
                'kontak_alamat' => 'Alamat Lengkap Sekretariat PMB',
                'kontak_telepon' => 'Nomor Telepon Kantor',
                'kontak_whatsapp' => 'Nomor WhatsApp Hotline PMB',
                'kontak_email' => 'Email Resmi PMB',
                'kontak_jam_kerja' => 'Jam Operasional Layanan',
                'sosmed_facebook' => 'URL Facebook',
                'sosmed_instagram' => 'URL Instagram',
                'sosmed_youtube' => 'URL Channel YouTube',
                'sosmed_tiktok' => 'URL Akun TikTok',
            ];

            foreach ($labels as $key => $lbl) {
                DB::table('pmb_cms_settings')
                    ->where('key', $key)
                    ->update(['label' => $lbl]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('pmb_cms_settings') && Schema::hasColumn('pmb_cms_settings', 'label')) {
            Schema::table('pmb_cms_settings', function (Blueprint $table) {
                $table->dropColumn('label');
            });
        }
    }
};
