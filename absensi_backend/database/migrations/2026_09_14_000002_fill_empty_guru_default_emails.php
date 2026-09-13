<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $emptyGurus = DB::table('users')
            ->where('role', 'guru')
            ->where(function ($q) {
                $q->whereNull('email')->orWhere('email', '');
            })
            ->get(['id', 'name', 'kode_guru']);

        foreach ($emptyGurus as $g) {
            // Bersihkan gelar/panggilan seperti UST., USTD., dsb
            $cleanName = preg_replace('/^(ustd?|kh|dr|dra|drs|h|hj)\.?\s+/i', '', trim($g->name));
            $cleanSlug = preg_replace('/[^a-z0-9]/', '', strtolower($cleanName));

            if (empty($cleanSlug) || strlen($cleanSlug) < 3) {
                $cleanSlug = !empty($g->kode_guru) ? 'guru_' . strtolower($g->kode_guru) : 'guru_' . $g->id;
            }

            $email = $cleanSlug . '@guru.com';

            // Cek apakah email sudah dipakai
            $exists = DB::table('users')->where('email', $email)->where('id', '!=', $g->id)->exists();
            if ($exists) {
                $email = $cleanSlug . $g->id . '@guru.com';
            }

            DB::table('users')->where('id', $g->id)->update([
                'email' => $email,
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // biarkan email tetap ada demi konsistensi data login
    }
};
