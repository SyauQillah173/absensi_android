<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentSetting;
use App\Models\User;
use App\Services\ActorResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DocumentSettingController extends Controller
{
    public function show()
    {
        return response()->json([
            'success' => true,
            'data' => $this->formatSettings($this->getSettings()),
        ]);
    }

    public function update(Request $request)
    {
        $actor = $this->resolveAdmin($request);
        if (!$actor) {
            return $this->forbidden();
        }

        if ($request->missing('user_id') && $actor) {
            $request->merge(['user_id' => $actor->id]);
        }

        $documentType = $request->input('document_type', 'nilai');
        $validated = $request->validate(
            $documentType === 'pembayaran'
                ? [
                    'user_id' => 'nullable|exists:users,id',
                    'document_type' => 'nullable|in:nilai,pembayaran',
                    'payment_admin_name' => 'required|string|max:255',
                    'payment_admin_title' => 'required|string|max:255',
                    'payment_signature_mode' => 'required|in:kosong,uploaded',
                    'receipt_width' => 'nullable|string|max:20',
                    'bank_name' => 'nullable|string|max:100',
                    'bank_code' => 'nullable|string|max:20',
                    'bank_account_number' => 'nullable|string|max:50',
                    'bank_account_holder' => 'nullable|string|max:150',
                    'bank_sub_name' => 'nullable|string|max:50',
                ]
                : [
                    'user_id' => 'nullable|exists:users,id',
                    'document_type' => 'nullable|in:nilai,pembayaran',
                    'kepala_madin_nama' => 'required|string|max:255',
                    'jabatan' => 'required|string|max:255',
                    'signature_mode' => 'required|in:kosong,uploaded',
                ]
        );
        $this->assertRequestBelongsToAdmin($validated, $actor);

        unset($validated['user_id']);
        unset($validated['document_type']);

        $settings = $this->getSettings();
        $validated = $this->normalizeSignatureModePayload($validated, $settings);
        $settings->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan dokumen berhasil diperbarui',
            'data' => $this->formatSettings($settings->fresh()),
        ]);
    }

    public function uploadSignature(Request $request)
    {
        $actor = $this->resolveAdmin($request);
        if (!$actor) {
            return $this->forbidden();
        }

        $documentType = $request->input('document_type', 'nilai');

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'document_type' => 'nullable|in:nilai,pembayaran',
            'signature' => 'required|image|mimes:png|max:2048',
        ]);
        $this->assertRequestBelongsToAdmin($validated, $actor);

        $settings = $this->getSettings();

        $pathField = $documentType === 'pembayaran'
            ? 'payment_signature_path'
            : 'signature_path';
        $modeField = $documentType === 'pembayaran'
            ? 'payment_signature_mode'
            : 'signature_mode';

        if ($settings->{$pathField}) {
            $this->deletePublicStorageFile($settings->{$pathField});
        }

        $folder = $documentType === 'pembayaran'
            ? 'document-signatures/payment'
            : 'document-signatures/value';
        $path = $request->file('signature')->store($folder, 'public');
        $this->mirrorPublicStorageFile($path);
        $settings->update([
            $pathField => $path,
            $modeField => 'uploaded',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tanda tangan digital berhasil diupload',
            'data' => $this->formatSettings($settings->fresh()),
        ]);
    }

    public function uploadLogo(Request $request)
    {
        $actor = $this->resolveAdmin($request);
        if (!$actor) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'logo' => 'required|image|mimes:png,jpg,jpeg|max:2048',
        ]);
        $this->assertRequestBelongsToAdmin($validated, $actor);

        $settings = $this->getSettings();

        if ($settings->document_logo_path) {
            $this->deletePublicStorageFile($settings->document_logo_path);
        }

        $path = $request->file('logo')->store('document-logos', 'public');
        $this->mirrorPublicStorageFile($path);
        $settings->update(['document_logo_path' => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Logo dokumen berhasil diupload',
            'data' => $this->formatSettings($settings->fresh()),
        ]);
    }

    private function resolveAdmin(Request $request): ?User
    {
        return app(ActorResolver::class)->activeWithRole($request, 'admin');
    }

    private function getSettings(): DocumentSetting
    {
        return DocumentSetting::query()->firstOrCreate(
            ['id' => 1],
            [
                'kepala_madin_nama' => 'Kepala Madin',
                'jabatan' => 'Kepala Madrasah Diniyah',
                'signature_mode' => 'kosong',
                'document_logo_path' => null,
                'payment_admin_name' => 'Petugas Administrasi',
                'payment_admin_title' => 'Petugas Administrasi',
                'payment_signature_mode' => 'kosong',
                'receipt_width' => '58mm',
                'bank_name' => 'Bank Syariah Indonesia (BSI)',
                'bank_code' => '451',
                'bank_account_number' => '7171 2026 88',
                'bank_account_holder' => 'Yayasan Pondok Pesantren Qomaruddin',
                'bank_sub_name' => 'BSI SYARIAH',
            ]
        );
    }

    private function formatSettings(DocumentSetting $settings): array
    {
        if ($settings->document_logo_path) {
            $this->mirrorPublicStorageFile($settings->document_logo_path);
        }
        if ($settings->signature_path) {
            $this->mirrorPublicStorageFile($settings->signature_path);
        }
        if ($settings->payment_signature_path) {
            $this->mirrorPublicStorageFile($settings->payment_signature_path);
        }

        $logoUrl = $settings->document_logo_path
            ? url('storage/' . $settings->document_logo_path)
            : null;

        $nilai = [
            'kepala_madin_nama' => $settings->kepala_madin_nama,
            'jabatan' => $settings->jabatan,
            'signature_mode' => $settings->signature_mode,
            'signature_path' => $settings->signature_path,
            'signature_url' => $settings->signature_path ? url('storage/' . $settings->signature_path) : null,
            'document_logo_path' => $settings->document_logo_path,
            'document_logo_url' => $logoUrl,
        ];

        $pembayaran = [
            'admin_name' => $settings->payment_admin_name,
            'admin_title' => $settings->payment_admin_title,
            'signature_mode' => $settings->payment_signature_mode,
            'signature_path' => $settings->payment_signature_path,
            'signature_url' => $settings->payment_signature_path ? url('storage/' . $settings->payment_signature_path) : null,
            'document_logo_path' => $settings->document_logo_path,
            'document_logo_url' => $logoUrl,
        ];

        return [
            'id' => $settings->id,
            'kepala_madin_nama' => $nilai['kepala_madin_nama'],
            'jabatan' => $nilai['jabatan'],
            'signature_mode' => $nilai['signature_mode'],
            'signature_path' => $nilai['signature_path'],
            'signature_url' => $nilai['signature_url'],
            'document_logo_path' => $settings->document_logo_path,
            'document_logo_url' => $logoUrl,
            'payment_admin_name' => $pembayaran['admin_name'],
            'payment_admin_title' => $pembayaran['admin_title'],
            'payment_signature_mode' => $pembayaran['signature_mode'],
            'payment_signature_path' => $pembayaran['signature_path'],
            'payment_signature_url' => $pembayaran['signature_url'],
            'receipt_width' => $settings->receipt_width ?? '58mm',
            'bank_name' => $settings->bank_name ?? 'Bank Syariah Indonesia (BSI)',
            'bank_code' => $settings->bank_code ?? '451',
            'bank_account_number' => $settings->bank_account_number ?? '7171 2026 88',
            'bank_account_holder' => $settings->bank_account_holder ?? 'Yayasan Pondok Pesantren Qomaruddin',
            'bank_sub_name' => $settings->bank_sub_name ?? 'BSI SYARIAH',
            'nilai' => $nilai,
            'pembayaran' => $pembayaran,
            'updated_at' => optional($settings->updated_at)->format('Y-m-d H:i'),
        ];
    }

    private function forbidden()
    {
        return response()->json([
            'success' => false,
            'message' => 'Hanya admin yang dapat mengubah pengaturan dokumen',
        ], 403);
    }

    private function normalizeSignatureModePayload(array $payload, DocumentSetting $settings): array
    {
        if (($payload['signature_mode'] ?? null) === 'kosong' && $settings->signature_path) {
            $this->deletePublicStorageFile($settings->signature_path);
            $payload['signature_path'] = null;
        }

        if (($payload['signature_mode'] ?? null) === 'uploaded' && !$settings->signature_path) {
            throw ValidationException::withMessages([
                'signature_mode' => ['Upload tanda tangan nilai terlebih dahulu sebelum memilih mode uploaded.'],
            ]);
        }

        if (($payload['payment_signature_mode'] ?? null) === 'kosong' && $settings->payment_signature_path) {
            $this->deletePublicStorageFile($settings->payment_signature_path);
            $payload['payment_signature_path'] = null;
        }

        if (($payload['payment_signature_mode'] ?? null) === 'uploaded' && !$settings->payment_signature_path) {
            throw ValidationException::withMessages([
                'payment_signature_mode' => ['Upload tanda tangan pembayaran terlebih dahulu sebelum memilih mode uploaded.'],
            ]);
        }

        return $payload;
    }

    private function assertRequestBelongsToAdmin(array $payload, User $admin): void
    {
        if ((int) ($payload['user_id'] ?? 0) !== (int) $admin->id) {
            throw ValidationException::withMessages([
                'user_id' => ['User pengaturan dokumen tidak sesuai dengan sesi admin aktif.'],
            ]);
        }
    }

    private function deletePublicStorageFile(?string $path): void
    {
        if (!$path) {
            return;
        }

        Storage::disk('public')->delete($path);
        File::delete(public_path('storage/' . $path));
    }

    private function mirrorPublicStorageFile(string $path): void
    {
        $source = storage_path('app/public/' . $path);
        $target = public_path('storage/' . $path);

        if (!File::exists($source) || File::exists($target)) {
            return;
        }

        File::ensureDirectoryExists(dirname($target));
        File::copy($source, $target);
    }
}
