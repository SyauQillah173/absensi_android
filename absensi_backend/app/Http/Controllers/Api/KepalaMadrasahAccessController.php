<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KepalaMadrasahAccess;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\Request;

class KepalaMadrasahAccessController extends Controller
{
    /**
     * Pastikan hanya Admin IT yang dapat mengakses CMS Kepala Madrasah
     */
    protected function authorizeItAdmin(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated');
        }
        $adminType = strtolower((string) ($user->admin_type ?? ''));
        $role = strtolower((string) ($user->role ?? ''));

        $isIt = in_array($adminType, ['it', 'admin_it', 'developer', 'dev'], true) ||
                ($role === 'admin' && in_array($adminType, ['it', 'admin_it'], true));

        if (!$isIt) {
            abort(403, 'Akses ditolak: Pengaturan CMS ini khusus untuk Admin IT.');
        }
    }

    /**
     * GET /api/kepala-madrasah-access
     * Menampilkan daftar konfigurasi CMS Monitoring Kepala Madrasah & daftar ustadz yang tersedia
     */
    public function index(Request $request)
    {
        $this->authorizeItAdmin($request);

        $records = KepalaMadrasahAccess::with([
            'user:id,name,email,role,admin_type,status,foto_profil,kode_guru'
        ])->orderBy('id')->get();

        // Ambil daftar ustadz / admin yang dapat ditunjuk sebagai Kepala Madrasah
        $availableUsers = User::query()
            ->whereIn('role', ['admin', 'guru'])
            ->where('status', 'Aktif')
            ->select('id', 'name', 'email', 'role', 'admin_type', 'kode_guru')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $records,
            'available_users' => $availableUsers,
        ]);
    }

    /**
     * POST /api/kepala-madrasah-access
     * Menunjuk / Menyimpan konfigurasi Kepala Madrasah baru
     */
    public function store(Request $request)
    {
        $this->authorizeItAdmin($request);
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'nama_pejabat' => 'nullable|string|max:255',
            'jabatan' => 'required|string|max:255',
            'can_monitor_madin' => 'nullable|boolean',
            'can_monitor_sholat' => 'nullable|boolean',
            'can_monitor_ngaji' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $user = User::findOrFail($validated['user_id']);

        // Pastikan user memiliki akses admin/kepala madrasah
        $user->role = 'admin';
        $user->admin_type = 'kepala_madrasah';
        $user->save();

        $namaPejabat = !empty($validated['nama_pejabat']) ? $validated['nama_pejabat'] : $user->name;

        $record = KepalaMadrasahAccess::updateOrCreate(
            ['user_id' => $user->id],
            [
                'nama_pejabat' => $namaPejabat,
                'jabatan' => $validated['jabatan'],
                'can_monitor_madin' => $validated['can_monitor_madin'] ?? true,
                'can_monitor_sholat' => $validated['can_monitor_sholat'] ?? false,
                'can_monitor_ngaji' => $validated['can_monitor_ngaji'] ?? false,
                'is_active' => $validated['is_active'] ?? true,
            ]
        );

        app(AuditLogService::class)->record($request, 'cms_kepala_madrasah', 'save', $record);

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan akses monitoring Kepala Madrasah berhasil disimpan.',
            'data' => $record->fresh(['user:id,name,email,role,admin_type,status,foto_profil,kode_guru']),
        ], 201);
    }

    /**
     * PUT/PATCH /api/kepala-madrasah-access/{id}
     * Memperbarui switch toggle izin monitoring secara realtime
     */
    public function update(Request $request, $id)
    {
        $this->authorizeItAdmin($request);
        $record = KepalaMadrasahAccess::findOrFail($id);

        $validated = $request->validate([
            'nama_pejabat' => 'nullable|string|max:255',
            'jabatan' => 'nullable|string|max:255',
            'can_monitor_madin' => 'nullable|boolean',
            'can_monitor_sholat' => 'nullable|boolean',
            'can_monitor_ngaji' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $record->fill($validated);
        $record->save();

        app(AuditLogService::class)->record($request, 'cms_kepala_madrasah', 'update', $record);

        return response()->json([
            'success' => true,
            'message' => 'Hak akses monitoring berhasil diperbarui.',
            'data' => $record->fresh(['user:id,name,email,role,admin_type,status,foto_profil,kode_guru']),
        ]);
    }

    /**
     * DELETE /api/kepala-madrasah-access/{id}
     * Menghapus penugasan Kepala Madrasah
     */
    public function destroy(Request $request, $id)
    {
        $this->authorizeItAdmin($request);
        $record = KepalaMadrasahAccess::findOrFail($id);
        $record->delete();

        app(AuditLogService::class)->record($request, 'cms_kepala_madrasah', 'delete', null, ['id' => $id]);

        return response()->json([
            'success' => true,
            'message' => 'Penugasan Kepala Madrasah berhasil dihapus.',
        ]);
    }
}
