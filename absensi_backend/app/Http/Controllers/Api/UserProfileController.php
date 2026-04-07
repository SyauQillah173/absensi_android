<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    // GET /api/profile?user_id=X
    public function show(Request $request)
    {
        $userId = $request->query('user_id');
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'user_id required'], 400);
        }

        $user = User::find($userId);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'nis' => $user->nis,
                'nisn' => $user->nisn,
                'nik_user' => $user->nik_user,
                'no_hp' => $user->no_hp,
                'jenis_kelamin' => $user->jenis_kelamin,
                'foto_profil' => $user->foto_profil,
                'foto_url' => $user->foto_profil ? url('storage/' . $user->foto_profil) : null,
            ],
        ]);
    }

    // PUT /api/profile
    public function update(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'name' => 'sometimes|string',
            'email' => 'sometimes|email',
            'nis' => 'nullable|string',
            'nik_user' => 'nullable|string|max:16',
            'no_hp' => 'nullable|string|max:20',
            'jenis_kelamin' => 'nullable|in:L,P',
        ]);

        $user = User::find($validated['user_id']);
        unset($validated['user_id']);
        $user->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Profil berhasil diperbarui',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'nis' => $user->nis,
                'nik_user' => $user->nik_user,
                'no_hp' => $user->no_hp,
                'jenis_kelamin' => $user->jenis_kelamin,
                'foto_profil' => $user->foto_profil,
                'foto_url' => $user->foto_profil ? url('storage/' . $user->foto_profil) : null,
            ],
        ]);
    }

    // POST /api/profile/foto
    public function uploadFoto(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'foto' => 'required|image|max:2048', // max 2MB
        ]);

        $user = User::find($request->user_id);

        // Delete old photo if exists
        if ($user->foto_profil) {
            $oldPath = storage_path('app/public/' . $user->foto_profil);
            if (file_exists($oldPath)) {
                unlink($oldPath);
            }
        }

        $path = $request->file('foto')->store('profil', 'public');
        $user->update(['foto_profil' => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Foto profil berhasil diperbarui',
            'path' => $path,
            'url' => url('storage/' . $path),
        ]);
    }
}
