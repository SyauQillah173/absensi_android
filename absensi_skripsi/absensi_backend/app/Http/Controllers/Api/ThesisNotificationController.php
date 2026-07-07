<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DetailPresensi;
use App\Models\WhatsAppMessageLog;
use App\Services\ThesisNotificationService;
use Illuminate\Http\Request;

class ThesisNotificationController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => WhatsAppMessageLog::with('detailPresensi.santri:id_santri,nama_santri')
                ->latest()->paginate(50),
        ]);
    }

    public function retry(WhatsAppMessageLog $notification, ThesisNotificationService $service)
    {
        $service->retry($notification);

        return response()->json(['success' => true, 'message' => 'Notifikasi masuk antrean kirim ulang.']);
    }

    public function whatsapp(Request $request, ThesisNotificationService $service)
    {
        $data = $request->validate([
            'id_detail_presensi' => 'required|integer|exists:detail_presensi,id_detail_presensi',
        ]);
        $log = $service->queue(DetailPresensi::findOrFail($data['id_detail_presensi']));

        return response()->json([
            'success' => true,
            'message' => $log ? 'Notifikasi WhatsApp masuk antrean.' : 'Status Hadir tidak memerlukan notifikasi WhatsApp.',
            'data' => $log,
        ], 201);
    }
}
