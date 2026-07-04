<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement(<<<'SQL'
            create table if not exists postal_codes (
                id bigserial primary key,
                province_code varchar(10) not null,
                city_name varchar(150) not null,
                district_name varchar(150) not null,
                village_name varchar(150) not null,
                postal_code varchar(10) not null,
                city_key varchar(150) not null,
                district_key varchar(150) not null,
                village_key varchar(150) not null,
                created_at timestamp(0) without time zone null,
                updated_at timestamp(0) without time zone null
            )
        SQL);

        DB::statement('create index if not exists postal_codes_province_code_index on postal_codes (province_code)');
        DB::statement('create index if not exists postal_codes_postal_code_index on postal_codes (postal_code)');
        DB::statement(
            'create unique index if not exists postal_codes_location_postal_unique on postal_codes (province_code, city_key, district_key, village_key, postal_code)'
        );
        DB::statement(
            'create index if not exists postal_codes_location_index on postal_codes (province_code, city_key, district_key, village_key)'
        );
    }

    public function down(): void
    {
        DB::statement('drop table if exists postal_codes');
    }
};
