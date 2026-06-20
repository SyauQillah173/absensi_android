<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Throwable;

class AdminActivityNotificationService
{
    public function notifyAdmins(
        string $title,
        string $message,
        string $type,
        array $data = [],
    ): void {
        try {
            if (!Schema::hasTable('notifications')) {
                return;
            }

            User::query()
                ->where('role', 'admin')
                ->where('status', 'Aktif')
                ->pluck('id')
                ->each(function (int $userId) use ($title, $message, $type, $data): void {
                    AppNotification::query()->create([
                        'user_id' => $userId,
                        'title' => $title,
                        'message' => $message,
                        'type' => $type,
                        'data' => $data,
                    ]);
                });
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
