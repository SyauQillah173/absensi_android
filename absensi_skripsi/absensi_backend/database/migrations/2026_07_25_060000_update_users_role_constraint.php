<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement('ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20)');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role::text = ANY (ARRAY['superadmin'::character varying, 'admin'::character varying, 'kepala_sekolah'::character varying, 'guru'::character varying, 'wali'::character varying]::text[]))");
    }

    public function down(): void
    {
    }
};
