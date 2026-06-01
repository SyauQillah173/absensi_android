<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->seedCodeName('roles', [
            ['code' => 'admin', 'name' => 'Admin'],
            ['code' => 'guru', 'name' => 'Guru'],
            ['code' => 'wali', 'name' => 'Orang Tua'],
        ]);

        $this->seedCodeName('user_statuses', [
            ['code' => 'aktif', 'name' => 'Aktif'],
            ['code' => 'nonaktif', 'name' => 'Nonaktif'],
        ]);

        $this->seedCodeName('student_statuses', [
            ['code' => 'aktif', 'name' => 'Aktif'],
            ['code' => 'nonaktif', 'name' => 'Nonaktif'],
            ['code' => 'lulus', 'name' => 'Lulus'],
        ]);

        $this->seedCodeName('attendance_statuses', [
            ['code' => 'hadir', 'name' => 'Hadir'],
            ['code' => 'izin', 'name' => 'Izin'],
            ['code' => 'sakit', 'name' => 'Sakit'],
            ['code' => 'alfa', 'name' => 'Alfa'],
        ]);

        $this->seedCodeName('payment_statuses', [
            ['code' => 'lunas', 'name' => 'Lunas'],
            ['code' => 'belum_lunas', 'name' => 'Belum Lunas'],
            ['code' => 'menunggu', 'name' => 'Menunggu'],
        ]);

        $this->seedCodeName('payment_methods', [
            ['code' => 'tunai', 'name' => 'Tunai'],
            ['code' => 'transfer_dana', 'name' => 'Transfer Dana'],
            ['code' => 'bank_bri', 'name' => 'Bank BRI'],
            ['code' => 'bank_mandiri', 'name' => 'Bank Mandiri'],
            ['code' => 'bank_bsi', 'name' => 'Bank BSI'],
            ['code' => 'bank_bca', 'name' => 'Bank BCA'],
            ['code' => 'qris', 'name' => 'QRIS'],
        ]);

        $this->seedCodeName('payment_period_types', [
            ['code' => 'sekali', 'name' => 'Sekali'],
            ['code' => 'bulanan', 'name' => 'Bulanan'],
            ['code' => 'tahunan', 'name' => 'Tahunan'],
        ]);

        $this->seedCodeName('days', [
            ['code' => 'ahad', 'name' => 'Ahad'],
            ['code' => 'senin', 'name' => 'Senin'],
            ['code' => 'selasa', 'name' => 'Selasa'],
            ['code' => 'rabu', 'name' => 'Rabu'],
            ['code' => 'kamis', 'name' => 'Kamis'],
            ['code' => 'jumat', 'name' => 'Jumat'],
            ['code' => 'sabtu', 'name' => 'Sabtu'],
        ]);

        $this->seedCodeName('class_levels', [
            ['code' => 'awal', 'name' => 'Sifir Awal'],
            ['code' => 'tsani', 'name' => 'Sifir Tsani'],
            ['code' => 'tsalis', 'name' => 'Sifir Tsalis'],
            ['code' => 'robi', 'name' => "Sifir Robi'"],
            ['code' => 'khomis', 'name' => 'Sifir Khomis'],
            ['code' => 'sadis', 'name' => 'Sifir Sadis'],
        ]);

        $this->seedCodeName('assessment_types', [
            ['code' => 'harian', 'name' => 'Harian'],
            ['code' => 'tugas', 'name' => 'Tugas'],
            ['code' => 'uts', 'name' => 'UTS'],
            ['code' => 'uas', 'name' => 'UAS'],
        ]);

        $this->seedCodeName('memorization_statuses', [
            ['code' => 'belum', 'name' => 'Belum'],
            ['code' => 'proses', 'name' => 'Proses'],
            ['code' => 'selesai', 'name' => 'Selesai'],
        ]);

        $this->seedCodeName('approval_statuses', [
            ['code' => 'diajukan', 'name' => 'Diajukan'],
            ['code' => 'disetujui', 'name' => 'Disetujui'],
            ['code' => 'ditolak', 'name' => 'Ditolak'],
        ]);

        $this->seedCodeName('leave_types', [
            ['code' => 'sakit', 'name' => 'Sakit'],
            ['code' => 'izin', 'name' => 'Izin'],
            ['code' => 'keluarga', 'name' => 'Keperluan Keluarga'],
            ['code' => 'tugas_luar', 'name' => 'Tugas Luar'],
            ['code' => 'lainnya', 'name' => 'Lainnya'],
        ]);

        $this->seedCodeName('student_types', [
            ['code' => 'santri_madin', 'name' => 'Santri Madin'],
            ['code' => 'santri_mukim', 'name' => 'Santri Mukim'],
            ['code' => 'santri_pulang', 'name' => 'Santri Pulang'],
        ]);

        $this->seedCodeName('education_levels', [
            ['code' => 'sd', 'name' => 'SD/MI'],
            ['code' => 'smp', 'name' => 'SMP/MTs'],
            ['code' => 'sma', 'name' => 'SMA/MA'],
            ['code' => 'diploma', 'name' => 'Diploma'],
            ['code' => 's1', 'name' => 'S1'],
            ['code' => 's2', 'name' => 'S2'],
            ['code' => 's3', 'name' => 'S3'],
        ]);

        $this->seedCodeName('occupations', [
            ['code' => 'petani', 'name' => 'Petani'],
            ['code' => 'nelayan', 'name' => 'Nelayan'],
            ['code' => 'pedagang', 'name' => 'Pedagang'],
            ['code' => 'karyawan', 'name' => 'Karyawan'],
            ['code' => 'wiraswasta', 'name' => 'Wiraswasta'],
            ['code' => 'pns', 'name' => 'PNS'],
            ['code' => 'guru', 'name' => 'Guru'],
            ['code' => 'ibu_rumah_tangga', 'name' => 'Ibu Rumah Tangga'],
            ['code' => 'lainnya', 'name' => 'Lainnya'],
        ]);

        $this->seedCodeName('income_ranges', [
            ['code' => 'lt_1jt', 'name' => '< Rp 1.000.000'],
            ['code' => '1jt_3jt', 'name' => 'Rp 1.000.000 - Rp 3.000.000'],
            ['code' => '3jt_5jt', 'name' => 'Rp 3.000.000 - Rp 5.000.000'],
            ['code' => 'gt_5jt', 'name' => '> Rp 5.000.000'],
        ]);

        $this->seedCodeName('residence_types', [
            ['code' => 'orang_tua', 'name' => 'Bersama Orang Tua'],
            ['code' => 'wali', 'name' => 'Bersama Wali'],
            ['code' => 'pondok', 'name' => 'Pondok Pesantren'],
            ['code' => 'lainnya', 'name' => 'Lainnya'],
        ]);

        $this->seedCodeName('transport_modes', [
            ['code' => 'jalan_kaki', 'name' => 'Jalan Kaki'],
            ['code' => 'sepeda', 'name' => 'Sepeda'],
            ['code' => 'motor', 'name' => 'Motor'],
            ['code' => 'mobil', 'name' => 'Mobil'],
            ['code' => 'angkutan_umum', 'name' => 'Angkutan Umum'],
        ]);

        $this->seedCodeName('blood_types', [
            ['code' => 'a', 'name' => 'A'],
            ['code' => 'b', 'name' => 'B'],
            ['code' => 'ab', 'name' => 'AB'],
            ['code' => 'o', 'name' => 'O'],
            ['code' => 'tidak_tahu', 'name' => 'Tidak Tahu'],
        ]);

        $this->seedCodeName('guardian_relationships', [
            ['code' => 'ayah', 'name' => 'Ayah'],
            ['code' => 'ibu', 'name' => 'Ibu'],
            ['code' => 'wali', 'name' => 'Wali'],
            ['code' => 'kakek_nenek', 'name' => 'Kakek/Nenek'],
            ['code' => 'saudara', 'name' => 'Saudara'],
        ]);

        $this->seedCodeName('teacher_categories', [
            ['code' => 'guru', 'name' => 'Guru'],
            ['code' => 'karyawan', 'name' => 'Karyawan'],
            ['code' => 'pejabat', 'name' => 'Pejabat'],
            ['code' => 'sertifikasi', 'name' => 'Sertifikasi'],
        ]);

        $this->seedCodeName('teacher_units', [
            ['code' => 'smp_assaadah', 'name' => "SMP Assa'adah"],
            ['code' => 'sma_assaadah', 'name' => "SMA Assa'adah"],
            ['code' => 'mts_assaadah_1', 'name' => "MTs Assa'adah 1"],
            ['code' => 'mts_assaadah_2', 'name' => "MTs Assa'adah 2"],
            ['code' => 'aliyah_assaadah', 'name' => "Aliyah Assa'adah"],
            ['code' => 'mi_assaadah', 'name' => "MI Assa'adah"],
            ['code' => 'tk_muslimat_assaadah', 'name' => "TK Muslimat Assa'adah"],
        ]);

        $this->relaxRegionNameUniques();
        $this->backfillIds();
        $this->addIntegrityChecks();
    }

    public function down(): void
    {
        // Reference rows are baseline application data. Rollback leaves them in place
        // so existing foreign keys never become orphaned.
    }

    private function seedCodeName(string $table, array $rows): void
    {
        $hasCode = Schema::hasColumn($table, 'code');

        foreach ($rows as $row) {
            $key = $hasCode ? ['code' => $row['code']] : ['name' => $row['name']];
            $payload = [
                'name' => $row['name'],
                'created_at' => now(),
                'updated_at' => now(),
            ];
            if ($hasCode) {
                $payload['code'] = $row['code'];
            }

            DB::table($table)->updateOrInsert(
                $key,
                $payload
            );
        }
    }

    private function backfillIds(): void
    {
        DB::statement("update users u set role_id = r.id from roles r where u.role_id is null and lower(u.role) = lower(r.code)");
        DB::statement("update users u set user_status_id = s.id from user_statuses s where u.user_status_id is null and lower(u.status) = lower(s.name)");
        DB::statement("update siswa s set student_status_id = ss.id from student_statuses ss where s.student_status_id is null and lower(s.status) = lower(ss.name)");
        DB::statement("update absensi a set attendance_status_id = st.id from attendance_statuses st where a.attendance_status_id is null and lower(a.status) = lower(st.name)");
        DB::statement("update pembayaran p set payment_status_id = st.id from payment_statuses st where p.payment_status_id is null and lower(p.status) = lower(st.name)");
        DB::statement("update pembayaran p set payment_method_id = m.id from payment_methods m where p.payment_method_id is null and lower(p.via) = lower(m.name)");
        DB::statement("update payment_transactions p set payment_status_id = st.id from payment_statuses st where p.payment_status_id is null and lower(p.status) = lower(st.name)");
        DB::statement("update payment_transactions p set payment_method_id = m.id from payment_methods m where p.payment_method_id is null and lower(p.via) = lower(m.name)");
        DB::statement("update payment_types p set payment_period_type_id = t.id from payment_period_types t where p.payment_period_type_id is null and lower(p.periode) = lower(t.code)");
        DB::statement("update guru_izin g set approval_status_id = s.id from approval_statuses s where g.approval_status_id is null and lower(g.status_pengajuan) = lower(s.name)");
        DB::statement("update hafalan h set memorization_status_id = s.id from memorization_statuses s where h.memorization_status_id is null and lower(h.status) = lower(s.name)");
        DB::statement("update jadwal j set day_id = d.id from days d where j.day_id is null and lower(j.hari) = lower(d.name)");
    }

    private function relaxRegionNameUniques(): void
    {
        DB::statement('alter table cities drop constraint if exists cities_province_id_name_unique');
        DB::statement('alter table districts drop constraint if exists districts_city_id_name_unique');
        DB::statement('alter table villages drop constraint if exists villages_district_id_name_unique');

        DB::statement('create index if not exists cities_province_id_name_index on cities (province_id, name)');
        DB::statement('create index if not exists districts_city_id_name_index on districts (city_id, name)');
        DB::statement('create index if not exists villages_district_id_name_index on villages (district_id, name)');
    }

    private function addIntegrityChecks(): void
    {
        $checks = [
            ['users', 'users_role_id_required_when_role_present', '(role is null or role_id is not null)'],
            ['users', 'users_status_id_required_when_status_present', '(status is null or user_status_id is not null)'],
            ['siswa', 'siswa_class_id_required_when_kelas_present', '(kelas is null or class_id is not null)'],
            ['siswa', 'siswa_status_id_required_when_status_present', '(status is null or student_status_id is not null)'],
            ['siswa', 'siswa_province_id_required_when_provinsi_present', "(nullif(trim(provinsi), '') is null or province_id is not null)"],
            ['siswa', 'siswa_city_id_required_when_kota_present', "(nullif(trim(kota), '') is null or city_id is not null)"],
            ['siswa', 'siswa_district_id_required_when_kecamatan_present', "(nullif(trim(kecamatan), '') is null or district_id is not null)"],
            ['siswa', 'siswa_village_id_required_when_kelurahan_present', "(nullif(trim(kelurahan), '') is null or village_id is not null)"],
            ['absensi', 'absensi_class_id_required_when_kelas_present', '(kelas is null or class_id is not null)'],
            ['absensi', 'absensi_mapel_id_required_when_mapel_present', '(mapel is null or mapel_id is not null)'],
            ['absensi', 'absensi_status_id_required_when_status_present', '(status is null or attendance_status_id is not null)'],
            ['jadwal', 'jadwal_teacher_id_required_when_guru_present', '(guru is null or teacher_id is not null)'],
            ['jadwal', 'jadwal_day_id_required_when_hari_present', '(hari is null or day_id is not null)'],
            ['jadwal', 'jadwal_class_id_required_when_sifir_present', '(sifir is null or class_id is not null)'],
            ['materi', 'materi_class_id_required_when_kelas_present', '(kelas is null or class_id is not null)'],
            ['materi', 'materi_mapel_id_required_when_mapel_present', '(mapel is null or mapel_id is not null)'],
            ['kegiatan', 'kegiatan_class_id_required_when_kelas_present', '(kelas is null or class_id is not null)'],
            ['pembayaran', 'pembayaran_method_id_required_when_via_present', '(via is null or payment_method_id is not null)'],
            ['pembayaran', 'pembayaran_status_id_required_when_status_present', '(status is null or payment_status_id is not null)'],
            ['payment_transactions', 'payment_transactions_method_id_required_when_via_present', '(via is null or payment_method_id is not null)'],
            ['payment_transactions', 'payment_transactions_status_id_required_when_status_present', '(status is null or payment_status_id is not null)'],
            ['payment_types', 'payment_types_period_id_required_when_periode_present', '(periode is null or payment_period_type_id is not null)'],
            ['guru_izin', 'guru_izin_status_id_required_when_status_present', '(status_pengajuan is null or approval_status_id is not null)'],
            ['hafalan', 'hafalan_status_id_required_when_status_present', '(status is null or memorization_status_id is not null)'],
        ];

        foreach ($checks as [$table, $name, $expression]) {
            DB::statement("alter table {$table} drop constraint if exists {$name}");
            DB::statement("alter table {$table} add constraint {$name} check {$expression}");
        }
    }
};
