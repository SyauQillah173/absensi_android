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
            'captcha' => 'required|string',
            'captcha_key' => 'required|string',
        ], [
            'captcha.required' => 'Kode keamanan harus diisi.',
            'captcha_key.required' => 'Key keamanan tidak ditemukan.',
        ]);

        if (!captcha_api_check($request->captcha, $request->captcha_key, 'default')) {
            return response()->json([
                'success' => false,
                'message' => 'Kode verifikasi keamanan salah atau sudah kedaluwarsa. Silakan refresh gambar captcha.',
            ], 422);
        }

        $user = $this->findUserByIdentifier($request->identifier);

        if (!$user || !Hash::check($request->password, $user->password)) {
            if (!$user) {
                Hash::check('dummy_password_for_timing_protection', '$2y$10$abcdefghijklmnopqrstuv.dummyhashforprotection0000000000');
            }
            return response()->json([
                'success' => false,
                'message' => 'Username/email/NIS atau password salah',
            ], 401);
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
        ];

        // Jika role wali → sertakan data anak (siswa yang terhubung)
        if ($user->role === 'wali') {
            $anak = Siswa::where('wali_id', $user->id)
                ->orWhereHas('guardianProfile', fn ($query) => $query->where('user_id', $user->id))
                ->select('id', 'nama', 'kelas', 'class_id', 'nis', 'jenis_kelamin', 'status')
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

        $user = $this->findUserByIdentifier($validated['identifier']);

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
                ->select('id', 'nama', 'kelas', 'class_id', 'nis', 'jenis_kelamin', 'status')
                ->get();
        }

        return response()->json([
            'success' => true,
            'message' => 'Password berhasil diperbarui. Gunakan password baru saat login.',
            'data' => $responseData,
        ]);
    }

    private function findUserByIdentifier(string $identifier): ?User
    {
        $identifier = trim($identifier);

        $user = User::where('email', $identifier)
            ->orWhere('name', $identifier)
            ->orWhere('nis', $identifier)
            ->orWhere('nisn', $identifier)
            ->first();

        if ($user) {
            return $user;
        }

        $student = Siswa::with('wali')
            ->where('nis', $identifier)
            ->orWhere('nisn', $identifier)
            ->first();

        if ($student?->wali && $student->wali->role === 'wali') {
            return $student->wali;
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
