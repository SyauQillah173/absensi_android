<?php

namespace App\Services;

use App\Models\Siswa;
use App\Models\WhatsAppTemplate;
use Carbon\CarbonInterface;

class WhatsAppTemplateService
{
    public function templateFor(string $module, ?string $eventType = null): string
    {
        $template = WhatsAppTemplate::query()
            ->where('is_active', true)
            ->where(function ($query) use ($module, $eventType) {
                $query->where('code', $module)
                    ->orWhere(function ($builder) use ($module, $eventType) {
                        $builder->where('module', $module);
                        if ($eventType) {
                            $builder->where(function ($eventBuilder) use ($eventType) {
                                $eventBuilder->where('event_type', $eventType)->orWhereNull('event_type');
                            });
                        }
                    });
            })
            ->orderByRaw('case when code = ? then 0 else 1 end', [$module])
            ->first();

        return $template?->message_template ?: 'Assalamualaikum, informasi untuk wali santri {nama_siswa}: {pesan}';
    }

    public function render(string $template, array $variables): string
    {
        $replacements = [];
        foreach ($variables as $key => $value) {
            $replacements['{' . $key . '}'] = is_scalar($value) ? (string) $value : '';
        }

        return trim(strtr($template, $replacements));
    }

    public function variablesForStudent(Siswa $siswa, array $context = []): array
    {
        $date = $context['tanggal'] ?? $context['date'] ?? now();
        if ($date instanceof CarbonInterface) {
            $dateValue = $date->format('Y-m-d');
        } else {
            $dateValue = (string) $date;
        }

        return array_merge([
            'nama_sekolah' => config('app.name', 'Qomaruddin'),
            'nama_wali' => $siswa->nama_wali ?: $siswa->wali?->name ?: 'Wali Santri',
            'nama_siswa' => $siswa->nama ?: 'Santri',
            'nis' => $siswa->nis ?: '-',
            'kelas' => $siswa->kelasRef?->name ?? $siswa->kelas ?? '-',
            'tanggal' => $dateValue,
            'komplek' => $siswa->komplek ?: '-',
            'kamar' => $siswa->kamar ?: '-',
            'jenis_absensi' => $context['jenis_absensi'] ?? '-',
            'status_absensi' => $context['status_absensi'] ?? $context['status'] ?? '-',
            'sesi' => $context['sesi'] ?? '-',
            'kitab' => $context['kitab'] ?? '-',
            'jenis_sholat' => $context['jenis_sholat'] ?? 'Jamaah Sholat',
            'judul_tagihan' => $context['judul_tagihan'] ?? '-',
            'nominal_tagihan' => $context['nominal_tagihan'] ?? '-',
            'tanggal_jatuh_tempo' => $context['tanggal_jatuh_tempo'] ?? '-',
            'nominal_bayar' => $context['nominal_bayar'] ?? '-',
            'tanggal_bayar' => $context['tanggal_bayar'] ?? '-',
            'pesan' => $context['pesan'] ?? '',
        ], $context);
    }
}
