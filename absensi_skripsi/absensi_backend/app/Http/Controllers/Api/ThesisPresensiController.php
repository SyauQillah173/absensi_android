<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DetailPresensi;
use App\Models\Kelas;
use App\Models\Presensi;
use App\Models\Santri;
use App\Services\ThesisNotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ThesisPresensiController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(['success' => true, 'data' => $this->filtered($request)->latest('tanggal')->latest('waktu_mulai')->get()]);
    }

    public function store(Request $request, ThesisNotificationService $notification)
    {
        $data = $this->validatePayload($request);
        $presensi = $this->persistPresensi($request, $notification, $data);

        return response()->json(['success' => true, 'data' => $presensi], 201);
    }

    public function syncBatch(Request $request, ThesisNotificationService $notification)
    {
        $data = $request->validate([
            'operations' => 'required|array|min:1|max:50',
            'operations.*.operation_id' => 'required|uuid',
            'operations.*.entity_type' => 'required|in:presensi',
            'operations.*.payload' => 'required|array',
        ]);

        $results = [];
        foreach ($data['operations'] as $operation) {
            $payload = $operation['payload'] + ['operation_id' => $operation['operation_id']];
            $child = Request::create('/api/presensi', 'POST', $payload);
            $child->setUserResolver(fn () => $request->user());
            $validated = $this->validatePayload($child);
            $presensi = $this->persistPresensi($child, $notification, $validated);
            $results[] = [
                'operation_id' => $operation['operation_id'],
                'status' => 'completed',
                'id_presensi' => $presensi->id_presensi,
            ];
        }

        return response()->json(['success' => true, 'data' => $results]);
    }

    private function persistPresensi(Request $request, ThesisNotificationService $notification, array $data): Presensi
    {
        $kelas = $this->authorizedClass($request, (int) $data['id_kelas']);
        $operationId = $data['operation_id'] ?? (string) Str::uuid();

        if ($existing = Presensi::where('operation_id', $operationId)->with('detail')->first()) {
            return $existing;
        }

        $date = Carbon::parse($data['tanggal'])->startOfDay();
        if ($date->isFuture() || $date->lt(today()->subDays(7))) {
            throw ValidationException::withMessages(['tanggal' => 'Tanggal hanya boleh hari ini sampai tujuh hari sebelumnya.']);
        }

        $activeStudents = Santri::where('id_kelas', $kelas->id_kelas)->where('status_aktif', true)->pluck('id_santri');
        $submitted = collect($data['detail'])->keyBy('id_santri');
        $detailRows = $activeStudents->map(function ($studentId) use ($submitted) {
            $row = $submitted->get($studentId, []);
            $status = $row['status_presensi'] ?? 'Hadir';
            return [
                'id_santri' => $studentId,
                'status_presensi' => $status,
                'keterangan' => $status === 'Hadir'
                    ? null
                    : $this->normalizeKeterangan($row['keterangan'] ?? null),
            ];
        });
        $notificationDetailIds = [];

        $presensi = DB::transaction(function () use ($request, $data, $kelas, $operationId, $detailRows, &$notificationDetailIds) {
            $query = Presensi::where('id_kelas', $kelas->id_kelas)
                ->whereDate('tanggal', $data['tanggal'])
                ->where('waktu_mulai', $data['waktu_mulai']);
            $presensi = $query->lockForUpdate()->first();
            if ($presensi && empty($data['allow_update'])) {
                throw ValidationException::withMessages([
                    'sesi' => 'Sesi sudah ada. Kirim allow_update=true untuk memperbarui.',
                ]);
            }

            $values = [
                'id_guru' => $kelas->id_guru,
                'id_kelas' => $kelas->id_kelas,
                'tanggal' => $data['tanggal'],
                'waktu_mulai' => $data['waktu_mulai'],
                'waktu_selesai' => $data['waktu_selesai'] ?? null,
                'catatan' => $data['catatan'] ?? null,
                'sync_flag' => true,
                'operation_id' => $operationId,
            ];
            if ($presensi) {
                $existingDetails = $presensi->detail()
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id_santri');
                $presensi->update($values);
            } else {
                $presensi = Presensi::create($values);
                $existingDetails = collect();
            }

            foreach ($detailRows as $row) {
                $existingDetail = $existingDetails->get($row['id_santri']);
                $shouldNotify = !$existingDetail || $this->detailChanged($existingDetail, $row);
                $detail = DetailPresensi::updateOrCreate(
                    ['id_presensi' => $presensi->id_presensi, 'id_santri' => $row['id_santri']],
                    $row + ['sync_flag' => true]
                );
                if ($shouldNotify) {
                    $notificationDetailIds[] = $detail->id_detail_presensi;
                }
            }
            DB::table('sync_operations')->updateOrInsert(
                ['operation_id' => $operationId],
                [
                    'user_id' => $request->user()->id,
                    'entity_type' => 'presensi',
                    'action' => $presensi->wasRecentlyCreated ? 'create' : 'update',
                    'status' => 'completed',
                    'result' => json_encode(['id_presensi' => $presensi->id_presensi]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            return $presensi->load('kelas', 'detail.santri');
        });

        foreach ($presensi->detail->whereIn('id_detail_presensi', $notificationDetailIds) as $detail) {
            try {
                $notification->queue($detail);
            } catch (\Throwable $error) {
                Log::warning('Gagal membuat notifikasi WhatsApp presensi skripsi', [
                    'id_detail_presensi' => $detail->id_detail_presensi,
                    'error' => $error->getMessage(),
                ]);
            }
        }

        return $presensi;
    }

    private function detailChanged(DetailPresensi $existing, array $row): bool
    {
        return $existing->status_presensi !== $row['status_presensi']
            || $this->normalizeKeterangan($existing->keterangan) !== $this->normalizeKeterangan($row['keterangan'] ?? null);
    }

    private function normalizeKeterangan(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    public function rekap(Request $request)
    {
        $rows = $this->filtered($request)->get()->flatMap(fn ($item) => $item->detail);
        $total = $rows->count();
        $counts = collect(['Hadir', 'Sakit', 'Izin', 'Alpa'])->mapWithKeys(
            fn ($status) => [$status => $rows->where('status_presensi', $status)->count()]
        );

        return response()->json([
            'success' => true,
            'data' => [
                'total' => $total,
                'jumlah' => $counts,
                'persentase' => $counts->map(fn ($count) => $total ? round($count * 100 / $total, 2) : 0),
            ],
        ]);
    }

    public function export(Request $request)
    {
        abort_unless($request->user()->role === 'admin', 403);

        $lines = ['Tanggal,Waktu,Kelas,Santri,NISN,Status,Keterangan'];
        foreach ($this->filtered($request)->get() as $presensi) {
            foreach ($presensi->detail as $detail) {
                $lines[] = implode(',', array_map(
                    fn ($value) => '"'.str_replace('"', '""', (string) $value).'"',
                    [
                        $presensi->tanggal,
                        $presensi->waktu_mulai,
                        $presensi->kelas?->nama_kelas,
                        $detail->santri?->nama_santri,
                        $detail->santri?->nisn,
                        $detail->status_presensi,
                        $detail->keterangan,
                    ]
                ));
            }
        }

        return response(implode("\n", $lines), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="rekap-presensi.csv"',
        ]);
    }

    public function destroy(Request $request, Presensi $presensi)
    {
        $this->authorizedClass($request, (int) $presensi->id_kelas);
        $presensi->delete();

        return response()->json([
            'success' => true,
            'message' => 'Presensi berhasil dibatalkan.',
        ]);
    }

    private function filtered(Request $request)
    {
        $request->validate([
            'tanggal_mulai' => 'nullable|date',
            'tanggal_selesai' => 'nullable|date|after_or_equal:tanggal_mulai',
            'id_kelas' => 'nullable|integer',
            'id_santri' => 'nullable|integer',
            'status' => 'nullable|in:Hadir,Sakit,Izin,Alpa',
        ]);
        if ($request->filled('tanggal_mulai') && $request->filled('tanggal_selesai')) {
            if (Carbon::parse($request->tanggal_mulai)->diffInDays(Carbon::parse($request->tanggal_selesai)) > 366) {
                throw ValidationException::withMessages(['periode' => 'Periode laporan maksimal satu tahun.']);
            }
        }

        $query = Presensi::with(['kelas:id_kelas,nama_kelas,id_guru', 'guru:id_guru,nama_guru', 'detail.santri:id_santri,nama_santri,nisn']);
        if ($request->user()->role === 'guru') {
            $query->where('id_guru', $request->user()->guru?->id_guru ?? 0);
        }
        if ($request->filled('id_kelas')) {
            $query->where('id_kelas', $request->integer('id_kelas'));
        }
        if ($request->filled('tanggal_mulai')) {
            $query->whereDate('tanggal', '>=', $request->tanggal_mulai);
        }
        if ($request->filled('tanggal_selesai')) {
            $query->whereDate('tanggal', '<=', $request->tanggal_selesai);
        }
        if ($request->filled('id_santri') || $request->filled('status')) {
            $query->whereHas('detail', function ($detail) use ($request) {
                if ($request->filled('id_santri')) {
                    $detail->where('id_santri', $request->integer('id_santri'));
                }
                if ($request->filled('status')) {
                    $detail->where('status_presensi', $request->status);
                }
            });
        }

        return $query;
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'operation_id' => 'nullable|uuid',
            'id_kelas' => 'required|integer|exists:kelas,id_kelas',
            'tanggal' => 'required|date',
            'waktu_mulai' => 'required|date_format:H:i:s',
            'waktu_selesai' => 'nullable|date_format:H:i:s|after:waktu_mulai',
            'catatan' => 'nullable|string|max:1000',
            'allow_update' => 'nullable|boolean',
            'detail' => 'required|array|min:1',
            'detail.*.id_santri' => 'required|integer|exists:santri,id_santri',
            'detail.*.status_presensi' => 'required|in:Hadir,Sakit,Izin,Alpa',
            'detail.*.keterangan' => 'nullable|string|max:500',
        ]);
    }

    private function authorizedClass(Request $request, int $classId): Kelas
    {
        $query = Kelas::where('id_kelas', $classId)->where('status_aktif', true);
        if ($request->user()->role === 'guru') {
            $query->where('id_guru', $request->user()->guru?->id_guru ?? 0);
        }

        return $query->firstOrFail();
    }
}
