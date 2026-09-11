<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jadwal;
use App\Models\PaymentBill;
use App\Models\User;
use App\Services\ItNotificationEngineService;
use App\Services\ItSystemControlService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ItSystemControlController extends Controller
{
    protected ItSystemControlService $controlService;
    protected ItNotificationEngineService $notificationEngine;

    public function __construct(
        ItSystemControlService $controlService,
        ItNotificationEngineService $notificationEngine
    ) {
        $this->controlService = $controlService;
        $this->notificationEngine = $notificationEngine;
    }

    /**
     * Pastikan hanya Admin IT yang berhak mengakses master kontrol CMS ini
     */
    protected function authorizeItAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated');
        }

        $adminType = strtolower((string) ($user->admin_type ?? ''));
        $role = strtolower((string) ($user->role ?? ''));
        $email = strtolower((string) ($user->email ?? ''));
        $name = strtolower((string) ($user->name ?? ''));

        $isIt = in_array($adminType, ['it', 'admin_it', 'developer', 'dev', 'superadmin'], true) ||
                ($role === 'admin' && in_array($adminType, ['it', 'admin_it', 'superadmin'], true)) ||
                $email === 'syauqillah@absensi.com' ||
                str_contains($name, 'syauqillah');

        if (!$isIt) {
            abort(403, 'Akses ditolak: Fitur CMS Master Kontrol Sistem hanya diperuntukkan bagi Master Admin IT.');
        }
    }

    /**
     * GET /api/it-control/attendance-settings
     * Mengambil konfigurasi jam presensi global & daftar override per guru
     */
    public function getAttendanceSettings(Request $request): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $globalConfig = $this->controlService->getGlobalAttendanceConfig();
        $overrides = $this->controlService->getGuruOverrides();

        // Ambil daftar guru untuk dropdown pilihan override
        $teachers = User::where('role', 'guru')
            ->select('id', 'name', 'username', 'email')
            ->orderBy('name')
            ->get();

        // Ambil daftar jadwal aktif untuk opsi spesifik jadwal
        $jadwals = Jadwal::with(['mapel:id,name', 'kelas:id,name', 'teacher:id,name'])
            ->select('id', 'teacher_id', 'mapel_id', 'kelas_id', 'hari', 'jam_mulai', 'jam_selesai', 'status')
            ->where('status', 'Aktif')
            ->orderBy('hari')
            ->orderBy('jam_mulai')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => [
                'global'    => $globalConfig,
                'overrides' => $overrides,
                'teachers'  => $teachers,
                'jadwals'   => $jadwals,
                'server_time' => Carbon::now('Asia/Jakarta')->format('Y-m-d H:i:s'),
            ],
        ]);
    }

    /**
     * POST /api/it-control/attendance-settings/global
     * Simpan pengaturan default jam presensi guru global
     */
    public function saveGlobalAttendanceSettings(Request $request): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $validated = $request->validate([
            'default_open_lead_minutes' => 'required|integer|min:0|max:1440',
            'default_close_hour'        => ['required', 'regex:/^([01][0-9]|2[0-3]):[0-5][0-9]$/'],
            'auto_lock_enabled'         => 'boolean',
            'allow_late_submission'     => 'boolean',
            'late_tolerance_minutes'    => 'nullable|integer|min:0|max:300',
        ]);

        $updated = $this->controlService->saveGlobalAttendanceConfig($validated, $request->user()->id);

        return response()->json([
            'success' => true,
            'message' => 'Konfigurasi default presensi guru berhasil disimpan.',
            'data'    => $updated,
        ]);
    }

    /**
     * POST /api/it-control/attendance-settings/override
     * Tambah atau perbarui aturan khusus per-guru (custom open/close atau force toggle)
     */
    public function saveGuruOverride(Request $request): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $validated = $request->validate([
            'id'                => 'nullable|integer',
            'teacher_id'        => 'required|integer|exists:users,id',
            'jadwal_id'         => 'nullable|integer|exists:jadwals,id',
            'open_lead_minutes' => 'nullable|integer|min:0|max:1440',
            'custom_open_hour'  => ['nullable', 'regex:/^([01][0-9]|2[0-3]):[0-5][0-9]$/'],
            'close_hour'        => ['nullable', 'regex:/^([01][0-9]|2[0-3]):[0-5][0-9]$/'],
            'is_force_open'     => 'boolean',
            'is_force_locked'   => 'boolean',
            'notes'             => 'nullable|string|max:255',
        ]);

        $override = $this->controlService->saveGuruOverride(
            $validated,
            $validated['id'] ?? null,
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Aturan khusus presensi guru berhasil disimpan.',
            'data'    => $override,
        ]);
    }

    /**
     * DELETE /api/it-control/attendance-settings/override/{id}
     * Hapus override khusus guru
     */
    public function deleteGuruOverride(Request $request, int $id): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $deleted = $this->controlService->deleteGuruOverride($id);

        return response()->json([
            'success' => $deleted,
            'message' => $deleted ? 'Aturan khusus berhasil dihapus.' : 'Data aturan khusus tidak ditemukan.',
        ]);
    }

    /**
     * POST /api/it-control/attendance-settings/override/{id}/toggle-force
     * Toggle cepat Force Open atau Force Locked
     */
    public function toggleForceStatus(Request $request, int $id): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $validated = $request->validate([
            'type' => 'required|in:force_open,force_locked',
        ]);

        $override = $this->controlService->toggleForceStatus($id, $validated['type'], $request->user()->id);

        return response()->json([
            'success' => true,
            'message' => 'Status kontrol langsung guru berhasil diperbarui.',
            'data'    => $override,
        ]);
    }

    /**
     * GET /api/it-control/notification-settings
     * Mengambil konfigurasi smart notification (Wali SPP & Guru deadline) beserta statistik
     */
    public function getNotificationSettings(Request $request): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $waliConfig = $this->controlService->getWaliBillingNotificationConfig();
        $guruConfig = $this->controlService->getGuruDeadlineNotificationConfig();

        // Statistik ringkas wali penunggak (status != Lunas)
        $unpaidBillsCount = PaymentBill::where(function ($q) {
            $q->where('status', '!=', 'Lunas')->orWhereNull('status');
        })->count();

        $unpaidStudentsCount = PaymentBill::where(function ($q) {
            $q->where('status', '!=', 'Lunas')->orWhereNull('status');
        })->distinct('siswa_id')->count('siswa_id');

        $totalUnpaidAmount = PaymentBill::where(function ($q) {
            $q->where('status', '!=', 'Lunas')->orWhereNull('status');
        })->sum('total_amount');

        return response()->json([
            'success' => true,
            'data'    => [
                'wali_billing'  => $waliConfig,
                'guru_deadline' => $guruConfig,
                'stats'         => [
                    'unpaid_bills_count'    => $unpaidBillsCount,
                    'unpaid_students_count' => $unpaidStudentsCount,
                    'total_unpaid_amount'   => (float) $totalUnpaidAmount,
                ],
                'server_time'   => Carbon::now('Asia/Jakarta')->format('Y-m-d H:i:s'),
            ],
        ]);
    }

    /**
     * POST /api/it-control/notification-settings
     * Menyimpan konfigurasi smart notification
     */
    public function saveNotificationSettings(Request $request): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $validated = $request->validate([
            'target' => 'required|in:wali_billing,guru_deadline',
            'config' => 'required|array',
        ]);

        if ($validated['target'] === 'wali_billing') {
            $updated = $this->controlService->saveWaliBillingNotificationConfig($validated['config'], $request->user()->id);
        } else {
            $updated = $this->controlService->saveGuruDeadlineNotificationConfig($validated['config'], $request->user()->id);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan notifikasi berhasil disimpan.',
            'data'    => $updated,
        ]);
    }

    /**
     * POST /api/it-control/notifications/trigger-wali
     * Mengirimkan notifikasi tagihan SPP ke wali santri yang belum lunas secara instan
     */
    public function triggerWaliBillingReminder(Request $request): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $forceAll = $request->boolean('force_all', false);
        $result = $this->notificationEngine->sendWaliBillingReminders($forceAll);

        return response()->json([
            'success' => true,
            'message' => "Pengingat SPP terkirim ke {$result['parents_notified']} wali santri yang memiliki tunggakan.",
            'data'    => $result,
        ]);
    }

    /**
     * POST /api/it-control/notifications/trigger-guru
     * Mengirimkan notifikasi pengingat batas waktu presensi guru hari ini secara instan
     */
    public function triggerGuruReminder(Request $request): JsonResponse
    {
        $this->authorizeItAdmin($request);

        $force = $request->boolean('force', false);
        $result = $this->notificationEngine->sendGuruAttendanceReminders($force);

        return response()->json([
            'success' => true,
            'message' => "Pengingat presensi terkirim ke {$result['teachers_notified']} guru untuk {$result['classes_checked']} jadwal hari ini.",
            'data'    => $result,
        ]);
    }
}
