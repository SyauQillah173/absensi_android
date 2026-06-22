<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('siswa_tahun_ajaran')) {
            Schema::create('siswa_tahun_ajaran', function (Blueprint $table) {
                $table->id();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
                $table->foreignId('semester_id')->nullable()->constrained('semesters')->nullOnDelete();
                $table->string('tahun_ajaran', 30)->index();
                $table->string('semester', 30)->nullable()->index();
                $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
                $table->string('kelas')->nullable();
                $table->foreignId('wali_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('student_status_id')->nullable()->constrained('student_statuses')->nullOnDelete();
                $table->string('status_santri', 30)->nullable()->index();
                $table->boolean('is_active')->default(true)->index();
                $table->timestamp('synced_at')->nullable()->index();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['siswa_id', 'academic_year_id', 'semester_id'], 'siswa_tahun_ajaran_unique');
                $table->index(['academic_year_id', 'semester_id', 'is_active'], 'siswa_tahun_ajaran_period_active_idx');
            });
        }

        if (Schema::hasTable('payment_bills')) {
            DB::statement('CREATE INDEX IF NOT EXISTS payment_bills_student_period_status_idx ON payment_bills (siswa_id, academic_year_id, semester_id, status)');
            DB::statement('CREATE INDEX IF NOT EXISTS payment_bills_month_lookup_idx ON payment_bills (siswa_id, academic_year_id, semester_id, payment_type_id, period_month)');
            DB::statement(<<<'SQL'
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM payment_bills
                        WHERE period_month IS NOT NULL
                        GROUP BY siswa_id, academic_year_id, semester_id, payment_type_id, period_month
                        HAVING COUNT(*) > 1
                    ) THEN
                        CREATE UNIQUE INDEX IF NOT EXISTS payment_bills_student_type_period_month_unique
                        ON payment_bills (siswa_id, academic_year_id, semester_id, payment_type_id, period_month)
                        WHERE period_month IS NOT NULL;
                    END IF;
                END $$;
            SQL);
        }

        if (Schema::hasTable('pembayaran')) {
            DB::statement('CREATE INDEX IF NOT EXISTS pembayaran_student_period_type_status_idx ON pembayaran (siswa_id, academic_year_id, semester_id, payment_type_id, status)');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('payment_bills')) {
            DB::statement('DROP INDEX IF EXISTS payment_bills_student_type_period_month_unique');
            DB::statement('DROP INDEX IF EXISTS payment_bills_month_lookup_idx');
            DB::statement('DROP INDEX IF EXISTS payment_bills_student_period_status_idx');
        }

        if (Schema::hasTable('pembayaran')) {
            DB::statement('DROP INDEX IF EXISTS pembayaran_student_period_type_status_idx');
        }

        Schema::dropIfExists('siswa_tahun_ajaran');
    }
};
