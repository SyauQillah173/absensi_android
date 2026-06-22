<?php

namespace App\Services;

use App\Jobs\SendWhatsAppMessageJob;
use App\Models\NotificationSetting;
use App\Models\PaymentBill;
use App\Models\PaymentTransaction;
use App\Models\Siswa;
use App\Models\WhatsAppMessageLog;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class WhatsAppNotificationService
{
    public function __construct(
        private readonly WhatsAppPhoneResolver $phoneResolver,
        private readonly WhatsAppTemplateService $templateService,
    ) {
    }

    public function queueAbsensiMadin($row, ?int $createdBy = null): ?WhatsAppMessageLog
    {
        $row->loadMissing(['siswa.wali', 'siswa.guardianProfile', 'siswa.kelasRef']);

        return $this->queueStudentMessage(
            'absensi_madin',
            'created',
            $row->siswa,
            [
                'tanggal' => optional($row->tanggal)->format('Y-m-d') ?? $row->tanggal,
                'status_absensi' => $row->status ?? '-',
                'jenis_absensi' => 'Madin',
                'source_id' => $row->id,
            ],
            "absensi_madin:{$row->id}",
            $createdBy
        );
    }

    public function queueAbsensiNgaji(array $attendance, Siswa $student, ?int $createdBy = null): ?WhatsAppMessageLog
    {
        return $this->queueStudentMessage(
            'absensi_ngaji',
            'created',
            $student,
            [
                'tanggal' => $attendance['tanggal'] ?? null,
                'status_absensi' => $attendance['status_label'] ?? $attendance['status_code'] ?? '-',
                'sesi' => $attendance['sesi'] ?? '-',
                'kitab' => $attendance['kitab'] ?? '-',
                'jenis_absensi' => 'Ngaji',
                'source_id' => $attendance['id'] ?? null,
            ],
            'absensi_ngaji:' . ($attendance['id'] ?? md5(json_encode($attendance))),
            $createdBy
        );
    }

    public function queueAbsensiSholat(array $attendance, Siswa $student, ?int $createdBy = null): ?WhatsAppMessageLog
    {
        return $this->queueStudentMessage(
            'absensi_sholat',
            'created',
            $student,
            [
                'tanggal' => $attendance['tanggal'] ?? null,
                'status_absensi' => $attendance['status_label'] ?? $attendance['status_code'] ?? '-',
                'jenis_sholat' => $attendance['jenis_sholat'] ?? 'Jamaah Sholat',
                'jenis_absensi' => 'Sholat',
                'source_id' => $attendance['id'] ?? null,
            ],
            'absensi_sholat:' . ($attendance['id'] ?? md5(json_encode($attendance))),
            $createdBy
        );
    }

    public function queuePaymentBill(PaymentBill $bill, ?int $createdBy = null, ?string $message = null): ?WhatsAppMessageLog
    {
        $bill->loadMissing(['siswa.wali', 'siswa.guardianProfile', 'siswa.kelasRef', 'paymentType']);
        if (!$bill->siswa) {
            return null;
        }

        return $this->queueStudentMessage(
            'tagihan',
            'manual',
            $bill->siswa,
            [
                'judul_tagihan' => $bill->title ?: $bill->paymentType?->nama ?: 'Tagihan',
                'nominal_tagihan' => 'Rp ' . number_format((float) $bill->amount, 0, ',', '.'),
                'tanggal_jatuh_tempo' => $bill->due_date?->format('Y-m-d') ?? '-',
                'pesan' => $message ?: "Tagihan {$bill->title} menunggu pembayaran.",
                'source_id' => $bill->id,
            ],
            "tagihan:{$bill->id}",
            $createdBy,
            forceQueue: true
        );
    }

    public function queuePaymentTransaction(PaymentTransaction $transaction, ?int $createdBy = null): ?WhatsAppMessageLog
    {
        $transaction->loadMissing(['siswa.wali', 'siswa.guardianProfile', 'siswa.kelasRef', 'bills.paymentType']);
        if (!$transaction->siswa) {
            return null;
        }

        $title = $transaction->bills->pluck('title')->filter()->join(', ') ?: 'Pembayaran';

        return $this->queueStudentMessage(
            'pembayaran',
            'paid',
            $transaction->siswa,
            [
                'judul_tagihan' => $title,
                'nominal_bayar' => 'Rp ' . number_format((float) $transaction->jumlah_total, 0, ',', '.'),
                'tanggal_bayar' => $transaction->tanggal?->format('Y-m-d') ?? now()->format('Y-m-d'),
                'source_id' => $transaction->id,
            ],
            "pembayaran:{$transaction->id}",
            $createdBy
        );
    }

    public function queueManual(string $phoneNumber, string $message, ?int $createdBy = null): WhatsAppMessageLog
    {
        if (!Schema::hasTable('whatsapp_message_logs')) {
            throw new \RuntimeException('Tabel log WhatsApp belum tersedia. Jalankan migration terlebih dahulu.');
        }

        $normalized = $this->phoneResolver->normalize($phoneNumber);
        $log = WhatsAppMessageLog::query()->create([
            'message_id' => (string) Str::uuid(),
            'module' => 'manual',
            'event_type' => 'manual',
            'phone_number' => $normalized ?: $phoneNumber,
            'message' => $message,
            'status' => $normalized ? 'pending' : 'failed',
            'error_message' => $normalized ? null : 'Nomor WhatsApp tidak valid.',
            'retry_limit' => 3,
            'created_by' => $createdBy,
            'payload' => ['manual' => true],
        ]);

        if ($normalized) {
            $this->dispatchLog($log);
        }

        return $log;
    }

    public function retryLog(WhatsAppMessageLog $log): WhatsAppMessageLog
    {
        if (!in_array($log->status, ['sent', 'cancelled'], true)) {
            $log->forceFill([
                'status' => 'pending',
                'error_message' => null,
            ])->save();
            $this->dispatchLog($log);
        }

        return $log->refresh();
    }

    private function queueStudentMessage(
        string $module,
        string $eventType,
        ?Siswa $student,
        array $context,
        string $sourceKey,
        ?int $createdBy = null,
        bool $forceQueue = false,
    ): ?WhatsAppMessageLog {
        if (!$student) {
            return null;
        }

        if (!Schema::hasTable('notification_settings') || !Schema::hasTable('whatsapp_message_logs')) {
            return null;
        }

        $setting = NotificationSetting::query()
            ->with('template')
            ->where('module', $module)
            ->first();

        if (!$forceQueue && (!$setting || !$setting->is_active || !$setting->channel_whatsapp)) {
            return null;
        }

        if ($forceQueue && $setting && !$setting->is_active) {
            return null;
        }

        $phone = $this->phoneResolver->resolveForStudent($student);
        $template = $setting?->template?->message_template ?: $this->templateService->templateFor($module, $eventType);
        $message = $this->templateService->render($template, $this->templateService->variablesForStudent($student, $context));
        $idempotency = sha1($sourceKey . ':' . $student->id . ':' . ($phone['number'] ?? 'invalid'));

        $log = WhatsAppMessageLog::query()->firstOrCreate(
            ['idempotency_key' => $idempotency],
            [
                'message_id' => (string) Str::uuid(),
                'module' => $module,
                'event_type' => $eventType,
                'student_id' => $student->id,
                'wali_id' => $student->wali_id,
                'phone_number' => $phone['number'],
                'message' => $message,
                'status' => $phone['valid'] ? 'pending' : 'failed',
                'error_message' => $phone['error'],
                'retry_limit' => $setting?->retry_limit ?? 3,
                'created_by' => $createdBy,
                'payload' => $context,
                'metadata' => ['phone_source' => $phone['source']],
            ]
        );

        if ($log->wasRecentlyCreated && $phone['valid']) {
            $this->dispatchLog($log);
        }

        return $log;
    }

    private function dispatchLog(WhatsAppMessageLog $log): void
    {
        if (config('queue.default') === 'sync' && !config('services.whatsapp_bot.dispatch_when_sync_queue')) {
            return;
        }

        SendWhatsAppMessageJob::dispatch($log->id);
    }
}
