<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement('alter table if exists villages add column if not exists postal_code varchar(10)');
        DB::statement('create index if not exists villages_postal_code_index on villages (postal_code)');
    }

    public function down(): void
    {
        DB::statement('drop index if exists villages_postal_code_index');
        DB::statement('alter table if exists villages drop column if exists postal_code');
    }
};
