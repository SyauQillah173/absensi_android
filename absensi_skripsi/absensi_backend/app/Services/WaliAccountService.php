<?php

namespace App\Services;

use App\Models\Siswa;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class WaliAccountService
{
    public function syncForStudent(Siswa $siswa): ?User
    {
        $guardian = $this->resolveGuardianProfile($siswa);
        if (!$guardian['name']) {
            return null;
        }

        $wali = $this->findExistingWali($guardian, $siswa) ?? $this->createWaliAccount($guardian);
        $guardianProfileId = $this->syncGuardianProfile($guardian, $wali, $siswa);

        $updates = [
            'wali_id' => $wali->id,
            'guardian_profile_id' => $guardianProfileId,
        ];

        if (!$siswa->nama_wali) {
            $updates['nama_wali'] = $guardian['name'];
        }

        if (!$siswa->nama_wali_keluarga) {
            $updates['nama_wali_keluarga'] = $guardian['name'];
        }

        $siswa->forceFill($updates)->save();

        $this->refreshWaliContact($wali, $guardian);
        $this->syncGuardianStudentPivot($guardianProfileId, $siswa);

        return $wali->fresh();
    }

    public function syncAllStudents(?Collection $students = null): void
    {
        $targetStudents = $students ?? Siswa::query()->orderBy('id')->get();

        foreach ($targetStudents as $student) {
            $this->syncForStudent($student);
        }
    }

    public function attachMatchingStudents(User $wali): void
    {
        if ($wali->role !== 'wali') {
            return;
        }

        $normalizedName = $this->normalizeName($wali->name);
        if ($normalizedName === '') {
            return;
        }

        $students = Siswa::query()
            ->get()
            ->filter(function (Siswa $student) use ($normalizedName) {
                return $this->normalizeName($this->resolveGuardianProfile($student)['name']) === $normalizedName;
            });

        foreach ($students as $student) {
            $student->forceFill([
                'wali_id' => $wali->id,
                'nama_wali' => $student->nama_wali ?: $wali->name,
                'nama_wali_keluarga' => $student->nama_wali_keluarga ?: $wali->name,
            ])->save();

            $guardian = $this->resolveGuardianProfile($student);
            $guardianProfileId = $this->syncGuardianProfile($guardian, $wali, $student);
            $student->forceFill(['guardian_profile_id' => $guardianProfileId])->save();
            $this->syncGuardianStudentPivot($guardianProfileId, $student);
        }
    }

    private function findExistingWali(array $guardian, Siswa $siswa): ?User
    {
        if ($siswa->guardian_profile_id) {
            $userId = DB::table('guardian_profiles')
                ->where('id', $siswa->guardian_profile_id)
                ->value('user_id');

            if ($userId) {
                $linked = User::query()->where('role', 'wali')->find($userId);
                if ($linked) {
                    return $linked;
                }
            }
        }

        if ($siswa->wali_id) {
            $linked = User::query()->where('role', 'wali')->find($siswa->wali_id);
            if ($linked) {
                return $linked;
            }
        }

        if ($guardian['phone']) {
            $byPhone = User::query()
                ->where('role', 'wali')
                ->where('no_hp', $guardian['phone'])
                ->first();

            if ($byPhone) {
                return $byPhone;
            }
        }

        $normalizedName = $this->normalizeName($guardian['name']);
        if ($normalizedName === '') {
            return null;
        }

        return User::query()
            ->where('role', 'wali')
            ->get()
            ->first(function (User $user) use ($normalizedName) {
                return $this->normalizeName($user->name) === $normalizedName;
            });
    }

    private function createWaliAccount(array $guardian): User
    {
        $slug = Str::slug($guardian['name'], '.');
        $baseEmail = 'wali.' . ($slug !== '' ? $slug : 'santri');
        $email = $baseEmail . '@absensi.local';
        $suffix = 1;

        while (User::query()->where('email', $email)->exists()) {
            $email = $baseEmail . '.' . $suffix . '@absensi.local';
            $suffix++;
        }

        $nis = $this->generateUniqueCode('WLI', 'nis');
        $defaultPassword = config('auth.operational_default_password');

        return User::query()->create([
            'name' => $guardian['name'],
            'email' => $email,
            'role' => 'wali',
            'nis' => $nis,
            'nisn' => null,
            'no_hp' => $guardian['phone'],
            'status' => 'Aktif',
            'password' => Hash::make($defaultPassword),
            'password_default_encrypted' => Crypt::encryptString($defaultPassword),
            'password_current_encrypted' => Crypt::encryptString($defaultPassword),
            'password_changed_at' => null,
        ]);
    }

    private function refreshWaliContact(User $wali, array $guardian): void
    {
        $updates = [];
        if (!$wali->no_hp && $guardian['phone']) {
            $updates['no_hp'] = $guardian['phone'];
        }
        if (($wali->status ?? 'Aktif') !== 'Aktif') {
            $updates['status'] = 'Aktif';
        }

        if (!empty($updates)) {
            $wali->forceFill($updates)->save();
        }
    }

    private function resolveGuardianProfile(Siswa $siswa): array
    {
        $guardianName = $this->firstFilled([
            $siswa->nama_wali,
            $siswa->nama_wali_keluarga,
            $siswa->nama_ayah,
            $siswa->nama_ibu,
        ]);

        $guardianPhone = $this->firstFilled([
            $siswa->no_telepon_wali,
            $siswa->no_whatsapp_ayah,
            $siswa->no_ayah,
            $siswa->no_ibu,
            $siswa->no_whatsapp,
        ]);

        return [
            'name' => $guardianName,
            'phone' => $guardianPhone,
        ];
    }

    private function syncGuardianProfile(array $guardian, User $wali, Siswa $siswa): int
    {
        $address = $this->firstFilled([
            $siswa->alamat_wali_keluarga,
            $siswa->alamat_ayah,
            $siswa->alamat_ibu,
            $siswa->alamat,
        ]);

        $existingId = $siswa->guardian_profile_id
            ?: DB::table('guardian_profiles')->where('user_id', $wali->id)->value('id');

        if (!$existingId && $guardian['phone']) {
            $existingId = DB::table('guardian_profiles')->where('phone', $guardian['phone'])->value('id');
        }

        $payload = [
            'user_id' => $wali->id,
            'name' => $guardian['name'],
            'phone' => $guardian['phone'],
            'address' => $address,
            'updated_at' => now(),
        ];

        if ($existingId) {
            DB::table('guardian_profiles')->where('id', $existingId)->update($payload);
            return (int) $existingId;
        }

        return (int) DB::table('guardian_profiles')->insertGetId(array_merge($payload, [
            'created_at' => now(),
        ]));
    }

    private function syncGuardianStudentPivot(int $guardianProfileId, Siswa $siswa): void
    {
        DB::table('guardian_student')->updateOrInsert(
            [
                'guardian_profile_id' => $guardianProfileId,
                'siswa_id' => $siswa->id,
            ],
            [
                'relationship' => $siswa->wali_sama_dengan ?: 'wali',
                'is_primary' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    private function firstFilled(array $values): ?string
    {
        foreach ($values as $value) {
            $clean = trim((string) $value);
            if ($clean !== '') {
                return $clean;
            }
        }

        return null;
    }

    private function normalizeName(?string $value): string
    {
        $normalized = Str::lower(trim((string) $value));
        $normalized = str_replace(['.', ',', '-', '_'], ' ', $normalized);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? '';

        foreach (['bp', 'bpk', 'ibu', 'ust', 'ust.', 'ustadz', 'ustaz'] as $prefix) {
            if (str_starts_with($normalized, $prefix . ' ')) {
                $normalized = trim(substr($normalized, strlen($prefix)));
            }
        }

        return trim($normalized);
    }

    private function generateUniqueCode(string $prefix, string $column): string
    {
        $number = User::query()
            ->where($column, 'like', $prefix . '%')
            ->count() + 1;

        do {
            $code = sprintf('%s%03d', $prefix, $number);
            $number++;
        } while (User::query()->where($column, $code)->exists());

        return $code;
    }
}
