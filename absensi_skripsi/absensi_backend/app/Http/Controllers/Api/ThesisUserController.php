<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ThesisUserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query();

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('username', 'ilike', "%{$search}%");
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('name')->get(['id', 'name', 'username', 'role', 'status_aktif']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users,username',
            'password' => 'required|string|min:8',
            'role' => 'required|in:superadmin,admin,guru,kepala_sekolah',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['username'] . '@skripsi.local',
            'username' => $data['username'],
            'password' => Hash::make($data['password']),
            'password_hash' => Hash::make($data['password']),
            'role' => $data['role'],
            'status' => 'Aktif',
            'status_aktif' => true,
        ]);

        return response()->json(['success' => true, 'data' => $user], 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'username' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('users', 'username')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'role' => 'sometimes|required|in:superadmin,admin,guru,kepala_sekolah',
            'status_aktif' => 'sometimes|boolean',
        ]);

        if (isset($data['password']) && !empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
            $data['password_hash'] = $data['password'];
        } else {
            unset($data['password']);
        }

        $user->update($data);

        return response()->json(['success' => true, 'data' => $user]);
    }

    public function destroy(User $user)
    {
        if ($user->guru()->exists()) {
            return response()->json(['success' => false, 'message' => 'User ini terikat dengan data Guru. Silakan hapus/nonaktifkan Guru dari tab Guru.'], 400);
        }

        $user->delete();

        return response()->json(['success' => true, 'message' => 'User dihapus.']);
    }
}
