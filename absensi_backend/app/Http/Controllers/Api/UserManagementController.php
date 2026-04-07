<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
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
        $query = User::select(
            'id',
            'name',
            'email',
            'role',
            'nis',
            'nisn',
            'no_hp',
            'jenis_kelamin',
            'foto_profil',
            'nik_user',
            'status',
            'kode_guru',
            'alamat',
            'unit_kerja',
            'kategori_guru',
            'created_at'
        )->orderBy('name');

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateUserPayload($request, requirePassword: true);
        $payload = $this->normalizePayload($validated, true);

        $user = User::create($payload);

        return response()->json([
            'success' => true,
            'message' => 'User baru berhasil ditambahkan',
            'data' => $user->fresh(),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $validated = $this->validateUserPayload($request, user: $user);
        $payload = $this->normalizePayload($validated, false);

        $user->update($payload);

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

            $payload = $this->normalizePayload($validator->validated(), true);

            try {
                if ($guruOnly) {
                    $existing = User::where('email', $payload['email'])->first();
                    if ($existing && $existing->role !== 'guru') {
                        throw new \RuntimeException('Email sudah dipakai role lain');
                    }

                    if ($existing) {
                        $existing->update($payload);
                    } else {
                        User::create($payload);
                    }
                } else {
                    User::create($payload);
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
        $required = $user ? 'sometimes|required' : 'required';
        $passwordRule = $requirePassword
            ? 'required|string|min:6'
            : 'nullable|string|min:6';

        $roleRule = $guruOnly
            ? ($user ? 'sometimes|required|in:guru' : 'required|in:guru')
            : "$required|in:admin,guru,wali";

        return [
            'name' => "$required|string|max:255",
            'email' => [
                $required,
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user?->id),
            ],
            'role' => $roleRule,
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
            'no_hp' => "$required|string|max:50",
            'jenis_kelamin' => 'nullable|in:L,P',
            'nik_user' => 'nullable|string|max:50',
            'status' => "$required|in:Aktif,Nonaktif",
            'password' => $passwordRule,
            'kode_guru' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'kode_guru')->ignore($user?->id),
            ],
            'alamat' => 'nullable|string',
            'unit_kerja' => 'nullable|array',
            'unit_kerja.*' => ['string', Rule::in(self::UNIT_OPTIONS)],
            'kategori_guru' => 'nullable|array',
            'kategori_guru.*' => ['string', Rule::in(self::GURU_CATEGORY_OPTIONS)],
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

        if (($guruOnly || array_key_exists('unit_kerja', $data)) && empty($data['unit_kerja'])) {
            $validator->errors()->add('unit_kerja', 'Unit mengajar wajib dipilih minimal 1');
        }

        if (($guruOnly || array_key_exists('kategori_guru', $data)) && empty($data['kategori_guru'])) {
            $validator->errors()->add('kategori_guru', 'Status guru/karyawan wajib dipilih minimal 1');
        }
    }

    private function normalizePayload(array $validated, bool $createMode): array
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

        if (array_key_exists('password', $validated)) {
            if (empty($validated['password']) && !$createMode) {
                unset($validated['password']);
            } else {
                $validated['password'] = Hash::make($validated['password']);
            }
        }

        if (($validated['role'] ?? null) !== 'guru') {
            $validated['kode_guru'] = null;
            $validated['alamat'] = $validated['alamat'] ?? null;
            $validated['unit_kerja'] = null;
            $validated['kategori_guru'] = null;
        }

        return $validated;
    }
}
