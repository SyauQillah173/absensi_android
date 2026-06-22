<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('school_origins', function (Blueprint $table) {
            if (!Schema::hasColumn('school_origins', 'city_id')) {
                $table->foreignId('city_id')
                    ->nullable()
                    ->after('name')
                    ->constrained('cities')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('school_origins', 'npsn')) {
                $table->string('npsn', 32)->nullable()->unique()->after('city_id');
            }
            if (!Schema::hasColumn('school_origins', 'jenjang')) {
                $table->string('jenjang', 50)->nullable()->after('npsn');
            }
            if (!Schema::hasColumn('school_origins', 'alamat')) {
                $table->string('alamat')->nullable()->after('jenjang');
            }
            if (!Schema::hasColumn('school_origins', 'status_sekolah')) {
                $table->string('status_sekolah', 50)->nullable()->after('alamat');
            }
        });
    }

    public function down(): void
    {
        Schema::table('school_origins', function (Blueprint $table) {
            if (Schema::hasColumn('school_origins', 'city_id')) {
                $table->dropConstrainedForeignId('city_id');
            }
            foreach (['npsn', 'jenjang', 'alamat', 'status_sekolah'] as $column) {
                if (Schema::hasColumn('school_origins', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
