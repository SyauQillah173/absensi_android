<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class UserProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
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
                'kode_guru' => $user->kode_guru,
                'alamat' => $user->alamat,
                'unit_kerja' => $user->unit_kerja ?? [],
                'kategori_guru' => $user->kategori_guru ?? [],
                'foto_profil' => $user->foto_profil,
                'foto_url' => $this->profilePhotoUrl($user),
                'permissions' => app(PermissionService::class)->permissionsForUser($user),
            ],
        ]);
    }

    // PUT /api/profile
    public function update(Request $request)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string',
            'email' => 'sometimes|email',
            'nis' => 'nullable|string',
            'nik_user' => 'nullable|string|max:16',
            'no_hp' => 'nullable|string|max:20',
            'jenis_kelamin' => 'nullable|in:L,P',
        ]);

        $user = $request->user();
        $before = $user->toArray();
        $user->update($validated);
        app(AuditLogService::class)->record($request, 'profile', 'update', $user, $before, $user->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Profil berhasil diperbarui',
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
                'kode_guru' => $user->kode_guru,
                'alamat' => $user->alamat,
                'unit_kerja' => $user->unit_kerja ?? [],
                'kategori_guru' => $user->kategori_guru ?? [],
                'foto_profil' => $user->foto_profil,
                'foto_url' => $this->profilePhotoUrl($user),
                'permissions' => app(PermissionService::class)->permissionsForUser($user),
            ],
        ]);
    }

    // POST /api/profile/foto
    public function uploadFoto(Request $request)
    {
        $request->validate([
            'foto' => 'required|image|max:2048', // max 2MB
        ]);

        $user = $request->user();

        // Delete old photo if exists
        if ($user->foto_profil) {
            $oldPath = storage_path('app/public/' . $user->foto_profil);
            if (file_exists($oldPath)) {
                unlink($oldPath);
            }
            $oldPublicPath = public_path('storage/' . $user->foto_profil);
            if (file_exists($oldPublicPath)) {
                unlink($oldPublicPath);
            }
        }

        $path = $request->file('foto')->store('profil', 'public');
        $this->mirrorPublicStorageFile($path);
        $user->update(['foto_profil' => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Foto profil berhasil diperbarui',
            'path' => $path,
            'url' => url('storage/' . $path),
            'foto_url' => url('storage/' . $path),
        ]);
    }

    public function deleteFoto(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }

        $this->deleteProfilePhotoFiles($user->foto_profil);
        $user->update(['foto_profil' => null]);

        return response()->json([
            'success' => true,
            'message' => 'Foto profil berhasil dihapus',
            'foto_url' => null,
        ]);
    }

    private function profilePhotoUrl(User $user): ?string
    {
        if (!$user->foto_profil) {
            return null;
        }

        $this->mirrorPublicStorageFile($user->foto_profil);

        return url('storage/' . $user->foto_profil);
    }

    private function mirrorPublicStorageFile(string $path): void
    {
        $source = storage_path('app/public/' . $path);
        $target = public_path('storage/' . $path);

        if (!File::exists($source) || File::exists($target)) {
            return;
        }

        File::ensureDirectoryExists(dirname($target));
        File::copy($source, $target);
    }

    private function deleteProfilePhotoFiles(?string $path): void
    {
        if (!$path) {
            return;
        }

        foreach ([
            storage_path('app/public/' . $path),
            public_path('storage/' . $path),
        ] as $filePath) {
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }
    }
}
