<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('school_origins', function (Blueprint $table) {
            if (!Schema::hasColumn('school_origins', 'province_id')) {
                $table->foreignId('province_id')->nullable()->after('name')->constrained('provinces')->nullOnDelete();
            }
            if (!Schema::hasColumn('school_origins', 'district_id')) {
                $table->foreignId('district_id')->nullable()->after('city_id')->constrained('districts')->nullOnDelete();
            }
            if (!Schema::hasColumn('school_origins', 'source')) {
                $table->string('source', 50)->nullable()->after('status_sekolah');
            }
            if (!Schema::hasColumn('school_origins', 'external_id')) {
                $table->string('external_id', 100)->nullable()->after('source');
            }
        });

        Schema::table('siswa', function (Blueprint $table) {
            if (!Schema::hasColumn('siswa', 'previous_asal_sekolah')) {
                $table->string('previous_asal_sekolah')->nullable()->after('school_origin_id');
            }
            if (!Schema::hasColumn('siswa', 'previous_school_origin_id')) {
                $table->foreignId('previous_school_origin_id')
                    ->nullable()
                    ->after('previous_asal_sekolah')
                    ->constrained('school_origins')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            if (Schema::hasColumn('siswa', 'previous_school_origin_id')) {
                $table->dropConstrainedForeignId('previous_school_origin_id');
            }
            if (Schema::hasColumn('siswa', 'previous_asal_sekolah')) {
                $table->dropColumn('previous_asal_sekolah');
            }
        });

        Schema::table('school_origins', function (Blueprint $table) {
            foreach (['external_id', 'source'] as $column) {
                if (Schema::hasColumn('school_origins', $column)) {
                    $table->dropColumn($column);
                }
            }
            if (Schema::hasColumn('school_origins', 'district_id')) {
                $table->dropConstrainedForeignId('district_id');
            }
            if (Schema::hasColumn('school_origins', 'province_id')) {
                $table->dropConstrainedForeignId('province_id');
            }
        });
    }
};
