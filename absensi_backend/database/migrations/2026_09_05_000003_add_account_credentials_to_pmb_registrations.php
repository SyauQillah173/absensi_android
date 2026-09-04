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
        Schema::table('pmb_registrations', function (Blueprint $table) {
            if (!Schema::hasColumn('pmb_registrations', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('pmb_batch_id')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('pmb_registrations', 'account_username')) {
                $table->string('account_username', 100)->nullable()->after('no_whatsapp_wali');
            }
            if (!Schema::hasColumn('pmb_registrations', 'account_initial_password')) {
                $table->string('account_initial_password', 100)->nullable()->after('account_username');
            }
            if (!Schema::hasColumn('pmb_registrations', 'wa_notif_sent')) {
                $table->boolean('wa_notif_sent')->default(false)->after('account_initial_password');
            }
            if (!Schema::hasColumn('pmb_registrations', 'wa_notif_at')) {
                $table->timestamp('wa_notif_at')->nullable()->after('wa_notif_sent');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pmb_registrations', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn([
                'user_id',
                'account_username',
                'account_initial_password',
                'wa_notif_sent',
                'wa_notif_at'
            ]);
        });
    }
};
