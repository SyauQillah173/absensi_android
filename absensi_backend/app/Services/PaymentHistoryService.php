<?php

namespace App\Services;

use App\Models\PaymentTransaction;
use App\Models\Pembayaran;
use Illuminate\Support\Collection;

class PaymentHistoryService
{
    public function getTransactions(array $filters = []): Collection
    {
        $transactions = $this->queryTransactions($filters)
            ->when(!empty($filters['limit']), fn ($query) => $query->limit((int) $filters['limit']))
            ->get()
            ->map(fn (PaymentTransaction $transaction) => $this->formatTransaction($transaction));

        $legacyPayments = $this->queryLegacyPayments($filters)
            ->when(!empty($filters['limit']), fn ($query) => $query->limit((int) $filters['limit']))
            ->get()
            ->map(fn (Pembayaran $payment) => $this->formatLegacyPayment($payment));

        return collect($transactions->all())
            ->merge($legacyPayments->all())
            ->sortByDesc(fn (array $item) => sprintf(
                '%s|%s|%010d',
                $item['tanggal'] ?? '',
                $item['created_at'] ?? '',
                (int) ($item['sort_timestamp'] ?? 0)
            ))
            ->when(!empty($filters['limit']), fn (Collection $items) => $items->take((int) $filters['limit']))
            ->values();
    }

    public function formatTransaction(PaymentTransaction $transaction): array
    {
        $transaction->loadMissing([
            'siswa:id,nama,nis,kelas,nama_wali,wali_id',
            'wali:id,name,role',
            'items.paymentType:id,nama,periode,metode_pembayaran,status',
            'items.paymentBill:id,title,period_label,due_date,status',
        ]);

        $items = $transaction->items
            ->map(fn (Pembayaran $item) => $this->mapItem($item))
            ->values();

        $names = $items
            ->pluck('nama')
            ->filter()
            ->unique()
            ->values();

        return [
            'id' => $transaction->id,
            'source' => 'transaction',
            'transaction_id' => $transaction->id,
            'transaction_code' => $transaction->kode_transaksi,
            'kode_transaksi' => $transaction->kode_transaksi,
            'siswa_id' => $transaction->siswa_id,
            'siswa_nama' => $transaction->siswa?->nama,
            'nama_siswa' => $transaction->siswa?->nama,
            'nis' => $transaction->siswa?->nis,
            'kelas' => $transaction->siswa?->kelas,
            'siswa' => $transaction->siswa,
            'wali' => $transaction->wali,
            'creator' => $transaction->creator,
            'atas_nama' => $transaction->atas_nama,
            'jenis' => $names->join(', '),
            'payment_method_id' => $transaction->payment_method_id,
            'payment_status_id' => $transaction->payment_status_id,
            'via' => $transaction->via,
            'jumlah' => (int) $transaction->jumlah_total,
            'tanggal' => optional($transaction->tanggal)->format('Y-m-d'),
            'status' => $transaction->status,
            'academic_year_id' => $transaction->academic_year_id,
            'semester_id' => $transaction->semester_id,
            'tahun_ajaran' => $transaction->tahun_ajaran,
            'semester' => $transaction->semester,
            'keterangan' => $transaction->keterangan,
            'payment_type' => $items->count() === 1 ? $items->first()['payment_type'] : null,
            'payment_items' => $items,
            'is_multi_payment' => $items->count() > 1,
            'total_item' => (int) $transaction->total_item,
            'biometric_required' => (bool) $transaction->biometric_required,
            'biometric_verified_at' => optional($transaction->biometric_verified_at)->toIso8601String(),
            'biometric_verification_method' => $transaction->biometric_verification_method,
            'biometric_verification_mode' => $transaction->biometric_verification_mode,
            'created_at' => optional($transaction->created_at)->toIso8601String(),
            'sort_timestamp' => optional($transaction->created_at)->getTimestamp() ?? 0,
            'delete_target' => [
                'type' => 'transaction',
                'id' => $transaction->id,
            ],
        ];
    }

    public function formatLegacyPayment(Pembayaran $payment): array
    {
        $payment->loadMissing([
            'siswa:id,nama,nis,kelas,nama_wali,wali_id',
            'wali:id,name,role',
            'paymentType:id,nama,periode,metode_pembayaran,status',
            'paymentBill:id,title,period_label,due_date,status',
        ]);

        $item = $this->mapItem($payment);

        return [
            'id' => $payment->id,
            'source' => 'legacy',
            'transaction_id' => null,
            'transaction_code' => 'TRX-' . $payment->id,
            'kode_transaksi' => 'TRX-' . $payment->id,
            'siswa_id' => $payment->siswa_id,
            'siswa_nama' => $payment->siswa?->nama,
            'nama_siswa' => $payment->siswa?->nama,
            'nis' => $payment->siswa?->nis,
            'kelas' => $payment->siswa?->kelas,
            'siswa' => $payment->siswa,
            'wali' => $payment->wali,
            'creator' => $payment->creator ?? null,
            'atas_nama' => $payment->atas_nama,
            'jenis' => $item['nama'],
            'payment_method_id' => $payment->payment_method_id,
            'payment_status_id' => $payment->payment_status_id,
            'via' => $payment->via,
            'jumlah' => (int) $payment->jumlah,
            'tanggal' => $payment->tanggal,
            'status' => $payment->status,
            'academic_year_id' => $payment->academic_year_id,
            'semester_id' => $payment->semester_id,
            'tahun_ajaran' => $payment->tahun_ajaran,
            'semester' => $payment->semester,
            'keterangan' => $payment->keterangan,
            'payment_type' => $item['payment_type'],
            'payment_items' => [$item],
            'is_multi_payment' => false,
            'total_item' => 1,
            'biometric_required' => false,
            'biometric_verified_at' => null,
            'biometric_verification_method' => null,
            'biometric_verification_mode' => null,
            'created_at' => optional($payment->created_at)->toIso8601String(),
            'sort_timestamp' => optional($payment->created_at)->getTimestamp() ?? 0,
            'delete_target' => [
                'type' => 'legacy',
                'id' => $payment->id,
            ],
        ];
    }

    public function mapReportRow(array $transaction): array
    {
        $siswa = $transaction['siswa'] ?? null;
        $wali = $transaction['wali'] ?? null;
        $items = collect($transaction['payment_items'] ?? []);
        $periode = $items
            ->pluck('periode')
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->unique()
            ->values();

        return [
            'transaction_code' => $transaction['transaction_code'] ?? '-',
            'nama_siswa' => $siswa['nama'] ?? '-',
            'nis' => $siswa['nis'] ?? '-',
            'kelas' => $siswa['kelas'] ?? '-',
            'nama_wali' => $wali['name'] ?? $transaction['atas_nama'] ?? '-',
            'jenis_pembayaran' => $transaction['jenis'] ?? 'Pembayaran',
            'periode' => $periode->isEmpty() ? '-' : $periode->join(', '),
            'nominal' => (int) ($transaction['jumlah'] ?? 0),
            'tanggal_pembayaran' => $transaction['tanggal'] ?? '-',
            'metode_pembayaran' => $transaction['via'] ?? '-',
            'status_pembayaran' => $transaction['status'] ?? '-',
            'keterangan' => $transaction['keterangan'] ?? '',
            'detail_items' => $items->all(),
        ];
    }

    private function queryTransactions(array $filters = [])
    {
        $query = PaymentTransaction::query()->with([
            'siswa:id,nama,nis,kelas,class_id,nama_wali,wali_id',
            'wali:id,name,role',
            'items.paymentType:id,nama,periode,metode_pembayaran,status',
            'items.paymentBill:id,title,period_label,due_date,status',
        ]);

        if (!empty($filters['today_or_created_today'])) {
            $today = $filters['today_or_created_today'];
            $query->where(function ($q) use ($today) {
                $q->whereDate('tanggal', $today)
                  ->orWhereDate('created_at', $today);
            });
        } elseif (!empty($filters['tanggal'])) {
            $query->whereDate('tanggal', $filters['tanggal']);
        }

        if (!empty($filters['payment_status_id'])) {
            $query->where('payment_status_id', (int) $filters['payment_status_id']);
        } elseif (!empty($filters['status'])) {
            $statusId = app(ReferenceResolver::class)->paymentStatusId($filters['status']);
            $statusId ? $query->where('payment_status_id', $statusId) : $query->whereRaw('1 = 0');
        }

        if (!empty($filters['siswa_id'])) {
            $query->where('siswa_id', (int) $filters['siswa_id']);
        }

        if (!empty($filters['class_id'])) {
            $query->whereHas('siswa', fn ($builder) => $builder->where('class_id', (int) $filters['class_id']));
        } elseif (!empty($filters['kelas'])) {
            $kelas = trim((string) $filters['kelas']);
            $classId = app(ReferenceResolver::class)->classId($kelas, false);
            $classId
                ? $query->whereHas('siswa', fn ($builder) => $builder->where('class_id', $classId))
                : $query->whereRaw('1 = 0');
        }

        if (!empty($filters['tanggal_mulai'])) {
            $query->whereDate('tanggal', '>=', $filters['tanggal_mulai']);
        }

        if (!empty($filters['tanggal_akhir'])) {
            $query->whereDate('tanggal', '<=', $filters['tanggal_akhir']);
        }

        if (!empty($filters['payment_type_id'])) {
            $query->whereHas('items', fn ($b) => $b->where('payment_type_id', (int) $filters['payment_type_id']));
        }

        if (!empty($filters['via'])) {
            $query->where('via', 'like', '%' . $filters['via'] . '%');
        }

        if (!empty($filters['search'])) {
            $s = trim((string) $filters['search']);
            $query->where(function ($q) use ($s) {
                $q->where('kode_transaksi', 'like', "%{$s}%")
                  ->orWhere('atas_nama', 'like', "%{$s}%")
                  ->orWhereHas('siswa', function ($sq) use ($s) {
                      $sq->where('nama', 'like', "%{$s}%")
                        ->orWhere('nis', 'like', "%{$s}%");
                  });
            });
        }

        $this->applyAcademicFilters($query, $filters);

        return $query->orderByDesc('tanggal')->orderByDesc('created_at');
    }

    private function queryLegacyPayments(array $filters = [])
    {
        $query = Pembayaran::query()
            ->with([
                'siswa:id,nama,nis,kelas,class_id,nama_wali,wali_id',
                'wali:id,name,role',
                'paymentType:id,nama,periode,metode_pembayaran,status',
                'paymentBill:id,title,period_label,due_date,status',
            ])
            ->whereNull('payment_transaction_id');

        if (!empty($filters['today_or_created_today'])) {
            $today = $filters['today_or_created_today'];
            $query->where(function ($q) use ($today) {
                $q->whereDate('tanggal', $today)
                  ->orWhereDate('created_at', $today);
            });
        } elseif (!empty($filters['tanggal'])) {
            $query->whereDate('tanggal', $filters['tanggal']);
        }

        if (!empty($filters['payment_status_id'])) {
            $query->where('payment_status_id', (int) $filters['payment_status_id']);
        } elseif (!empty($filters['status'])) {
            $statusId = app(ReferenceResolver::class)->paymentStatusId($filters['status']);
            $statusId ? $query->where('payment_status_id', $statusId) : $query->whereRaw('1 = 0');
        }

        if (!empty($filters['siswa_id'])) {
            $query->where('siswa_id', (int) $filters['siswa_id']);
        }

        if (!empty($filters['class_id'])) {
            $query->whereHas('siswa', fn ($builder) => $builder->where('class_id', (int) $filters['class_id']));
        } elseif (!empty($filters['kelas'])) {
            $kelas = trim((string) $filters['kelas']);
            $classId = app(ReferenceResolver::class)->classId($kelas, false);
            $classId
                ? $query->whereHas('siswa', fn ($builder) => $builder->where('class_id', $classId))
                : $query->whereRaw('1 = 0');
        }

        if (!empty($filters['tanggal_mulai'])) {
            $query->whereDate('tanggal', '>=', $filters['tanggal_mulai']);
        }

        if (!empty($filters['tanggal_akhir'])) {
            $query->whereDate('tanggal', '<=', $filters['tanggal_akhir']);
        }

        if (!empty($filters['payment_type_id'])) {
            $query->where('payment_type_id', (int) $filters['payment_type_id']);
        }

        if (!empty($filters['via'])) {
            $query->where('via', 'like', '%' . $filters['via'] . '%');
        }

        if (!empty($filters['search'])) {
            $s = trim((string) $filters['search']);
            $query->where(function ($q) use ($s) {
                $q->where('atas_nama', 'like', "%{$s}%")
                  ->orWhere('keterangan', 'like', "%{$s}%")
                  ->orWhereHas('siswa', function ($sq) use ($s) {
                      $sq->where('nama', 'like', "%{$s}%")
                        ->orWhere('nis', 'like', "%{$s}%");
                  });
            });
        }

        $this->applyAcademicFilters($query, $filters);

        return $query->orderByDesc('tanggal')->orderByDesc('created_at');
    }

    private function applyAcademicFilters($query, array $filters): void
    {
        if (!empty($filters['academic_year_id'])) {
            $query->where(function ($builder) use ($filters) {
                $builder->where('academic_year_id', (int) $filters['academic_year_id'])
                    ->orWhereNull('academic_year_id');
            });
        }

        if (!empty($filters['semester_id'])) {
            $query->where(function ($builder) use ($filters) {
                $builder->where('semester_id', (int) $filters['semester_id'])
                    ->orWhereNull('semester_id');
            });
        }

        if (!empty($filters['tahun_ajaran'])) {
            $query->where(function ($builder) use ($filters) {
                $builder->where('tahun_ajaran', $filters['tahun_ajaran'])
                    ->orWhereNull('tahun_ajaran');
            });
        }

        if (!empty($filters['semester'])) {
            $query->where(function ($builder) use ($filters) {
                $builder->whereRaw('lower(semester) = ?', [strtolower((string) $filters['semester'])])
                    ->orWhereNull('semester');
            });
        }
    }

    private function mapItem(Pembayaran $payment): array
    {
        $paymentType = $payment->paymentType;

        return [
            'id' => $payment->id,
            'payment_type_id' => $payment->payment_type_id,
            'payment_bill_id' => $payment->payment_bill_id,
            'payment_method_id' => $payment->payment_method_id,
            'payment_status_id' => $payment->payment_status_id,
            'nama' => $paymentType?->nama ?? $payment->jenis ?? 'Pembayaran',
            'jenis' => $payment->jenis ?? $paymentType?->nama ?? 'Pembayaran',
            'jumlah' => (int) $payment->jumlah,
            'status' => $payment->status,
            'academic_year_id' => $payment->academic_year_id,
            'semester_id' => $payment->semester_id,
            'tahun_ajaran' => $payment->tahun_ajaran,
            'semester' => $payment->semester,
            'periode' => $paymentType?->periode ?? '-',
            'keterangan' => $payment->keterangan,
            'payment_type' => $paymentType ? [
                'id' => $paymentType->id,
                'nama' => $paymentType->nama,
                'periode' => $paymentType->periode,
                'metode_pembayaran' => $paymentType->metode_pembayaran ?? [],
                'status' => $paymentType->status,
            ] : null,
            'payment_bill' => $payment->paymentBill ? [
                'id' => $payment->paymentBill->id,
                'title' => $payment->paymentBill->title,
                'period_label' => $payment->paymentBill->period_label,
                'due_date' => optional($payment->paymentBill->due_date)->format('Y-m-d'),
                'status' => $payment->paymentBill->status,
            ] : null,
        ];
    }
}
