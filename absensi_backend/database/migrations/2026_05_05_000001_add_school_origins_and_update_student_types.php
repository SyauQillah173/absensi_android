<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('school_origins', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::table('siswa', function (Blueprint $table) {
            $table->foreignId('school_origin_id')
                ->nullable()
                ->after('asal_sekolah')
                ->constrained('school_origins')
                ->nullOnDelete();
        });

        DB::table('student_types')->updateOrInsert(
            ['code' => 'santri_pondok'],
            ['name' => 'Santri Pondok', 'created_at' => now(), 'updated_at' => now()]
        );
        DB::table('student_types')->updateOrInsert(
            ['code' => 'santri_madin'],
            ['name' => 'Santri Madin', 'created_at' => now(), 'updated_at' => now()]
        );
        DB::table('student_types')->updateOrInsert(
            ['code' => 'keduanya'],
            ['name' => 'Keduanya', 'created_at' => now(), 'updated_at' => now()]
        );

        $existingSchools = DB::table('siswa')
            ->whereNotNull('asal_sekolah')
            ->pluck('asal_sekolah')
            ->map(fn ($value) => $this->normalizeSchoolName($value))
            ->filter()
            ->unique(fn ($value) => Str::lower($value))
            ->values();

        foreach ($existingSchools as $name) {
            DB::table('school_origins')->updateOrInsert(
                ['name' => $name],
                [
                    'code' => $this->uniqueCode($name),
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        DB::table('siswa')
            ->whereNotNull('asal_sekolah')
            ->orderBy('id')
            ->select(['id', 'asal_sekolah'])
            ->chunkById(100, function ($rows) {
                foreach ($rows as $row) {
                    $name = $this->normalizeSchoolName($row->asal_sekolah);
                    if ($name === null) {
                        continue;
                    }

                    $originId = DB::table('school_origins')
                        ->whereRaw('lower(name) = ?', [Str::lower($name)])
                        ->value('id');

                    DB::table('siswa')
                        ->where('id', $row->id)
                        ->update([
                            'asal_sekolah' => $name,
                            'school_origin_id' => $originId,
                            'updated_at' => now(),
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            $table->dropConstrainedForeignId('school_origin_id');
        });

        Schema::dropIfExists('school_origins');
    }

    private function normalizeSchoolName(mixed $value): ?string
    {
        $clean = trim(preg_replace('/\s+/', ' ', (string) $value));
        if ($clean === '' || $clean === '-') {
            return null;
        }

        return preg_replace_callback('/^(mi|sd|mts|smp|ma|sma|smk)\b/i', function ($matches) {
            $token = Str::lower($matches[1]);
            return $token === 'mts' ? 'MTs' : Str::upper($token);
        }, $clean);
    }

    private function uniqueCode(string $name): string
    {
        $base = Str::of($name)->lower()->slug('_')->toString() ?: 'sekolah';
        $code = $base;
        $counter = 2;

        while (DB::table('school_origins')->where('code', $code)->exists()) {
            $code = $base . '_' . $counter++;
        }

        return $code;
    }
};
