<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminPaymentSecuritySetting;
use App\Models\User;
use App\Services\ActorResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminPaymentSecuritySettingController extends Controller
{
    public function show(Request $request)
    {
        $admin = $this->resolveAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatSetting($this->settingFor($admin)),
        ]);
    }

    public function update(Request $request)
    {
        $admin = $this->resolveAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'face_enabled' => 'required|boolean',
            'fingerprint_enabled' => 'required|boolean',
            'verification_mode' => 'required|in:face_only,fingerprint_only,face_or_fingerprint,face_primary_fingerprint_backup',
            'device_label' => 'nullable|string|max:255',
            'pin_enabled' => 'nullable|boolean',
            'transaction_pin' => ['nullable', 'string', 'regex:/^\d{4,12}$/'],
        ]);
        $this->assertRequestBelongsToAdmin($validated, $admin);

        $hasBiometric = $validated['face_enabled'] || $validated['fingerprint_enabled'];
        $setting = $this->settingFor($admin);
        $pinEnabled = (bool) ($validated['pin_enabled'] ?? $setting->pin_enabled);
        $plainPin = $validated['transaction_pin'] ?? null;

        if ($hasBiometric && $validated['verification_mode'] === 'face_only' && !$validated['face_enabled']) {
            throw ValidationException::withMessages([
                'verification_mode' => 'Mode Face ID wajib membutuhkan Face ID aktif.',
            ]);
        }

        if ($hasBiometric && $validated['verification_mode'] === 'fingerprint_only' && !$validated['fingerprint_enabled']) {
            throw ValidationException::withMessages([
                'verification_mode' => 'Mode Fingerprint wajib membutuhkan Fingerprint aktif.',
            ]);
        }

        if (
            in_array($validated['verification_mode'], ['face_or_fingerprint', 'face_primary_fingerprint_backup'], true)
            && (!$validated['face_enabled'] || !$validated['fingerprint_enabled'])
        ) {
            throw ValidationException::withMessages([
                'verification_mode' => 'Mode gabungan membutuhkan Face ID dan Fingerprint aktif.',
            ]);
        }

        if ($validated['face_enabled'] && !$validated['fingerprint_enabled'] && $validated['verification_mode'] !== 'face_only') {
            throw ValidationException::withMessages([
                'verification_mode' => 'Jika hanya Face ID yang aktif, gunakan mode Face ID wajib.',
            ]);
        }

        if (!$validated['face_enabled'] && $validated['fingerprint_enabled'] && $validated['verification_mode'] !== 'fingerprint_only') {
            throw ValidationException::withMessages([
                'verification_mode' => 'Jika hanya Fingerprint yang aktif, gunakan mode Fingerprint wajib.',
            ]);
        }

        if (
            $validated['face_enabled']
            && $validated['fingerprint_enabled']
            && !in_array($validated['verification_mode'], ['face_or_fingerprint', 'face_primary_fingerprint_backup'], true)
        ) {
            throw ValidationException::withMessages([
                'verification_mode' => 'Jika Face ID dan Fingerprint aktif, gunakan mode Face ID atau Fingerprint.',
            ]);
        }

        $now = now();
        $safeMode = $hasBiometric ? $validated['verification_mode'] : 'fingerprint_only';

        if ($pinEnabled && !$plainPin && !$setting->transaction_pin_hash) {
            throw ValidationException::withMessages([
                'transaction_pin' => 'PIN transaksi wajib dibuat sebelum verifikasi PIN diaktifkan.',
            ]);
        }

        $setting->update([
            'face_enabled' => (bool) $validated['face_enabled'],
            'fingerprint_enabled' => (bool) $validated['fingerprint_enabled'],
            'verification_mode' => $safeMode,
            'biometric_required' => (bool) $hasBiometric,
            'pin_enabled' => $pinEnabled,
            'transaction_pin_hash' => $pinEnabled
                ? ($plainPin ? Hash::make($plainPin) : $setting->transaction_pin_hash)
                : null,
            'pin_set_at' => $pinEnabled
                ? ($plainPin ? $now : $setting->pin_set_at)
                : null,
            'face_registered_at' => $validated['face_enabled']
                ? ($setting->face_registered_at ?? $now)
                : null,
            'fingerprint_registered_at' => $validated['fingerprint_enabled']
                ? ($setting->fingerprint_registered_at ?? $now)
                : null,
            'last_device_label' => $validated['device_label'] ?? $setting->last_device_label,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Keamanan pembayaran berhasil diperbarui',
            'data' => $this->formatSetting($setting->fresh()),
        ]);
    }

    private function settingFor(User $admin): AdminPaymentSecuritySetting
    {
        return AdminPaymentSecuritySetting::query()->firstOrCreate(
            ['user_id' => $admin->id],
            [
                'face_enabled' => false,
                'fingerprint_enabled' => false,
                'verification_mode' => 'fingerprint_only',
                'biometric_required' => false,
                'pin_enabled' => false,
            ]
        );
    }

    private function formatSetting(AdminPaymentSecuritySetting $setting): array
    {
        return [
            'id' => $setting->id,
            'user_id' => $setting->user_id,
            'face_enabled' => (bool) $setting->face_enabled,
            'fingerprint_enabled' => (bool) $setting->fingerprint_enabled,
            'verification_mode' => $setting->verification_mode,
            'biometric_required' => (bool) $setting->biometric_required,
            'pin_enabled' => (bool) $setting->pin_enabled,
            'pin_set_at' => optional($setting->pin_set_at)->toIso8601String(),
            'pin_configured' => !empty($setting->transaction_pin_hash),
            'face_registered_at' => optional($setting->face_registered_at)->toIso8601String(),
            'fingerprint_registered_at' => optional($setting->fingerprint_registered_at)->toIso8601String(),
            'last_verified_at' => optional($setting->last_verified_at)->toIso8601String(),
            'last_verification_method' => $setting->last_verification_method,
            'last_payment_transaction_code' => $setting->last_payment_transaction_code,
            'last_device_label' => $setting->last_device_label,
            'platform_note' => 'Template biometrik tetap dikelola sistem operasi perangkat. Fingerprint menjadi metode utama Android; Face Unlock dipakai jika OS mengeksposnya ke aplikasi. Jika biometrik tidak tersedia, transaksi dikunci PIN transaksi admin.',
            'updated_at' => optional($setting->updated_at)->toIso8601String(),
        ];
    }

    private function resolveAdmin(Request $request): ?User
    {
        return app(ActorResolver::class)->activeWithRole($request, 'admin');
    }

    private function assertRequestBelongsToAdmin(array $payload, User $admin): void
    {
        if ((int) ($payload['user_id'] ?? 0) !== (int) $admin->id) {
            throw ValidationException::withMessages([
                'user_id' => ['User pengaturan keamanan tidak sesuai dengan sesi admin aktif.'],
            ]);
        }
    }

    private function forbidden()
    {
        return response()->json([
            'success' => false,
            'message' => 'Hanya admin yang dapat mengatur keamanan pembayaran',
        ], 403);
    }
}
