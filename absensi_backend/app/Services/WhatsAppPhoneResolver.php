<?php

namespace App\Services;

use App\Models\Siswa;

class WhatsAppPhoneResolver
{
    public function normalize(?string $value): ?string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $raw = preg_replace('/@c\.us$/i', '', $raw) ?? $raw;
        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        }
        if (str_starts_with($digits, '0')) {
            $digits = '62' . substr($digits, 1);
        } elseif (str_starts_with($digits, '8')) {
            $digits = '62' . $digits;
        }

        if (!preg_match('/^62\d{8,13}$/', $digits)) {
            return null;
        }

        return $digits;
    }

    public function resolveForStudent(Siswa $siswa): array
    {
        if ($siswa->getAttribute('notification_whatsapp_enabled') === false) {
            return [
                'valid' => false,
                'number' => null,
                'source' => null,
                'error' => 'Notifikasi WhatsApp wali dinonaktifkan pada data santri.',
            ];
        }

        $siswa->loadMissing(['guardianProfile', 'wali']);
        $candidates = [
            'wali_whatsapp_number' => $siswa->wali_whatsapp_number,
            'no_telepon_wali' => $siswa->no_telepon_wali,
        ];

        $relationship = strtolower((string) $siswa->wali_sama_dengan);
        if (str_contains($relationship, 'ayah')) {
            $candidates['no_whatsapp_ayah'] = $siswa->no_whatsapp_ayah;
            $candidates['no_ayah'] = $siswa->no_ayah;
        }
        if (str_contains($relationship, 'ibu')) {
            $candidates['no_whatsapp_ibu'] = $siswa->no_whatsapp_ibu;
            $candidates['no_ibu'] = $siswa->no_ibu;
        }

        $candidates += [
            'no_whatsapp' => $siswa->no_whatsapp,
            'no_whatsapp_ayah' => $siswa->no_whatsapp_ayah,
            'no_whatsapp_ibu' => $siswa->no_whatsapp_ibu,
            'guardian_profile_phone' => $siswa->guardianProfile?->phone,
            'wali_no_hp' => $siswa->wali?->no_hp,
        ];

        foreach ($candidates as $source => $value) {
            $number = $this->normalize($value);
            if ($number) {
                return [
                    'valid' => true,
                    'number' => $number,
                    'source' => $source,
                    'error' => null,
                ];
            }
        }

        return [
            'valid' => false,
            'number' => null,
            'source' => null,
            'error' => 'Nomor WhatsApp wali belum tersedia atau tidak valid.',
        ];
    }
}
