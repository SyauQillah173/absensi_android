<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $notifications = AppNotification::query()
            ->where('user_id', $request->user()?->id)
            ->orderByDesc('created_at')
            ->limit((int) $request->input('limit', 50))
            ->get();

        return response()->json([
            'success' => true,
            'unread_count' => $notifications->where('is_read', false)->count(),
            'data' => $notifications,
        ]);
    }

    public function markRead(Request $request, AppNotification $notification)
    {
        if ((int) $notification->user_id !== (int) $request->user()?->id && $request->user()?->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Notifikasi tidak ditemukan untuk akun ini',
            ], 404);
        }

        $notification->update([
            'is_read' => true,
            'read_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $notification->fresh(),
        ]);
    }
}
