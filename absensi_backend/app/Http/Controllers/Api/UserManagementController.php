<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiAccessToken;
use App\Models\User;
use App\Services\ReferenceResolver;
use App\Services\WaliAccountService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    public function __construct(private readonly WaliAccountService $waliAccountService)
    {
    }

    private const UNIT_OPTIONS = [
        "SMP Assa'adah",
        "SMA Assa'adah",
        "MTs Assa'adah 1",
        "MTs Assa'adah 2",
        "Aliyah Assa'adah",
        "MI Assa'adah",
        "TK Muslimat Assa'adah",
    ];

    private const GURU_CATEGORY_OPTIONS = [
        'guru',
        'karyawan',
        'pejabat',
        'sertifikasi',
    ];

    public function index(Request $request)
    {
        $viewerCanSeePasswords = $this->viewerCanSeePasswords($request);
        $query = User::select(
            'id',
            'name',
            'email',
            'role',
            'role_id',
            'admin_type',
            'nis',
            'nisn',
            'no_hp',
            'jenis_kelamin',
            'foto_profil',
            'nik_user',
            'status',
            'user_status_id',
            'kode_guru',
            'alamat',
            'unit_kerja',
            'kategori_guru',
            'created_at',
            ...($viewerCanSeePasswords
                ? ['password_default_encrypted', 'password_changed_at']
                : [])
        )->orderBy('name');

        if ($request->filled('role')) {
            $roleId = app(ReferenceResolver::class)->roleId($request->role);
            $roleId ? $query->where('role_id', $roleId) : $query->whereRaw('1 = 0');
        }
        if ($request->filled('role_id')) {
            $query->where('role_id', $request->integer('role_id'));
        }
        if ($request->filled('status')) {
            $statusId = app(ReferenceResolver::class)->userStatusId($request->status);
            $statusId ? $query->where('user_status_id', $statusId) : $query->whereRaw('1 = 0');
        }
        if ($request->filled('user_status_id')) {
            $query->where('user_status_id', $request->integer('user_status_id'));
        }

        $users = $query->get()->map(function (User $user) use ($viewerCanSeePasswords) {
            $row = $user->toArray();

            if ($user->role === 'wali') {
                $children = \App\Models\Siswa::where('wali_id', $user->id)
                    ->orWhereHas('guardianProfile', fn ($q) => $q->where('user_id', $user->id))
                    ->select('id', 'nama', 'nis', 'kelas', 'komplek', 'kamar', 'status')
                    ->get();
                $row['anak'] = $children;
                $row['nama_santri'] = $children->pluck('nama')->filter()->join(', ');
                $row['nis_santri'] = $children->pluck('nis')->filter()->join(', ');
                $row['kelas_santri'] = $children->pluck('kelas')->filter()->join(', ');
                $row['komplek_santri'] = $children->pluck('komplek')->filter()->join(', ');
                $row['kamar_santri'] = $children->pluck('kamar')->filter()->join(', ');
            }

            if ($viewerCanSeePasswords) {
                $row = [
                    ...$row,
                    ...$this->buildPasswordDisplayMeta($user),
                ];
            }

            return $row;
        })->values();

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateUserPayload($request, requirePassword: true);
        $payload = $this->normalizePayload($validated, true);

        $user = User::create($payload);
        if ($user->role === 'wali') {
            $this->waliAccountService->attachMatchingStudents($user);
        }

        return response()->json([
            'success' => true,
            'message' => 'User baru berhasil ditambahkan',
            'data' => $user->fresh(),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $validated = $this->validateUserPayload($request, user: $user);
        $payload = $this->normalizePayload($validated, false, $user);

        $user->update($payload);
        if ($user->role === 'wali') {
            $this->waliAccountService->attachMatchingStudents($user);
        }

        return response()->json([
            'success' => true,
            'message' => 'Data user berhasil diperbarui',
            'data' => $user->fresh(),
        ]);
    }

    public function import(Request $request)
    {
        $rows = $request->validate([
            'rows' => 'required|array|min:1',
        ])['rows'];

        $results = $this->processRows($rows, false);

        return response()->json([
            'success' => true,
            ...$results,
        ]);
    }

    public function importGuru(Request $request)
    {
        $rows = $request->validate([
            'rows' => 'required|array|min:1',
        ])['rows'];

        $results = $this->processRows($rows, true);

        return response()->json([
            'success' => true,
            ...$results,
        ]);
    }

    public function destroy(User $user)
    {
        if ($user->role === 'admin' && User::where('role', 'admin')->count() <= 1) {
            return response()->json([
                'success' => false,
                'message' => 'Admin terakhir tidak boleh dihapus',
            ], 422);
        }

        $nama = $user->name;
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => "User $nama berhasil dihapus",
        ]);
    }

    public function resetPassword(Request $request, User $user)
    {
        $admin = $request->user();
        if (!$admin || $admin->role !== 'admin' || ($admin->status ?? 'Aktif') !== 'Aktif') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya admin aktif yang dapat reset password user.',
            ], 403);
        }

        $plainPassword = $this->generateTemporaryPassword($user);

        $user->forceFill([
            'password' => Hash::make($plainPassword),
            'password_default_encrypted' => Crypt::encryptString($plainPassword),
            'password_current_encrypted' => null,
            'password_changed_at' => null,
        ])->save();

        if ((int) $user->id !== (int) $admin->id) {
            ApiAccessToken::query()->where('user_id', $user->id)->delete();
        }

        return response()->json([
            'success' => true,
            'message' => "Password akun {$user->name} berhasil direset ke password default ($plainPassword).",
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'admin_type' => $user->admin_type,
                'kode_guru' => $user->kode_guru,
                'no_hp' => $user->no_hp,
                'password' => $plainPassword,
                'temporary_password' => $plainPassword,
                'password_display' => $plainPassword,
                'password_default' => $plainPassword,
                'password_display_label' => 'Password Default',
                'password_changed_at' => null,
            ],
        ]);
    }

    private function processRows(array $rows, bool $guruOnly): array
    {
        $success = 0;
        $failed = [];

        foreach ($rows as $index => $row) {
            $line = $index + 2;
            $data = is_array($row) ? $row : [];

            if ($guruOnly) {
                $data['role'] = 'guru';
            }

            $validator = Validator::make(
                $data,
                $this->rules(requirePassword: true, guruOnly: $guruOnly)
            );

            $validator->after(function ($validator) use ($data, $guruOnly) {
                $this->validateTeacherSpecifics($validator, $data, $guruOnly);
            });

            if ($validator->fails()) {
                $failed[] = [
                    'baris' => $line,
                    'data' => $data,
                    'alasan' => implode(' | ', $validator->errors()->all()),
                ];
                continue;
            }

            $existing = null;
            if ($guruOnly) {
                $existing = User::where('email', trim((string) ($data['email'] ?? '')))->first();
            }
            $payload = $this->normalizePayload(
                $validator->validated(),
                !$existing,
                $existing
            );

            try {
                if ($guruOnly) {
                    if ($existing && $existing->role !== 'guru') {
                        throw new \RuntimeException('Email sudah dipakai role lain');
                    }

                    if ($existing) {
                        $existing->update($payload);
                    } else {
                        User::create($payload);
                    }
                } else {
                    $user = User::create($payload);
                    if ($user->role === 'wali') {
                        $this->waliAccountService->attachMatchingStudents($user);
                    }
                }

                $success++;
            } catch (\Throwable $e) {
                $failed[] = [
                    'baris' => $line,
                    'data' => $data,
                    'alasan' => $e->getMessage(),
                ];
            }
        }

        return [
            'total_baris' => count($rows),
            'berhasil' => $success,
            'gagal' => count($failed),
            'errors' => $failed,
        ];
    }

    private function validateUserPayload(
        Request $request,
        ?User $user = null,
        bool $requirePassword = false
    ): array {
        $validated = $request->validate(
            $this->rules(
                user: $user,
                requirePassword: $requirePassword
            )
        );

        $validator = Validator::make($validated, []);
        $this->validateTeacherSpecifics($validator, $validated, false, $user);
        $validator->validate();

        return $validated;
    }

    private function rules(
        ?User $user = null,
        bool $requirePassword = false,
        bool $guruOnly = false
    ): array {
        $requiredRules = $user ? ['sometimes', 'required'] : ['required'];
        $passwordRule = $requirePassword
            ? ['required', 'string', 'min:6']
            : ['nullable', 'string', 'min:6'];

        $roleRule = $guruOnly
            ? [...$requiredRules, 'in:guru']
            : [...$requiredRules, 'in:admin,guru,wali'];

        $emailRule = ($guruOnly || in_array($request->role ?? $user?->role, ['guru', 'wali'], true))
            ? ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user?->id)]
            : [...$requiredRules, 'email', 'max:255', Rule::unique('users', 'email')->ignore($user?->id)];

        return [
            'name' => [...$requiredRules, 'string', 'max:255'],
            'email' => $emailRule,
            'role' => $roleRule,
            'role_id' => 'nullable|integer|exists:roles,id',
            'admin_type' => 'nullable|in:utama,bendahara,akademik,pondok,absensi,lainnya',
            'nis' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'nis')->ignore($user?->id),
            ],
            'nisn' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'nisn')->ignore($user?->id),
            ],
            'jenis_kelamin' => 'nullable|in:L,P',
            'nik_user' => 'nullable|string|max:50',
            'no_hp' => [...$requiredRules, 'string', 'max:50'],
            'status' => [...$requiredRules, 'in:Aktif,Nonaktif'],
            'user_status_id' => 'nullable|integer|exists:user_statuses,id',
            'password' => $passwordRule,
            'kode_guru' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'kode_guru')->ignore($user?->id),
            ],
            'alamat' => 'nullable|string',
            'unit_kerja' => 'nullable|array',
            'unit_kerja.*' => ['string'],
            'kategori_guru' => 'nullable|array',
            'kategori_guru.*' => ['string'],
        ];
    }

    private function validateTeacherSpecifics(
        \Illuminate\Contracts\Validation\Validator $validator,
        array $data,
        bool $guruOnly = false,
        ?User $user = null
    ): void {
        $role = $data['role'] ?? $user?->role;
        if ($role !== 'guru') {
            return;
        }

        if (($guruOnly || array_key_exists('kode_guru', $data)) && empty(trim((string) ($data['kode_guru'] ?? '')))) {
            $validator->errors()->add('kode_guru', 'Kode guru wajib diisi');
        }
    }

    private function normalizePayload(array $validated, bool $createMode, ?User $existingUser = null): array
    {
        foreach ([
            'email',
            'nis',
            'nisn',
            'no_hp',
            'jenis_kelamin',
            'nik_user',
            'kode_guru',
            'alamat',
        ] as $field) {
            if (array_key_exists($field, $validated)) {
                $validated[$field] = trim((string) $validated[$field]);
                if ($validated[$field] === '') {
                    $validated[$field] = null;
                }
            }
        }

        foreach (['unit_kerja', 'kategori_guru'] as $field) {
            if (array_key_exists($field, $validated)) {
                $validated[$field] = array_values(array_unique(array_filter(
                    array_map(
                        fn ($item) => trim((string) $item),
                        is_array($validated[$field]) ? $validated[$field] : []
                    )
                )));
            }
        }

        if (array_key_exists('unit_kerja', $validated)) {
            $validated['unit_kerja'] = $this->canonicalTeacherUnits($validated['unit_kerja']);
        }

        if (array_key_exists('kategori_guru', $validated)) {
            $validated['kategori_guru'] = $this->canonicalTeacherCategories($validated['kategori_guru']);
        }

        if (array_key_exists('password', $validated)) {
            $plainPassword = trim((string) $validated['password']);

            if ($plainPassword === '' && !$createMode) {
                unset($validated['password']);
            } else {
                $validated['password'] = Hash::make($plainPassword);
                $validated['password_current_encrypted'] = null;
                if ($createMode) {
                    $validated['password_default_encrypted'] = Crypt::encryptString($plainPassword);
                    $validated['password_changed_at'] = null;
                } else {
                    $validated['password_default_encrypted'] = $existingUser?->password_default_encrypted;
                    $validated['password_changed_at'] = now();
                }
            }
        }

        if (($validated['role'] ?? null) !== 'guru') {
            $validated['kode_guru'] = null;
            $validated['alamat'] = $validated['alamat'] ?? null;
            $validated['unit_kerja'] = null;
            $validated['kategori_guru'] = null;
        }

        if (($validated['role'] ?? $existingUser?->role) === 'admin') {
            $validated['admin_type'] = $validated['admin_type'] ?? $existingUser?->admin_type ?? 'utama';
        } else {
            $validated['admin_type'] = null;
        }

        if (isset($validated['role'])) {
            $validated['role_id'] = $validated['role_id']
                ?? app(ReferenceResolver::class)->roleId($validated['role']);
            $validated['role'] = app(ReferenceResolver::class)->nameById('roles', $validated['role_id'], 'code')
                ?? $validated['role'];
        }

        if (isset($validated['status'])) {
            $validated['user_status_id'] = $validated['user_status_id']
                ?? app(ReferenceResolver::class)->userStatusId($validated['status']);
            $validated['status'] = app(ReferenceResolver::class)->userStatusName($validated['user_status_id'])
                ?? $validated['status'];
        }

        return $validated;
    }

    private function canonicalTeacherUnits(array $values): array
    {
        $rows = DB::table('teacher_units')->get(['name']);
        $lookup = [];
        foreach ($rows as $row) {
            $lookup[strtolower(trim($row->name))] = $row->name;
        }

        return collect($values)
            ->map(function ($value) use ($lookup) {
                $key = strtolower(trim((string) $value));
                if ($key === '') {
                    return null;
                }
                return $lookup[$key] ?? null;
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function canonicalTeacherCategories(array $values): array
    {
        $rows = DB::table('teacher_categories')->get(['code', 'name']);
        $lookup = [];
        foreach ($rows as $row) {
            $lookup[strtolower(trim($row->code))] = $row->code;
            $lookup[strtolower(trim($row->name))] = $row->code;
        }

        return collect($values)
            ->map(function ($value) use ($lookup) {
                $key = strtolower(trim((string) $value));
                if ($key === '') {
                    return null;
                }
                return $lookup[$key] ?? null;
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function viewerCanSeePasswords(Request $request): bool
    {
        if (!$request->boolean('include_passwords')) {
            return false;
        }

        $viewer = $request->user();

        return $viewer->role === 'admin' && ($viewer->status ?? 'Aktif') === 'Aktif';
    }

    private function buildPasswordDisplayMeta(User $user): array
    {
        $defaultFallback = match ($user->role) {
            'guru' => 'guru123',
            'wali' => 'siswa12345',
            'admin' => 'admin12345',
            default => 'guru123',
        };

        if ($user->password_changed_at) {
            return [
                'password_display' => 'Sudah diganti user',
                'password_display_label' => 'Password Privat',
                'password_default' => $defaultFallback,
                'password_changed_at' => $user->password_changed_at?->toIso8601String(),
            ];
        }

        $defaultPassword = $this->decryptOperationalPassword($user->password_default_encrypted) ?: $defaultFallback;

        return [
            'password_display' => $defaultPassword,
            'password_display_label' => 'Password Default',
            'password_default' => $defaultPassword,
            'password_changed_at' => null,
        ];
    }

    private function decryptOperationalPassword(?string $value): ?string
    {
        if (!$value) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function generateTemporaryPassword(User $user): string
    {
        return match ($user->role) {
            'guru' => 'guru123',
            'wali' => 'siswa12345',
            'admin' => 'admin12345',
            default => 'guru123',
        };
    }
}
