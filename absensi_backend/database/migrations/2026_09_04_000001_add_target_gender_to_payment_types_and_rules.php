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
        if (Schema::hasTable('payment_types')) {
            Schema::table('payment_types', function (Blueprint $table) {
                if (!Schema::hasColumn('payment_types', 'target_gender')) {
                    $table->string('target_gender', 20)->default('ALL')->after('status');
                }
            });
        }

        if (Schema::hasTable('payment_bill_rules')) {
            Schema::table('payment_bill_rules', function (Blueprint $table) {
                if (!Schema::hasColumn('payment_bill_rules', 'target_gender')) {
                    $table->string('target_gender', 20)->default('ALL')->after('target_type');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('payment_types')) {
            Schema::table('payment_types', function (Blueprint $table) {
                if (Schema::hasColumn('payment_types', 'target_gender')) {
                    $table->dropColumn('target_gender');
                }
            });
        }

        if (Schema::hasTable('payment_bill_rules')) {
            Schema::table('payment_bill_rules', function (Blueprint $table) {
                if (Schema::hasColumn('payment_bill_rules', 'target_gender')) {
                    $table->dropColumn('target_gender');
                }
            });
        }
    }
};
