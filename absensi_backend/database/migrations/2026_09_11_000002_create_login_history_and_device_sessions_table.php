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
        // 1. Tambahkan kolom metadata perangkat ke tabel api_access_tokens jika belum ada
        Schema::table('api_access_tokens', function (Blueprint $table) {
            if (!Schema::hasColumn('api_access_tokens', 'device_type')) {
                $table->string('device_type', 30)->nullable()->default('desktop');
            }
            if (!Schema::hasColumn('api_access_tokens', 'device_name')) {
                $table->string('device_name', 150)->nullable();
            }
            if (!Schema::hasColumn('api_access_tokens', 'platform')) {
                $table->string('platform', 100)->nullable();
            }
            if (!Schema::hasColumn('api_access_tokens', 'browser')) {
                $table->string('browser', 100)->nullable();
            }
            if (!Schema::hasColumn('api_access_tokens', 'ip_address')) {
                $table->string('ip_address', 60)->nullable();
            }
            if (!Schema::hasColumn('api_access_tokens', 'location')) {
                $table->string('location', 150)->nullable();
            }
            if (!Schema::hasColumn('api_access_tokens', 'is_revoked')) {
                $table->boolean('is_revoked')->default(false);
            }
        });

        // 2. Buat tabel login_histories untuk audit keamanan menyeluruh
        if (!Schema::hasTable('login_histories')) {
            Schema::create('login_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedBigInteger('token_id')->nullable();
                $table->string('user_name', 150)->nullable();
                $table->string('role', 50)->nullable();
                $table->string('device_type', 30)->default('desktop'); // mobile, desktop, tablet, app
                $table->string('device_name', 150)->nullable(); // e.g. Samsung Galaxy A54, Windows PC
                $table->string('platform', 100)->nullable();    // e.g. Android 14, Windows 11, iOS 17
                $table->string('browser', 100)->nullable();     // e.g. Chrome 128, Mobile Safari
                $table->string('ip_address', 60)->nullable();
                $table->string('location', 150)->nullable();    // e.g. Gresik, Jawa Timur / Jaringan Lokal
                $table->text('user_agent')->nullable();
                $table->string('status', 40)->default('active'); // active, logged_out, revoked, password_changed
                $table->timestamp('login_at')->useCurrent();
                $table->timestamp('logout_at')->nullable();
                $table->timestamp('last_active_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'status']);
                $table->index(['user_id', 'login_at']);
                $table->index(['ip_address', 'login_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('login_histories');

        Schema::table('api_access_tokens', function (Blueprint $table) {
            $cols = ['device_type', 'device_name', 'platform', 'browser', 'ip_address', 'location', 'is_revoked'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('api_access_tokens', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
