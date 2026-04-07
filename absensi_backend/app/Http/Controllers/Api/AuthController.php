<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Siswa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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

        $identifier = $request->identifier;

        // Try to find user by email, name (username), NIS, or NISN
        $user = User::where('email', $identifier)
            ->orWhere('name', $identifier)
            ->orWhere('nis', $identifier)
            ->orWhere('nisn', $identifier)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
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

        $responseData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'nis' => $user->nis,
            'nisn' => $user->nisn,
            'status' => $user->status ?? 'Aktif',
        ];

        // Jika role wali → sertakan data anak (siswa yang terhubung)
        if ($user->role === 'wali') {
            $anak = Siswa::where('wali_id', $user->id)
                ->select('id', 'nama', 'kelas', 'nis', 'jenis_kelamin', 'status')
                ->get();
            $responseData['anak'] = $anak;
        }

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil',
            'data' => $responseData,
        ]);
    }
}
