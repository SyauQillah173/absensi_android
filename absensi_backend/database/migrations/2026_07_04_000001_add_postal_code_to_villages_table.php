<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('villages')) {
            return;
        }

        if (!Schema::hasColumn('villages', 'postal_code')) {
            Schema::table('villages', function (Blueprint $table) {
                $table->string('postal_code', 10)->nullable()->after('name');
            });
        }

        DB::statement('create index if not exists villages_postal_code_index on villages (postal_code)');
    }

    public function down(): void
    {
        if (!Schema::hasTable('villages') || !Schema::hasColumn('villages', 'postal_code')) {
            return;
        }

        DB::statement('drop index if exists villages_postal_code_index');

        Schema::table('villages', function (Blueprint $table) {
            $table->dropColumn('postal_code');
        });
    }
};
