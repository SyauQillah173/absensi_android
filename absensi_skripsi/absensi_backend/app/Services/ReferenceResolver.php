<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReferenceResolver
{
    public function roleId(?string $role): ?int
    {
        return $this->idByCode('roles', $role);
    }

    public function userStatusId(?string $status): ?int
    {
        return $this->idByName('user_statuses', $status);
    }

    public function studentStatusId(?string $status): ?int
    {
        return $this->idByName('student_statuses', $status);
    }

    public function attendanceStatusId(?string $status): ?int
    {
        return $this->idByName('attendance_statuses', $status);
    }

    public function assessmentTypeId(?string $type): ?int
    {
        return $this->idByName('assessment_types', $type);
    }

    public function paymentMethodId(?string $method): ?int
    {
        return $this->idByName('payment_methods', $method, 'name', 'code', true);
    }

    public function paymentStatusId(?string $status): ?int
    {
        return $this->idByName('payment_statuses', $status);
    }

    public function memorizationStatusId(?string $status): ?int
    {
        return $this->idByName('memorization_statuses', $status);
    }

    public function paymentPeriodTypeId(?string $period): ?int
    {
        return $this->idByCode('payment_period_types', $period);
    }

    public function approvalStatusId(?string $status): ?int
    {
        return $this->idByName('approval_statuses', $status);
    }

    public function dayId(?string $day): ?int
    {
        return $this->idByName('days', $day);
    }

    public function studentTypeId(?string $type): ?int
    {
        return $this->idByName('student_types', $type, 'name', 'code', false);
    }

    public function provinceId(?string $name, ?string $externalCode = null): ?int
    {
        return $this->regionId('provinces', $name, null, null, $externalCode, false);
    }

    public function cityId(?string $name, ?int $provinceId = null, ?string $externalCode = null): ?int
    {
        return $this->regionId('cities', $name, 'province_id', $provinceId, $externalCode, false);
    }

    public function districtId(?string $name, ?int $cityId = null, ?string $externalCode = null): ?int
    {
        return $this->regionId('districts', $name, 'city_id', $cityId, $externalCode, false);
    }

    public function villageId(?string $name, ?int $districtId = null, ?string $externalCode = null): ?int
    {
        return $this->regionId('villages', $name, 'district_id', $districtId, $externalCode, false);
    }

    public function educationLevelId(?string $level): ?int
    {
        return $this->idByName('education_levels', $level, 'name', 'code', false);
    }

    public function occupationId(?string $occupation): ?int
    {
        return $this->idByName('occupations', $occupation, 'name', 'code', false);
    }

    public function incomeRangeId(?string $income): ?int
    {
        return $this->idByName('income_ranges', $income, 'name', 'code', false);
    }

    public function residenceTypeId(?string $type): ?int
    {
        return $this->idByName('residence_types', $type, 'name', 'code', false);
    }

    public function transportModeId(?string $mode): ?int
    {
        return $this->idByName('transport_modes', $mode, 'name', 'code', false);
    }

    public function bloodTypeId(?string $type): ?int
    {
        return $this->idByName('blood_types', $type, 'name', 'code', false);
    }

    public function guardianRelationshipId(?string $relationship): ?int
    {
        return $this->idByName('guardian_relationships', $relationship, 'name', 'code', false);
    }

    public function schoolOriginId(?string $school): ?int
    {
        return $this->idByName('school_origins', $this->normalizeSchoolOrigin($school), 'name', 'code', false);
    }

    public function subjectId(?string $subject): ?int
    {
        if ($this->blank($subject)) {
            return null;
        }

        return DB::table('mata_pelajaran')
            ->whereRaw('lower(nama) = ?', [Str::lower(trim($subject))])
            ->value('id');
    }

    public function surahId(?string $surah, ?int $number = null): ?int
    {
        if ($number) {
            $id = DB::table('surahs')->where('number', $number)->value('id');
            if ($id) {
                return (int) $id;
            }
        }

        if ($this->blank($surah)) {
            return null;
        }

        $name = trim((string) $surah);
        $id = DB::table('surahs')
            ->whereRaw('lower(name) = ?', [Str::lower($name)])
            ->value('id');

        if ($id) {
            return (int) $id;
        }

        return (int) DB::table('surahs')->insertGetId([
            'number' => $number ?: $this->nextSurahNumber(),
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function teacherIdByName(?string $name): ?int
    {
        if ($this->blank($name)) {
            return null;
        }

        return DB::table('users')
            ->where('role', 'guru')
            ->whereRaw('lower(name) = ?', [Str::lower(trim($name))])
            ->value('id');
    }

    public function classId(?string $className, bool $create = false): ?int
    {
        if ($this->blank($className)) {
            return null;
        }

        $name = trim($className);
        $existing = DB::table('classes')
            ->whereRaw('lower(name) = ?', [Str::lower($name)])
            ->value('id');

        if ($existing || !$create) {
            return $existing ? (int) $existing : null;
        }

        $levelId = $this->classLevelIdFromName($name);
        $genderGroup = Str::contains(Str::upper($name), ' PI') ? 'PI' : (Str::contains(Str::upper($name), ' PA') ? 'PA' : null);

        return (int) DB::table('classes')->insertGetId([
            'class_level_id' => $levelId,
            'code' => $this->uniqueCode('classes', $name),
            'name' => $name,
            'gender_group' => $genderGroup,
            'category' => $this->classCategory($name, $genderGroup),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function academicYearId(?string $year, bool $create = true): ?int
    {
        if ($this->blank($year)) {
            return null;
        }

        return $this->idByName('academic_years', $year, 'name', 'name', $create);
    }

    public function semesterId(?string $semester, ?string $academicYear = null, bool $create = true): ?int
    {
        if ($this->blank($semester)) {
            return null;
        }

        $name = trim($semester);
        $existing = DB::table('semesters')
            ->whereRaw('lower(name) = ?', [Str::lower($name)])
            ->value('id');

        if ($existing || !$create) {
            return $existing ? (int) $existing : null;
        }

        $academicYearId = $this->academicYearId($academicYear, true);
        return (int) DB::table('semesters')->insertGetId([
            'academic_year_id' => $academicYearId,
            'code' => $this->uniqueCode('semesters', $name),
            'name' => $name,
            'is_active' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function syncPaymentTypeMethods(int $paymentTypeId, mixed $methods): void
    {
        $names = collect(is_array($methods) ? $methods : [])
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->unique(fn ($item) => Str::lower($item))
            ->values();

        $ids = $names->map(fn ($name) => $this->paymentMethodId($name))->filter()->values();
        DB::table('payment_type_method')->where('payment_type_id', $paymentTypeId)->delete();

        foreach ($ids as $id) {
            DB::table('payment_type_method')->insert([
                'payment_type_id' => $paymentTypeId,
                'payment_method_id' => $id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function nameById(string $table, ?int $id, string $nameColumn = 'name'): ?string
    {
        if (!$id) {
            return null;
        }

        $name = DB::table($table)->where('id', $id)->value($nameColumn);
        return $name === null ? null : (string) $name;
    }

    public function className(?int $id): ?string
    {
        return $this->nameById('classes', $id);
    }

    public function schoolOriginName(?int $id): ?string
    {
        return $this->nameById('school_origins', $id);
    }

    public function subjectName(?int $id): ?string
    {
        return $this->nameById('mata_pelajaran', $id, 'nama');
    }

    public function teacherName(?int $id): ?string
    {
        return $this->nameById('users', $id);
    }

    public function dayName(?int $id): ?string
    {
        return $this->nameById('days', $id);
    }

    public function attendanceStatusName(?int $id): ?string
    {
        return $this->nameById('attendance_statuses', $id);
    }

    public function studentStatusName(?int $id): ?string
    {
        return $this->nameById('student_statuses', $id);
    }

    public function userStatusName(?int $id): ?string
    {
        return $this->nameById('user_statuses', $id);
    }

    public function paymentMethodName(?int $id): ?string
    {
        return $this->nameById('payment_methods', $id);
    }

    public function paymentStatusName(?int $id): ?string
    {
        return $this->nameById('payment_statuses', $id);
    }

    public function paymentPeriodTypeCode(?int $id): ?string
    {
        return $this->nameById('payment_period_types', $id, 'code');
    }

    public function ensureTeacherProfile(User $user): void
    {
        if ($user->role !== 'guru') {
            return;
        }

        $profileId = DB::table('teacher_profiles')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'teacher_code' => $user->kode_guru ?: $user->nis,
                'address' => $user->alamat,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        $profileId = DB::table('teacher_profiles')->where('user_id', $user->id)->value('id');
        if (!$profileId) {
            return;
        }

        $this->syncTeacherUnits((int) $profileId, $user->unit_kerja);
        $this->syncTeacherCategories((int) $profileId, $user->kategori_guru);
    }

    private function syncTeacherUnits(int $profileId, mixed $units): void
    {
        DB::table('teacher_profile_unit')->where('teacher_profile_id', $profileId)->delete();
        foreach ($this->listValues($units) as $name) {
            $unitId = DB::table('teacher_units')->whereRaw('lower(name) = ?', [Str::lower($name)])->value('id');
            if (!$unitId) {
                $unitId = DB::table('teacher_units')->insertGetId([
                    'name' => $name,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            DB::table('teacher_profile_unit')->insert([
                'teacher_profile_id' => $profileId,
                'teacher_unit_id' => $unitId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function syncTeacherCategories(int $profileId, mixed $categories): void
    {
        DB::table('teacher_profile_category')->where('teacher_profile_id', $profileId)->delete();
        foreach ($this->listValues($categories) as $name) {
            $categoryId = $this->idByCode('teacher_categories', $name);
            if ($categoryId) {
                DB::table('teacher_profile_category')->insert([
                    'teacher_profile_id' => $profileId,
                    'teacher_category_id' => $categoryId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function idByName(
        string $table,
        ?string $value,
        string $nameColumn = 'name',
        string $codeColumn = 'code',
        bool $create = false
    ): ?int {
        if ($this->blank($value)) {
            return null;
        }

        $name = trim($value);
        $id = DB::table($table)
            ->whereRaw("lower({$nameColumn}) = ?", [Str::lower($name)])
            ->value('id');

        if ($id || !$create) {
            return $id ? (int) $id : null;
        }

        return (int) DB::table($table)->insertGetId([
            $codeColumn => $this->uniqueCode($table, $name, $codeColumn),
            $nameColumn => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function regionId(
        string $table,
        ?string $name,
        ?string $parentColumn = null,
        ?int $parentId = null,
        ?string $externalCode = null,
        bool $create = false
    ): ?int {
        if ($this->blank($name) && $this->blank($externalCode)) {
            return null;
        }

        $cleanName = trim((string) $name);
        $cleanCode = trim((string) $externalCode);

        if ($cleanCode !== '') {
            $id = DB::table($table)->where('external_code', $cleanCode)->value('id');
            if ($id) {
                return (int) $id;
            }
        }

        $query = DB::table($table)->whereRaw('lower(name) = ?', [Str::lower($cleanName)]);
        if ($parentColumn) {
            $query->where($parentColumn, $parentId);
        }

        $id = $query->value('id');
        if ($id) {
            if ($cleanCode !== '') {
                DB::table($table)
                    ->where('id', $id)
                    ->whereNull('external_code')
                    ->update(['external_code' => $cleanCode, 'updated_at' => now()]);
            }
            return (int) $id;
        }

        if (!$create) {
            return null;
        }

        $payload = [
            'external_code' => $cleanCode !== '' ? $cleanCode : null,
            'name' => $cleanName,
            'created_at' => now(),
            'updated_at' => now(),
        ];
        if ($parentColumn) {
            $payload[$parentColumn] = $parentId;
        }

        return (int) DB::table($table)->insertGetId($payload);
    }

    private function idByCode(string $table, ?string $value): ?int
    {
        if ($this->blank($value)) {
            return null;
        }

        return DB::table($table)
            ->where('code', $this->code($value))
            ->value('id');
    }

    private function classLevelIdFromName(string $className): ?int
    {
        $name = Str::lower($className);
        foreach (['awal', 'tsani', 'tsalis', 'robi', 'khomis', 'sadis'] as $code) {
            if (Str::contains($name, $code)) {
                return DB::table('class_levels')->where('code', $code)->value('id');
            }
        }

        return null;
    }

    private function classCategory(string $className, ?string $genderGroup): ?string
    {
        $parts = preg_split('/\s+/', trim($className));
        if (!$parts || count($parts) < 2) {
            return null;
        }

        $base = implode(' ', array_slice($parts, 0, min(2, count($parts))));
        return trim($base . ($genderGroup ? ' ' . $genderGroup : ''));
    }

    private function uniqueCode(string $table, string $value, string $column = 'code'): string
    {
        $base = $this->code($value) ?: 'item';
        $code = $base;
        $counter = 2;

        while (DB::table($table)->where($column, $code)->exists()) {
            $code = $base . '_' . $counter++;
        }

        return $code;
    }

    private function nextSurahNumber(): int
    {
        return ((int) DB::table('surahs')->max('number')) + 1;
    }

    private function code(?string $value): string
    {
        return Str::of((string) $value)->trim()->lower()->slug('_')->toString();
    }

    private function normalizeSchoolOrigin(?string $value): ?string
    {
        if ($this->blank($value)) {
            return null;
        }

        $clean = trim(preg_replace('/\s+/', ' ', (string) $value));
        return preg_replace_callback('/^(mi|sd|mts|smp|ma|sma|smk)\b/i', function ($matches) {
            $token = Str::lower($matches[1]);
            return $token === 'mts' ? 'MTs' : Str::upper($token);
        }, $clean);
    }

    private function listValues(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        return collect($value)
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->unique(fn ($item) => Str::lower($item))
            ->values()
            ->all();
    }

    private function blank(?string $value): bool
    {
        return trim((string) $value) === '';
    }
}
