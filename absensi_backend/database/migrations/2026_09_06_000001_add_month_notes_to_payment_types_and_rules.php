<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('payment_types', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_types', 'month_notes')) {
                $table->json('month_notes')->nullable()->after('month_amounts');
            }
        });

        Schema::table('payment_bill_rules', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_bill_rules', 'month_notes')) {
                $table->json('month_notes')->nullable()->after('month_amounts');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payment_types', function (Blueprint $table) {
            if (Schema::hasColumn('payment_types', 'month_notes')) {
                $table->dropColumn('month_notes');
            }
        });

        Schema::table('payment_bill_rules', function (Blueprint $table) {
            if (Schema::hasColumn('payment_bill_rules', 'month_notes')) {
                $table->dropColumn('month_notes');
            }
        });
    }
};
