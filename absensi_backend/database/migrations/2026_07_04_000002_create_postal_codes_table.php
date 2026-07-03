<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('postal_codes')) {
            return;
        }

        Schema::create('postal_codes', function (Blueprint $table) {
            $table->id();
            $table->string('province_code', 10)->index();
            $table->string('city_name', 150);
            $table->string('district_name', 150);
            $table->string('village_name', 150);
            $table->string('postal_code', 10)->index();
            $table->string('city_key', 150);
            $table->string('district_key', 150);
            $table->string('village_key', 150);
            $table->timestamps();

            $table->unique(
                ['province_code', 'city_key', 'district_key', 'village_key', 'postal_code'],
                'postal_codes_location_postal_unique'
            );
            $table->index(
                ['province_code', 'city_key', 'district_key', 'village_key'],
                'postal_codes_location_index'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('postal_codes');
    }
};
