<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('absensi_sholat', function (Blueprint $table) {
            if (!Schema::hasColumn('absensi_sholat', 'is_cancelled')) {
                $table->boolean('is_cancelled')->default(false)->index()->after('synced_at');
            }
            if (!Schema::hasColumn('absensi_sholat', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('is_cancelled');
            }
            if (!Schema::hasColumn('absensi_sholat', 'cancelled_by')) {
                $table->foreignId('cancelled_by')
                    ->nullable()
                    ->after('cancelled_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('absensi_sholat', 'cancel_reason')) {
                $table->text('cancel_reason')->nullable()->after('cancelled_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('absensi_sholat', function (Blueprint $table) {
            if (Schema::hasColumn('absensi_sholat', 'cancelled_by')) {
                $table->dropConstrainedForeignId('cancelled_by');
            }
            foreach (['cancel_reason', 'cancelled_at', 'is_cancelled'] as $column) {
                if (Schema::hasColumn('absensi_sholat', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
