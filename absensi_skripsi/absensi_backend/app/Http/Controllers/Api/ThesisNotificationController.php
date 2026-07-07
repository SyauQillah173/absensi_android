<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppMessageLog;
use App\Services\ThesisNotificationService;

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
}
