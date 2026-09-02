<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Update Abdullah Syauqillah -> Admin IT
        User::where('email', 'syauqillah@absensi.com')
            ->orWhere('name', 'ilike', '%SYAUQILLAH%')
            ->orWhere('name', 'ilike', '%Syauqillah%')
            ->update([
                'name' => 'Abdullah Syauqillah',
                'admin_type' => 'it',
                'role' => 'admin',
            ]);

        // 2. Update Mas Fahmi -> Admin Pengurus
        User::where('email', 'fahmi@absensi.com')
            ->orWhere('name', 'ilike', '%Fahmi%')
            ->update([
                'name' => 'Mas Fahmi',
                'admin_type' => 'pengurus',
                'role' => 'admin',
            ]);
    }

    public function down(): void
    {
        //
    }
};
