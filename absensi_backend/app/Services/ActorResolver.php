<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;

class ActorResolver
{
    public function active(Request $request, array $keys = ['user_id'], ?int $fallbackUserId = null): ?User
    {
        $requestUser = $request->user();
        if ($requestUser) {
            return $this->isActive($requestUser) ? $requestUser : null;
        }

        $userId = $fallbackUserId ?: $this->firstUserId($request, $keys);
        if (!$userId) {
            return null;
        }

        $user = User::find($userId);
        return $user && $this->isActive($user) ? $user : null;
    }

    public function activeWithRole(Request $request, array|string $roles, array $keys = ['user_id'], ?int $fallbackUserId = null): ?User
    {
        $actor = $this->active($request, $keys, $fallbackUserId);
        if (!$actor) {
            return null;
        }

        return $this->hasRole($actor, $roles) ? $actor : null;
    }

    public function hasRole(User $user, array|string $roles): bool
    {
        $allowed = is_array($roles) ? $roles : [$roles];
        return in_array($user->role, $allowed, true);
    }

    private function firstUserId(Request $request, array $keys): ?int
    {
        foreach ($keys as $key) {
            $value = $request->input($key, $request->query($key));
            if ($value) {
                return (int) $value;
            }
        }

        return null;
    }

    private function isActive(User $user): bool
    {
        return ($user->status ?? 'Aktif') === 'Aktif';
    }
}
