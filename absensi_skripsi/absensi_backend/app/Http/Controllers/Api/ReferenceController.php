<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\SchoolOrigin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReferenceController extends Controller
{
    public function classes(Request $request)
    {
        $query = SchoolClass::query();

        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        } else {
            $query->where('is_active', true);
        }

        return response()->json([
            'success' => true,
            'data' => $query
                ->orderBy('category')
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'category', 'gender_group', 'is_active']),
        ]);
    }

    public function storeClass(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:classes,name'],
            'code' => ['nullable', 'string', 'max:100', 'unique:classes,code'],
            'category' => ['nullable', 'string', 'max:100'],
            'gender_group' => ['nullable', 'string', 'max:20'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        if (array_key_exists('code', $validated) && trim((string) $validated['code']) === '') {
            unset($validated['code']);
        }

        $class = SchoolClass::create([
            'name' => trim($validated['name']),
            'code' => $validated['code'] ?? $this->uniqueClassCode($validated['name']),
            'category' => $validated['category'] ?? $this->categoryFromClassName($validated['name']),
            'gender_group' => $validated['gender_group'] ?? $this->genderGroupFromClassName($validated['name']),
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $this->ensureKelompokBelajarForClass($class);

        return response()->json([
            'success' => true,
            'message' => 'Kelas sifir berhasil ditambahkan',
            'data' => $class->fresh(),
        ], 201);
    }

    public function updateClass(Request $request, SchoolClass $class)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', Rule::unique('classes', 'name')->ignore($class->id)],
            'code' => ['nullable', 'string', 'max:100', Rule::unique('classes', 'code')->ignore($class->id)],
            'category' => ['nullable', 'string', 'max:100'],
            'gender_group' => ['nullable', 'string', 'max:20'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim($validated['name']);
            $validated['category'] = $validated['category'] ?? $this->categoryFromClassName($validated['name']);
            $validated['gender_group'] = $validated['gender_group'] ?? $this->genderGroupFromClassName($validated['name']);
        }
        if (array_key_exists('code', $validated) && trim((string) $validated['code']) === '') {
            unset($validated['code']);
        }

        $class->update($validated);
        $this->syncKelompokBelajarForClass($class);

        return response()->json([
            'success' => true,
            'message' => 'Kelas sifir berhasil diperbarui',
            'data' => $class->fresh(),
        ]);
    }

    public function destroyClass(SchoolClass $class)
    {
        $hasStudents = DB::table('siswa')->where('class_id', $class->id)->exists();
        $hasAttendance = DB::table('absensi')->where('class_id', $class->id)->exists();

        if ($hasStudents || $hasAttendance) {
            $class->update(['is_active' => false]);
            return response()->json([
                'success' => true,
                'message' => 'Kelas sifir dipakai data siswa/absensi, jadi dinonaktifkan.',
                'data' => $class->fresh(),
            ]);
        }

        DB::table('kelompok_belajar')->where('class_id', $class->id)->delete();
        $class->delete();

        return response()->json([
            'success' => true,
            'message' => 'Kelas sifir berhasil dihapus',
        ]);
    }

    public function schoolOrigins(Request $request)
    {
        $query = SchoolOrigin::query()->with(['province:id,name', 'city:id,name,province_id', 'district:id,name,city_id']);
        $hasCity = Schema::hasColumn('school_origins', 'city_id');
        $hasProvince = Schema::hasColumn('school_origins', 'province_id');
        $hasDistrict = Schema::hasColumn('school_origins', 'district_id');

        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        } else {
            $query->where('is_active', true);
        }

        if ($hasProvince && $request->filled('province_id')) {
            $query->where('province_id', $request->integer('province_id'));
        }

        if ($hasCity && $request->filled('city_id')) {
            $cityId = $request->integer('city_id');
            $cityName = DB::table('cities')->where('id', $cityId)->value('name');
            $cityKeyword = Str::of((string) $cityName)
                ->replace(['Kabupaten ', 'Kota '], '')
                ->trim()
                ->toString();
            $query->where(function ($builder) use ($cityId, $cityKeyword) {
                $builder->where('city_id', $cityId);
                if ($cityKeyword !== '') {
                    $builder->orWhere(function ($legacy) use ($cityKeyword) {
                        $legacy
                            ->whereNull('city_id')
                            ->where('name', 'ilike', '%' . $cityKeyword . '%');
                    });
                }
            });
        }

        if ($hasDistrict && $request->filled('district_id')) {
            $query->where('district_id', $request->integer('district_id'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'ilike', '%' . $search . '%')
                    ->orWhere('npsn', 'ilike', '%' . $search . '%')
                    ->orWhere('alamat', 'ilike', '%' . $search . '%')
                    ->orWhereHas('province', fn ($query) => $query->where('name', 'ilike', '%' . $search . '%'))
                    ->orWhereHas('city', fn ($query) => $query->where('name', 'ilike', '%' . $search . '%'))
                    ->orWhereHas('district', fn ($query) => $query->where('name', 'ilike', '%' . $search . '%'));
            });
        }

        $columns = ['id', 'code', 'name', 'is_active'];
        foreach (['province_id', 'city_id', 'district_id', 'npsn', 'jenjang', 'alamat', 'status_sekolah', 'source', 'external_id'] as $column) {
            if (Schema::hasColumn('school_origins', $column)) {
                $columns[] = $column;
            }
        }
        $limit = min(max($request->integer('limit', 200), 1), 1000);

        return response()->json([
            'success' => true,
            'data' => $query
                ->orderBy('name')
                ->limit($limit)
                ->get($columns)
                ->map(fn (SchoolOrigin $origin) => $this->formatSchoolOrigin($origin))
                ->values(),
        ]);
    }

    public function master(Request $request, string $table)
    {
        $allowed = [
            'occupations',
            'income_ranges',
            'education_levels',
            'residence_types',
            'transport_modes',
            'blood_types',
            'guardian_relationships',
            'teacher_units',
            'teacher_categories',
            'student_types',
            'payment_period_types',
            'payment_methods',
        ];

        abort_unless(in_array($table, $allowed, true), 404);

        $query = DB::table($table);
        if (Schema::hasColumn($table, 'is_active')) {
            $query->where('is_active', true);
        }

        if ($table === 'student_types') {
            $query->whereIn('name', ['Santri Madin', 'Santri Pondok', 'Keduanya']);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where('name', 'ilike', '%' . $search . '%');
        }

        $columns = ['id', 'name'];
        if (Schema::hasColumn($table, 'code')) {
            $columns[] = 'code';
        }
        foreach ([
            'description',
            'icon',
            'is_monthly',
            'is_daily',
            'is_general',
            'uses_month',
            'uses_semester',
            'month_mode',
            'needs_due_day',
            'due_day',
            'qris_image_path',
            'sort_order',
        ] as $column) {
            if (Schema::hasColumn($table, $column)) {
                $columns[] = $column;
            }
        }

        if (Schema::hasColumn($table, 'is_active')) {
            $columns[] = 'is_active';
        }

        $orderColumn = Schema::hasColumn($table, 'sort_order') ? 'sort_order' : 'name';

        return response()->json([
            'success' => true,
            'data' => $query
                ->orderBy($orderColumn)
                ->orderBy('name')
                ->get($columns),
        ]);
    }

    public function storeSchoolOrigin(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:100', 'unique:school_origins,code'],
            'province_id' => ['nullable', 'integer', 'exists:provinces,id'],
            'city_id' => ['nullable', 'integer', 'exists:cities,id'],
            'district_id' => ['nullable', 'integer', 'exists:districts,id'],
            'npsn' => ['nullable', 'string', 'max:32', 'unique:school_origins,npsn'],
            'jenjang' => ['nullable', 'string', 'max:50'],
            'alamat' => ['nullable', 'string', 'max:255'],
            'status_sekolah' => ['nullable', 'string', 'max:50'],
            'source' => ['nullable', 'string', 'max:50'],
            'external_id' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        foreach (['code', 'npsn', 'jenjang', 'alamat', 'status_sekolah', 'source', 'external_id'] as $field) {
            if (array_key_exists($field, $validated) && trim((string) $validated[$field]) === '') {
                $validated[$field] = null;
            }
        }
        $validated = $this->normalizeSchoolLocation($validated);
        $this->ensureSchoolOriginIsUnique($validated);

        $origin = SchoolOrigin::create([
            'name' => trim($validated['name']),
            'code' => $validated['code'] ?? $this->uniqueSchoolOriginCode($validated['name']),
            'province_id' => $validated['province_id'] ?? null,
            'city_id' => $validated['city_id'] ?? null,
            'district_id' => $validated['district_id'] ?? null,
            'npsn' => $validated['npsn'] ?? null,
            'jenjang' => $validated['jenjang'] ?? null,
            'alamat' => $validated['alamat'] ?? null,
            'status_sekolah' => $validated['status_sekolah'] ?? null,
            'source' => $validated['source'] ?? 'manual',
            'external_id' => $validated['external_id'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Asal sekolah berhasil ditambahkan',
            'data' => $origin,
        ], 201);
    }

    public function updateSchoolOrigin(Request $request, SchoolOrigin $schoolOrigin)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:100', Rule::unique('school_origins', 'code')->ignore($schoolOrigin->id)],
            'province_id' => ['nullable', 'integer', 'exists:provinces,id'],
            'city_id' => ['nullable', 'integer', 'exists:cities,id'],
            'district_id' => ['nullable', 'integer', 'exists:districts,id'],
            'npsn' => ['nullable', 'string', 'max:32', Rule::unique('school_origins', 'npsn')->ignore($schoolOrigin->id)],
            'jenjang' => ['nullable', 'string', 'max:50'],
            'alamat' => ['nullable', 'string', 'max:255'],
            'status_sekolah' => ['nullable', 'string', 'max:50'],
            'source' => ['nullable', 'string', 'max:50'],
            'external_id' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim($validated['name']);
        }
        foreach (['code', 'npsn', 'jenjang', 'alamat', 'status_sekolah', 'source', 'external_id'] as $field) {
            if (array_key_exists($field, $validated) && trim((string) $validated[$field]) === '') {
                $validated[$field] = null;
            }
        }
        if (array_key_exists('code', $validated) && $validated['code'] === null) {
            unset($validated['code']);
        }

        $validated = $this->normalizeSchoolLocation($validated);
        $this->ensureSchoolOriginIsUnique($validated, $schoolOrigin->id);

        $schoolOrigin->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Asal sekolah berhasil diperbarui',
            'data' => $schoolOrigin->fresh(),
        ]);
    }

    public function destroySchoolOrigin(SchoolOrigin $schoolOrigin)
    {
        $schoolOrigin->update(['is_active' => false]);

        return response()->json([
            'success' => true,
            'message' => 'Asal sekolah dinonaktifkan',
        ]);
    }

    private function uniqueSchoolOriginCode(string $name): string
    {
        $base = Str::of($name)->lower()->slug('_')->toString() ?: 'sekolah';
        $code = $base;
        $counter = 2;

        while (SchoolOrigin::where('code', $code)->exists()) {
            $code = $base . '_' . $counter++;
        }

        return $code;
    }

    private function normalizeSchoolLocation(array $payload): array
    {
        if (!empty($payload['district_id'])) {
            $district = DB::table('districts')->where('id', $payload['district_id'])->first(['city_id']);
            $payload['city_id'] = $payload['city_id'] ?? $district?->city_id;
        }
        if (!empty($payload['city_id'])) {
            $city = DB::table('cities')->where('id', $payload['city_id'])->first(['province_id']);
            $payload['province_id'] = $payload['province_id'] ?? $city?->province_id;
        }

        return $payload;
    }

    private function ensureSchoolOriginIsUnique(array $payload, ?int $ignoreId = null): void
    {
        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            return;
        }

        $normalized = Str::of($name)->lower()->replaceMatches('/\s+/', ' ')->trim()->toString();
        $provinceId = $payload['province_id'] ?? null;
        $cityId = $payload['city_id'] ?? null;

        $duplicate = SchoolOrigin::query()
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->whereRaw("lower(regexp_replace(name, '\\s+', ' ', 'g')) = ?", [$normalized])
            ->when($provinceId, fn ($query) => $query->where('province_id', $provinceId))
            ->when(!$provinceId, fn ($query) => $query->whereNull('province_id'))
            ->when($cityId, fn ($query) => $query->where('city_id', $cityId))
            ->when(!$cityId, fn ($query) => $query->whereNull('city_id'))
            ->exists();

        if ($duplicate) {
            abort(response()->json([
                'success' => false,
                'message' => 'Sekolah sudah ada di master untuk wilayah tersebut.',
                'errors' => [
                    'name' => ['Sekolah sudah ada di master untuk wilayah tersebut.'],
                ],
            ], 422));
        }
    }

    private function formatSchoolOrigin(SchoolOrigin $origin): array
    {
        return [
            'id' => $origin->id,
            'code' => $origin->code,
            'name' => $origin->name,
            'province_id' => $origin->province_id,
            'city_id' => $origin->city_id,
            'district_id' => $origin->district_id,
            'province' => $origin->province?->name,
            'city' => $origin->city?->name,
            'district' => $origin->district?->name,
            'npsn' => $origin->npsn,
            'jenjang' => $origin->jenjang,
            'alamat' => $origin->alamat,
            'status_sekolah' => $origin->status_sekolah,
            'source' => $origin->source,
            'external_id' => $origin->external_id,
            'is_active' => (bool) $origin->is_active,
        ];
    }

    private function uniqueClassCode(string $name): string
    {
        $base = Str::of($name)->upper()->replaceMatches('/[^A-Z0-9]+/', '_')->trim('_')->limit(24, '')->toString() ?: 'KELAS';
        $code = $base;
        $counter = 2;

        while (SchoolClass::where('code', $code)->exists()) {
            $code = $base . '_' . $counter++;
        }

        return $code;
    }

    private function categoryFromClassName(string $name): string
    {
        $upper = Str::of($name)->upper()->toString();
        foreach (['AWAL', 'TSANI', 'TSALIS', 'ROBI', 'KHOMIS', 'SADIS'] as $level) {
            if (str_contains($upper, $level)) {
                return 'Sifir ' . ucfirst(strtolower($level));
            }
        }

        return 'Sifir';
    }

    private function genderGroupFromClassName(string $name): ?string
    {
        $upper = Str::of($name)->upper()->toString();
        if (preg_match('/\bPA\b/', $upper)) {
            return 'PA';
        }
        if (preg_match('/\bPI\b/', $upper)) {
            return 'PI';
        }

        return null;
    }

    private function ensureKelompokBelajarForClass(SchoolClass $class): void
    {
        DB::table('kelompok_belajar')->updateOrInsert(
            ['class_id' => $class->id],
            [
                'nama' => $class->name,
                'kategori' => $class->category ?? $this->categoryFromClassName($class->name),
                'sifir' => Str::of($class->category ?? $class->name)->lower()->replace('sifir ', '')->toString(),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }

    private function syncKelompokBelajarForClass(SchoolClass $class): void
    {
        DB::table('kelompok_belajar')
            ->where('class_id', $class->id)
            ->update([
                'nama' => $class->name,
                'kategori' => $class->category ?? $this->categoryFromClassName($class->name),
                'sifir' => Str::of($class->category ?? $class->name)->lower()->replace('sifir ', '')->toString(),
                'updated_at' => now(),
            ]);

        if (!DB::table('kelompok_belajar')->where('class_id', $class->id)->exists()) {
            $this->ensureKelompokBelajarForClass($class);
        }
    }
}
