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
        Schema::table('document_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('document_settings', 'bank_name')) {
                $table->string('bank_name', 100)->default('Bank Syariah Indonesia (BSI)');
            }
            if (!Schema::hasColumn('document_settings', 'bank_code')) {
                $table->string('bank_code', 20)->default('451');
            }
            if (!Schema::hasColumn('document_settings', 'bank_account_number')) {
                $table->string('bank_account_number', 50)->default('7171 2026 88');
            }
            if (!Schema::hasColumn('document_settings', 'bank_account_holder')) {
                $table->string('bank_account_holder', 150)->default('Yayasan Pondok Pesantren Qomaruddin');
            }
            if (!Schema::hasColumn('document_settings', 'bank_sub_name')) {
                $table->string('bank_sub_name', 50)->default('BSI SYARIAH');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('document_settings', function (Blueprint $table) {
            $table->dropColumn([
                'bank_name',
                'bank_code',
                'bank_account_number',
                'bank_account_holder',
                'bank_sub_name',
            ]);
        });
    }
};
