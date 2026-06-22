<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            if (!Schema::hasColumn('siswa', 'alamat_lengkap_ayah')) {
                $table->text('alamat_lengkap_ayah')->nullable();
            }
            if (!Schema::hasColumn('siswa', 'alamat_lengkap_ibu')) {
                $table->text('alamat_lengkap_ibu')->nullable();
            }
            if (!Schema::hasColumn('siswa', 'status_mondok')) {
                $table->string('status_mondok', 30)->nullable()->index();
            }
            if (!Schema::hasColumn('siswa', 'tanggal_diterima_pondok')) {
                $table->date('tanggal_diterima_pondok')->nullable();
            }
            if (!Schema::hasColumn('siswa', 'tanggal_diterima_sekolah')) {
                $table->date('tanggal_diterima_sekolah')->nullable();
            }
        });

        DB::table('siswa')
            ->whereNull('alamat_lengkap_ayah')
            ->whereNotNull('alamat_ayah')
            ->update(['alamat_lengkap_ayah' => DB::raw('alamat_ayah')]);

        DB::table('siswa')
            ->whereNull('alamat_lengkap_ibu')
            ->whereNotNull('alamat_ibu')
            ->update(['alamat_lengkap_ibu' => DB::raw('alamat_ibu')]);

        DB::table('siswa')
            ->whereNull('status_mondok')
            ->update([
                'status_mondok' => DB::raw("
                    CASE
                        WHEN lower(coalesce(jenis_santri, '') || ' ' || coalesce(tempat_tinggal, '')) LIKE '%pondok%'
                            THEN 'mondok'
                        ELSE 'tidak_mondok'
                    END
                "),
            ]);

        Schema::table('academic_years', function (Blueprint $table) {
            if (!Schema::hasColumn('academic_years', 'year_start')) {
                $table->unsignedSmallInteger('year_start')->nullable()->index();
            }
            if (!Schema::hasColumn('academic_years', 'year_end')) {
                $table->unsignedSmallInteger('year_end')->nullable()->index();
            }
            if (!Schema::hasColumn('academic_years', 'active_semester')) {
                $table->string('active_semester', 20)->nullable()->index();
            }
        });

        DB::table('academic_years')
            ->whereNull('year_start')
            ->orWhereNull('year_end')
            ->orderBy('id')
            ->get()
            ->each(function ($year): void {
                $parts = preg_split('/[^0-9]+/', (string) $year->name, -1, PREG_SPLIT_NO_EMPTY);
                $start = isset($parts[0]) ? (int) $parts[0] : null;
                $end = isset($parts[1]) ? (int) $parts[1] : ($start ? $start + 1 : null);

                DB::table('academic_years')
                    ->where('id', $year->id)
                    ->update([
                        'year_start' => $start,
                        'year_end' => $end,
                        'active_semester' => $year->active_semester ?? 'ganjil',
                    ]);
            });

        $this->ensureAcademicColumns('jadwal');
        $this->ensureAcademicColumns('absensi');
        $this->ensureAcademicColumns('pembayaran');
        $this->ensureAcademicColumns('payment_transactions');
        $this->ensureAcademicColumns('payment_bills');
        $this->ensureAcademicColumns('payment_bill_rules');
        $this->ensureAcademicColumns('kelompok_belajar');
    }

    public function down(): void
    {
        Schema::table('academic_years', function (Blueprint $table) {
            foreach (['year_start', 'year_end', 'active_semester'] as $column) {
                if (Schema::hasColumn('academic_years', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('siswa', function (Blueprint $table) {
            foreach (['alamat_lengkap_ayah', 'alamat_lengkap_ibu', 'status_mondok', 'tanggal_diterima_pondok', 'tanggal_diterima_sekolah'] as $column) {
                if (Schema::hasColumn('siswa', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function ensureAcademicColumns(string $tableName): void
    {
        if (!Schema::hasTable($tableName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (!Schema::hasColumn($tableName, 'academic_year_id')) {
                $table->foreignId('academic_year_id')->nullable()->constrained('academic_years')->nullOnDelete();
            }
            if (!Schema::hasColumn($tableName, 'semester_id')) {
                $table->foreignId('semester_id')->nullable()->constrained('semesters')->nullOnDelete();
            }
            if (!Schema::hasColumn($tableName, 'tahun_ajaran')) {
                $table->string('tahun_ajaran', 30)->nullable()->index();
            }
            if (!Schema::hasColumn($tableName, 'semester')) {
                $table->string('semester', 30)->nullable()->index();
            }
        });
    }
};
