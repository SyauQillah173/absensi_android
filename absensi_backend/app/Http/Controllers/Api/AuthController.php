<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiAccessToken;
use App\Models\Siswa;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Login — accepts username/email/NIS/NISN + password
     * POST /api/login
     */
    public function login(Request $request)
    {
        $request->validate([
            'identifier' => 'required|string',
            'password' => 'required|string',
        ]);

        // Verifikasi Wajib Cloudflare Turnstile (Anti-Bot & Verifikasi Manusia)
        $turnstile = app(\App\Services\CloudflareTurnstileService::class);
        $turnstileToken = $request->input('cf_turnstile_response');

        if (!$turnstile->verify($turnstileToken, $request->ip())) {
            return response()->json([
                'success' => false,
                'message' => 'Verifikasi keamanan Cloudflare wajib diselesaikan. Pastikan widget verifikasi telah tercentang hijau.',
                'errors' => ['turnstile' => ['Verifikasi keamanan Cloudflare wajib diselesaikan.']],
            ], 422);
        }

        $user = $this->findUserByIdentifier($request->identifier, $request->password);

        if (!$user || !Hash::check($request->password, $user->password)) {
            // Jika login dengan default password yang valid sesuai peran
            if ($user && $user->role === 'wali' && $request->password === 'siswa12345') {
                $user->forceFill([
                    'password' => Hash::make('siswa12345'),
                ])->save();
            } elseif ($user && $user->role === 'admin' && in_array($request->password, ['admin123', 'admin12345', 'Ganti123'], true)) {
                $user->forceFill([
                    'password' => Hash::make($request->password),
                ])->save();
            } elseif ($user && $user->role === 'guru' && in_array($request->password, ['guru123', 'guru12345', 'Ganti123'], true)) {
                $user->forceFill([
                    'password' => Hash::make($request->password),
                ])->save();
            } else {
                if (!$user) {
                    Hash::check('dummy_password_for_timing_protection', '$2y$10$e8w.xL9YfUqZqK7r4U0g5eYdO9l5Q6Z1M8pW2kK9r4U0g5eYdO9l5');
                }
                return response()->json([
                    'success' => false,
                    'message' => 'Identitas login (Nama/Email/No HP/Kode Guru/NIS) atau Password salah. Silakan periksa kembali.',
                ], 401);
            }
        }

        if (($user->status ?? 'Aktif') !== 'Aktif') {
            return response()->json([
                'success' => false,
                'message' => 'Akun Anda sedang nonaktif. Hubungi admin madrasah.',
            ], 403);
        }

        $this->captureOperationalPassword($user, $request->password);
        $plainToken = Str::random(80);

        ApiAccessToken::create([
            'user_id' => $user->id,
            'name' => $request->input('device_name', 'mobile'),
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addDays(30),
        ]);
        app(AuditLogService::class)->record($request, 'auth', 'login', $user, null, [
            'user_id' => $user->id,
            'role' => $user->role,
            'device_name' => $request->input('device_name', 'mobile'),
        ]);

        $responseData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'admin_type' => $user->admin_type,
            'nis' => $user->nis,
            'nisn' => $user->nisn,
            'status' => $user->status ?? 'Aktif',
            'must_change_password' => $this->mustChangePassword($user),
            'pmb_visible_to_pengurus' => (bool) \App\Models\PmbCmsSetting::getValue('pmb_visible_to_pengurus', false),
        ];

        // Jika role guru → sertakan hak akses absensi sholat & ngaji
        if ($user->role === 'guru') {
            $canSholat = \App\Models\GuruAbsensiSholatAccess::where('user_id', $user->id)->where('is_active', true)->exists();
            $canNgaji = \App\Models\NgajiSchedule::where('status', 'Aktif')->where('teacher_id', $user->id)->exists();

            $responseData['hak_akses'] = [
                'absen_madin' => true,
                'absen_sholat' => $canSholat,
                'absen_ngaji' => $canNgaji,
                'nilai' => true,
            ];
        }

        // Jika role wali → sertakan data anak (siswa yang terhubung)
        if ($user->role === 'wali') {
            $anak = Siswa::where('wali_id', $user->id)
                ->orWhereHas('guardianProfile', fn ($query) => $query->where('user_id', $user->id))
                ->select('id', 'nama', 'kelas', 'class_id', 'nis', 'nisn', 'jenis_kelamin', 'status', 'komplek', 'kamar')
                ->get();
            $responseData['anak'] = $anak;
        }

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil',
            'token_type' => 'Bearer',
            'token' => $plainToken,
            'data' => $responseData,
        ]);
    }

    public function logout(Request $request)
    {
        $accessToken = $request->attributes->get('api_access_token');
        if ($accessToken instanceof ApiAccessToken) {
            $accessToken->delete();
        }
        app(AuditLogService::class)->record($request, 'auth', 'logout', $request->user(), null, [
            'user_id' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil',
        ]);
    }

    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'identifier' => 'required|string',
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        $user = $this->findUserByIdentifier($validated['identifier'], $validated['current_password']);

        if (!$user || !Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Verifikasi akun gagal. Cek kembali identitas akun dan password lama/default Anda.',
            ], 422);
        }

        if (($user->status ?? 'Aktif') !== 'Aktif') {
            return response()->json([
                'success' => false,
                'message' => 'Akun Anda sedang nonaktif. Hubungi admin madrasah.',
            ], 403);
        }

        $user->forceFill([
            'password' => Hash::make($validated['new_password']),
            'password_current_encrypted' => null,
            'password_changed_at' => now(),
        ])->save();

        $responseData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'admin_type' => $user->admin_type,
            'nis' => $user->nis,
            'nisn' => $user->nisn,
            'status' => $user->status ?? 'Aktif',
            'must_change_password' => false,
        ];

        if ($user->role === 'wali') {
            $responseData['anak'] = Siswa::where('wali_id', $user->id)
                ->orWhereHas('guardianProfile', fn ($query) => $query->where('user_id', $user->id))
                ->select('id', 'nama', 'kelas', 'class_id', 'nis', 'nisn', 'jenis_kelamin', 'status', 'komplek', 'kamar')
                ->get();
        }

        return response()->json([
            'success' => true,
            'message' => 'Password berhasil diperbarui. Gunakan password baru saat login.',
            'data' => $responseData,
        ]);
    }

    private function findUserByIdentifier(string $identifier, ?string $password = null): ?User
    {
        $identifier = trim($identifier);
        $lowerId = strtolower($identifier);
        $cleanPhone = preg_replace('/[^0-9]/', '', $identifier);
        $compactName = str_replace(' ', '', $lowerId);

        // =========================================================================
        // 1. PRIORITAS UTAMA: EXACT & COMPACT MATCH USER (ADMIN, GURU, WALI, SISWA)
        // Cocokkan persis: Email, Email Prefix (sebelum @), Name, Kode Guru, NIS, No HP
        // =========================================================================
        $directUser = User::query()
            ->where(function ($q) use ($lowerId, $identifier, $compactName, $cleanPhone) {
                $q->whereRaw('LOWER(email) = ?', [$lowerId])
                  ->orWhere('email', 'like', "{$lowerId}@%")
                  ->orWhereRaw('LOWER(name) = ?', [$lowerId])
                  ->orWhereRaw('LOWER(REPLACE(name, \' \', \'\')) = ?', [$compactName])
                  ->orWhereRaw('LOWER(kode_guru) = ?', [$lowerId])
                  ->orWhere('nis', $identifier)
                  ->orWhere('nisn', $identifier);

                if (strlen($cleanPhone) >= 8) {
                    $q->orWhere('no_hp', $identifier)
                      ->orWhere('no_hp', $cleanPhone)
                      ->orWhere('no_hp', '0' . substr($cleanPhone, 2))
                      ->orWhere('no_hp', '62' . substr($cleanPhone, 1));
                }
            })
            ->first();

        if ($directUser) {
            return $directUser;
        }

        // =========================================================================
        // 2. PRIORITAS 2: PENCARIAN FLEKSIBEL NAMA & ALIAS ADMIN
        // Contoh: "Udin", "Wildan", "Erwin", "Syauqillah", "Fahmi", "Eris", dll.
        // =========================================================================
        $adminUser = User::where('role', 'admin')
            ->where(function ($q) use ($lowerId, $compactName) {
                $q->whereRaw('LOWER(name) LIKE ?', ["%{$lowerId}%"])
                  ->orWhereRaw('LOWER(REPLACE(name, \' \', \'\')) LIKE ?', ["%{$compactName}%"]);
            })
            ->first();

        if ($adminUser) {
            return $adminUser;
        }

        // Alias Jabatan Admin (Contoh: "bendahara", "admin it", "kepala sekolah", dll.)
        $adminAliases = [
            'it' => ['it', 'admin it', 'admin-it', 'syauqillah', 'admin teknis'],
            'bendahara_1' => ['bendahara', 'bendahara 1', 'bendahara-1', 'admin bendahara', 'udin'],
            'bendahara_2' => ['bendahara 2', 'bendahara-2', 'wildan'],
            'kepala_sekolah' => ['kepala sekolah', 'kepsek', 'admin kepala sekolah', 'kepala madrasah', 'erwin'],
            'pengurus' => ['pengurus', 'admin pengurus', 'fahmi'],
            'keuangan' => ['keuangan', 'admin keuangan', 'eris'],
            'pmb' => ['pmb', 'admin pmb'],
            'utama' => ['admin', 'admin utama', 'superadmin'],
        ];

        foreach ($adminAliases as $adminType => $aliases) {
            if (in_array($lowerId, $aliases, true)) {
                $adminByType = User::where('role', 'admin')
                    ->where(function ($q) use ($adminType) {
                        $q->where('admin_type', $adminType)
                          ->orWhere('admin_type', 'like', "{$adminType}%");
                    })
                    ->first();
                if ($adminByType) {
                    return $adminByType;
                }
            }
        }

        // =========================================================================
        // 3. PRIORITAS 3: PENCARIAN FLEKSIBEL GURU (NAMA TANPA GELAR / KODE GURU)
        // Guru "UST. MUSTAQIM" bisa login ketik "Mustaqim", "Ust Mustaqim", atau kode "MQ"
        // =========================================================================
        $strippedGuruName = trim(preg_replace('/^(ust\.|ustadz|ustadzah|guru|bapak|ibu|pak|bu)\s+/i', '', $lowerId));

        $guruUser = User::where('role', 'guru')
            ->where(function ($q) use ($lowerId, $compactName, $strippedGuruName) {
                $q->whereRaw('LOWER(name) LIKE ?', ["%{$lowerId}%"])
                  ->orWhereRaw('LOWER(kode_guru) = ?', [$lowerId])
                  ->orWhereRaw('LOWER(REPLACE(name, \' \', \'\')) LIKE ?', ["%{$compactName}%"]);

                if (strlen($strippedGuruName) >= 3) {
                    $q->orWhereRaw('LOWER(name) LIKE ?', ["%{$strippedGuruName}%"]);
                }
            })
            ->first();

        if ($guruUser) {
            return $guruUser;
        }

        // =========================================================================
        // 4. REGISTRASI PMB ONLINE
        // =========================================================================
        if (str_starts_with($lowerId, 'pmb-')) {
            $pmb = \App\Models\PmbRegistration::whereRaw('LOWER(registration_number) = ?', [$lowerId])->first();
            if ($pmb && $pmb->user_id) {
                $user = User::find($pmb->user_id);
                if ($user) {
                    return $user;
                }
            }
        }

        // =========================================================================
        // 5. PRIORITAS 5: WALI SANTRI & SISWA (NIS, NAMA SANTRI, NAMA WALI)
        // =========================================================================
        $student = Siswa::with('wali')
            ->where(function ($q) use ($lowerId, $identifier, $compactName) {
                $q->where('nis', $identifier)
                  ->orWhere('nisn', $identifier)
                  ->orWhereRaw('LOWER(nama) = ?', [$lowerId])
                  ->orWhereRaw('LOWER(REPLACE(nama, \' \', \'\')) = ?', [$compactName]);
            })
            ->first();

        // Fallback jika ada variasi spasi atau nama lengkap santri
        if (!$student && strlen($identifier) >= 3) {
            $student = Siswa::with('wali')
                ->whereRaw('LOWER(nama) LIKE ?', ['%' . $lowerId . '%'])
                ->first();
        }

        if ($student) {
            $wali = $student->wali;
            if (!$wali || $wali->role !== 'wali') {
                $waliService = app(\App\Services\WaliAccountService::class);
                $wali = $waliService->syncForStudent($student);
                if (!$wali) {
                    $slug = $student->nis ?: \Illuminate\Support\Str::slug($student->nama);
                    $wali = User::create([
                        'name' => $student->nama_wali ?: ('Wali ' . $student->nama),
                        'email' => 'wali.' . $slug . '@wali.pondok.id',
                        'role' => 'wali',
                        'status' => 'Aktif',
                        'password' => Hash::make('siswa12345'),
                    ]);
                    $student->forceFill(['wali_id' => $wali->id])->save();
                }
            }

            // Jika login dengan password default 'siswa12345', pastikan hash sesuai
            if ($password === 'siswa12345' && !Hash::check('siswa12345', $wali->password)) {
                $wali->forceFill([
                    'password' => Hash::make('siswa12345'),
                ])->save();
            }

            return $wali;
        }

        return null;
    }

    private function captureOperationalPassword(User $user, string $plainPassword): void
    {
        $updates = [];

        $defaultPassword = config('auth.operational_default_password');
        if (empty($user->password_default_encrypted) && $plainPassword === $defaultPassword) {
            $updates['password_default_encrypted'] = Crypt::encryptString($plainPassword);
        }

        if (!empty($updates)) {
            $user->forceFill($updates)->save();
        }
    }

    private function mustChangePassword(User $user): bool
    {
        return in_array($user->role, ['guru', 'wali'], true) && empty($user->password_changed_at);
    }
}
