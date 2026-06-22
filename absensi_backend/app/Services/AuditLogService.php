<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuditLogService
{
    public function record(
        Request $request,
        string $module,
        string $action,
        mixed $entity = null,
        ?array $before = null,
        ?array $after = null,
        array $metadata = [],
    ): void {
        try {
            $user = $request->user();
            if (!$user && $entity instanceof User) {
                $user = $entity;
            }
            $entityType = null;
            $entityId = null;

            if ($entity instanceof Model) {
                $entityType = class_basename($entity);
                $entityId = (string) $entity->getKey();
            } elseif (is_string($entity) || is_int($entity)) {
                $entityId = (string) $entity;
            }

            AuditLog::create([
                'actor_user_id' => $user?->id,
                'actor_role' => $user?->role,
                'actor_name' => $user?->name,
                'action' => $action,
                'module' => $module,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'before_values' => $before,
                'after_values' => $after,
                'metadata' => $metadata ?: null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Audit log gagal dicatat', [
                'module' => $module,
                'action' => $action,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
