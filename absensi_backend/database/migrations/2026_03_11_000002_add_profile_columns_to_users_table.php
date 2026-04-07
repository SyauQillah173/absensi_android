<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('foto_profil')->nullable()->after('password');
            $table->string('no_hp', 20)->nullable()->after('foto_profil');
            $table->enum('jenis_kelamin', ['L', 'P'])->nullable()->after('no_hp');
            $table->string('nik_user', 16)->nullable()->after('jenis_kelamin');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['foto_profil', 'no_hp', 'jenis_kelamin', 'nik_user']);
        });
    }
};
