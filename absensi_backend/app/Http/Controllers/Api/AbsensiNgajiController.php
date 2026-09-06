<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AbsensiNgaji;
use App\Models\AppNotification;
use App\Models\NgajiBook;
use App\Models\NgajiSchedule;
use App\Models\NgajiSession;
use App\Models\SantriPondok;
use App\Models\Siswa;
use App\Models\User;
use App\Services\AdminActivityNotificationService;
use App\Services\AuditLogService;
use App\Services\WhatsAppNotificationService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AbsensiNgajiController extends Controller
{
    public function sessions(Request $request)
    {
        $query = NgajiSession::query()->orderBy('sort_order')->orderBy('name');
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json(['success' => true, 'data' => $query->get()]);
    }

    public function storeSession(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'code' => 'nullable|string|max:80|unique:ngaji_sessions,code',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:100000',
        ]);

        $session = NgajiSession::query()->create($this->masterPayload($validated, NgajiSession::class));
        app(AuditLogService::class)->record($request, 'ngaji_session', 'create', $session);

        return response()->json(['success' => true, 'message' => 'Sesi ngaji berhasil ditambahkan', 'data' => $session], 201);
    }

    public function updateSession(Request $request, NgajiSession $session)
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:120',
            'code' => 'nullable|string|max:80|unique:ngaji_sessions,code,' . $session->id,
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:100000',
        ]);

        $before = $session->toArray();
        $session->update($validated);
        app(AuditLogService::class)->record($request, 'ngaji_session', 'update', $session, $before, $session->fresh()->toArray());

        return response()->json(['success' => true, 'message' => 'Sesi ngaji berhasil diperbarui', 'data' => $session->fresh()]);
    }

    public function destroySession(Request $request, NgajiSession $session)
    {
        $before = $session->toArray();
        $session->update(['is_active' => false]);
        app(AuditLogService::class)->record($request, 'ngaji_session', 'deactivate', $session, $before, $session->fresh()->toArray());

        return response()->json(['success' => true, 'message' => 'Sesi ngaji dinonaktifkan']);
    }

    public function books(Request $request)
    {
        $query = NgajiBook::query()->orderBy('sort_order')->orderBy('name');
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json(['success' => true, 'data' => $query->get()]);
    }

    public function storeBook(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:160',
            'code' => 'nullable|string|max:100|unique:ngaji_books,code',
            'method' => 'nullable|string|max:80',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:100000',
        ]);

        $book = NgajiBook::query()->create($this->masterPayload($validated, NgajiBook::class));
        app(AuditLogService::class)->record($request, 'ngaji_book', 'create', $book);

        return response()->json(['success' => true, 'message' => 'Kitab ngaji berhasil ditambahkan', 'data' => $book], 201);
    }

    public function updateBook(Request $request, NgajiBook $book)
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:160',
            'code' => 'nullable|string|max:100|unique:ngaji_books,code,' . $book->id,
            'method' => 'nullable|string|max:80',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:100000',
        ]);

        $before = $book->toArray();
        $book->update($validated);
        app(AuditLogService::class)->record($request, 'ngaji_book', 'update', $book, $before, $book->fresh()->toArray());

        return response()->json(['success' => true, 'message' => 'Kitab ngaji berhasil diperbarui', 'data' => $book->fresh()]);
    }

    public function destroyBook(Request $request, NgajiBook $book)
    {
        $before = $book->toArray();
        $book->update(['is_active' => false]);
        app(AuditLogService::class)->record($request, 'ngaji_book', 'deactivate', $book, $before, $book->fresh()->toArray());

        return response()->json(['success' => true, 'message' => 'Kitab ngaji dinonaktifkan']);
    }

    public function schedules(Request $request)
    {
        $query = NgajiSchedule::query()
            ->with(['session', 'book', 'teacher:id,name,role', 'complex', 'room', 'classRef', 'day'])
            ->orderByDesc('created_at');

        if ($request->boolean('active_only')) {
            $query->where('status', 'Aktif');
        }
        if ($request->filled('ngaji_session_id')) {
            $query->where('ngaji_session_id', $request->integer('ngaji_session_id'));
        }
        if ($request->filled('ngaji_book_id')) {
            $query->where('ngaji_book_id', $request->integer('ngaji_book_id'));
        }
        if ($request->filled('boarding_room_id')) {
            $query->where('boarding_room_id', $request->integer('boarding_room_id'));
        }

        return response()->json(['success' => true, 'data' => $query->limit((int) $request->input('limit', 300))->get()->map(fn ($row) => $this->schedulePayload($row))->values()]);
    }

    public function storeSchedule(Request $request)
    {
        $validated = $this->validateSchedule($request);
        $schedule = NgajiSchedule::query()->create($validated);
        app(AuditLogService::class)->record($request, 'ngaji_schedule', 'create', $schedule);

        return response()->json(['success' => true, 'message' => 'Jadwal ngaji berhasil ditambahkan', 'data' => $this->schedulePayload($schedule->fresh(['session', 'book', 'teacher', 'complex', 'room', 'classRef', 'day']))], 201);
    }

    public function updateSchedule(Request $request, NgajiSchedule $schedule)
    {
        $validated = $this->validateSchedule($request, true);
        $before = $schedule->toArray();
        $schedule->update($validated);
        app(AuditLogService::class)->record($request, 'ngaji_schedule', 'update', $schedule, $before, $schedule->fresh()->toArray());

        return response()->json(['success' => true, 'message' => 'Jadwal ngaji berhasil diperbarui', 'data' => $this->schedulePayload($schedule->fresh(['session', 'book', 'teacher', 'complex', 'room', 'classRef', 'day']))]);
    }

    public function destroySchedule(Request $request, NgajiSchedule $schedule)
    {
        $before = $schedule->toArray();
        $schedule->update(['status' => 'Nonaktif']);
        app(AuditLogService::class)->record($request, 'ngaji_schedule', 'deactivate', $schedule, $before, $schedule->fresh()->toArray());

        return response()->json(['success' => true, 'message' => 'Jadwal ngaji dinonaktifkan']);
    }

    public function context(Request $request)
    {
        $validated = $request->validate([
            'tanggal' => 'required|date',
            'ngaji_schedule_id' => 'required|integer|exists:ngaji_schedules,id',
        ]);

        $schedule = NgajiSchedule::query()
            ->with(['session', 'book', 'teacher:id,name,role', 'complex', 'room', 'classRef', 'day'])
            ->findOrFail($validated['ngaji_schedule_id']);

        if ($schedule->status !== 'Aktif' || !$schedule->session?->is_active || !$schedule->book?->is_active) {
            throw ValidationException::withMessages(['ngaji_schedule_id' => ['Jadwal, sesi, atau kitab sedang nonaktif.']]);
        }

        $students = $this->studentsForSchedule($schedule);
        $attendances = AbsensiNgaji::query()
            ->with(['actor:id,name,role'])
            ->whereDate('tanggal', $validated['tanggal'])
            ->where('ngaji_schedule_id', $schedule->id)
            ->whereIn('siswa_id', $students->pluck('id'))
            ->where('is_cancelled', false)
            ->get()
            ->keyBy('siswa_id');

        $summary = ['H' => 0, 'I' => 0, 'S' => 0, 'A' => 0, 'kosong' => 0];
        $rows = $students->map(function (Siswa $siswa) use ($attendances, &$summary) {
            $attendance = $attendances->get($siswa->id);
            $code = $attendance?->status_code;
            if ($code && isset($summary[$code])) {
                $summary[$code]++;
            } else {
                $summary['kosong']++;
            }

            return [
                'siswa' => $this->studentPayload($siswa),
                'absensi' => $attendance ? $this->attendancePayload($attendance) : null,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'tanggal' => $validated['tanggal'],
                'schedule' => $this->schedulePayload($schedule),
                'rows' => $rows,
                'summary' => $summary,
                'status_options' => AbsensiNgaji::STATUS_LABELS,
            ],
        ]);
    }

    public function storeBulk(Request $request)
    {
        $validated = $request->validate([
            'tanggal' => 'required|date',
            'ngaji_schedule_id' => 'required|integer|exists:ngaji_schedules,id',
            'diinput_oleh' => 'nullable|string|max:255',
            'actor_user_id' => 'nullable|integer|exists:users,id',
            'diinput_via' => 'nullable|in:online,offline_sync',
            'device_id' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.siswa_id' => 'required|integer|exists:siswa,id',
            'items.*.status_code' => 'required|in:H,I,S,A',
            'items.*.keterangan' => 'nullable|string',
        ]);

        $actor = $request->user();
        if (!$actor || !in_array($actor->role, ['admin', 'guru'], true)) {
            return response()->json(['success' => false, 'message' => 'Hanya admin atau guru aktif yang boleh menginput absensi ngaji'], 403);
        }
        if (!empty($validated['actor_user_id']) && (int) $validated['actor_user_id'] !== (int) $actor->id) {
            return response()->json(['success' => false, 'message' => 'Identitas penginput tidak sesuai sesi pengguna'], 403);
        }

        $schedule = NgajiSchedule::query()->with(['session', 'book'])->findOrFail($validated['ngaji_schedule_id']);
        if ($schedule->status !== 'Aktif' || !$schedule->session?->is_active || !$schedule->book?->is_active) {
            throw ValidationException::withMessages(['ngaji_schedule_id' => ['Jadwal, sesi, atau kitab sedang nonaktif.']]);
        }

        $students = $this->studentsForSchedule($schedule)->keyBy('id');
        foreach ($validated['items'] as $item) {
            if (!$students->has($item['siswa_id'])) {
                throw ValidationException::withMessages(['items' => ['Absensi ngaji hanya untuk santri pada jadwal yang dipilih.']]);
            }
        }

        $created = [];
        $updated = [];

        DB::transaction(function () use ($validated, $actor, $request, $schedule, $students, &$created, &$updated) {
            foreach ($validated['items'] as $item) {
                $student = $students->get($item['siswa_id']);
                $santri = $student?->santriPondok;
                $key = AbsensiNgaji::buildAttendanceKey($validated['tanggal'], $item['siswa_id'], $schedule->id);
                $payload = [
                    'siswa_id' => $item['siswa_id'],
                    'santri_pondok_id' => $santri?->id,
                    'ngaji_schedule_id' => $schedule->id,
                    'ngaji_session_id' => $schedule->ngaji_session_id,
                    'ngaji_book_id' => $schedule->ngaji_book_id,
                    'boarding_complex_id' => $schedule->boarding_complex_id ?: $santri?->boarding_complex_id,
                    'boarding_room_id' => $schedule->boarding_room_id ?: $santri?->boarding_room_id,
                    'class_id' => $schedule->class_id ?: $student?->class_id,
                    'tanggal' => $validated['tanggal'],
                    'status_code' => $item['status_code'],
                    'status_label' => AbsensiNgaji::STATUS_LABELS[$item['status_code']],
                    'keterangan' => $item['keterangan'] ?? null,
                    'attendance_key' => $key,
                    'diinput_oleh' => $validated['diinput_oleh'] ?? $actor->name,
                    'actor_user_id' => $actor->id,
                    'diinput_via' => $validated['diinput_via'] ?? 'online',
                    'device_id' => $validated['device_id'] ?? null,
                    'synced_at' => ($validated['diinput_via'] ?? null) === 'offline_sync' ? now() : null,
                    'is_cancelled' => false,
                    'cancelled_at' => null,
                    'cancelled_by' => null,
                    'cancel_reason' => null,
                ];

                $existing = AbsensiNgaji::query()->where('attendance_key', $key)->first();
                if ($existing) {
                    $before = $existing->toArray();
                    $existing->update($payload);
                    $updated[] = $this->attendancePayload($existing->fresh(['siswa', 'session', 'book', 'schedule', 'actor']));
                    app(AuditLogService::class)->record($request, 'absensi_ngaji', 'update', $existing, $before, $existing->fresh()->toArray());
                } else {
                    $row = AbsensiNgaji::create($payload);
                    $created[] = $this->attendancePayload($row->fresh(['siswa', 'session', 'book', 'schedule', 'actor']));
                }
            }
        });

        app(AuditLogService::class)->record($request, 'absensi_ngaji', 'bulk_upsert', 'bulk_absensi_ngaji', null, null, [
            'tanggal' => $validated['tanggal'],
            'ngaji_schedule_id' => $schedule->id,
            'created' => count($created),
            'updated' => count($updated),
        ]);
        $this->notifyGuardians(collect($created)->merge($updated)->all());
        $processedCount = count($created) + count($updated);
        if ($processedCount > 0) {
            app(AdminActivityNotificationService::class)->notifyAdmins(
                'Absensi Ngaji Diperbarui',
                sprintf(
                    '%d data absensi %s - %s berhasil disimpan oleh %s.',
                    $processedCount,
                    $schedule->session?->name ?? 'Ngaji',
                    $schedule->book?->name ?? 'Kitab',
                    $actor->name
                ),
                'absensi_ngaji',
                [
                    'ngaji_schedule_id' => $schedule->id,
                    'created_count' => count($created),
                    'updated_count' => count($updated),
                    'tanggal' => $validated['tanggal'],
                ],
            );
        }

        return response()->json([
            'success' => true,
            'message' => count($created) . ' absensi baru, ' . count($updated) . ' diperbarui',
            'created' => $created,
            'updated' => $updated,
            'failed' => [],
        ], count($created) > 0 ? 201 : 200);
    }

    public function cancel(Request $request)
    {
        $validated = $request->validate([
            'tanggal' => 'required|date',
            'ngaji_schedule_id' => 'required|integer|exists:ngaji_schedules,id',
            'reason' => 'nullable|string|max:500',
        ]);

        $actor = $request->user();
        if (!$actor || !in_array($actor->role, ['admin', 'guru'], true)) {
            return response()->json(['success' => false, 'message' => 'Hanya admin atau guru aktif yang boleh membatalkan absensi ngaji'], 403);
        }

        $rows = AbsensiNgaji::query()
            ->whereDate('tanggal', $validated['tanggal'])
            ->where('ngaji_schedule_id', $validated['ngaji_schedule_id'])
            ->where('is_cancelled', false)
            ->get();

        if ($rows->isEmpty()) {
            throw ValidationException::withMessages(['absensi' => ['Belum ada absensi aktif pada tanggal dan jadwal ini.']]);
        }

        DB::transaction(function () use ($rows, $actor, $validated, $request) {
            foreach ($rows as $row) {
                $before = $row->toArray();
                $row->update([
                    'is_cancelled' => true,
                    'cancelled_at' => now(),
                    'cancelled_by' => $actor->id,
                    'cancel_reason' => $validated['reason'] ?? null,
                ]);
                app(AuditLogService::class)->record($request, 'absensi_ngaji', 'cancel', $row, $before, $row->fresh()->toArray());
            }
        });

        return response()->json(['success' => true, 'message' => $rows->count() . ' data absensi ngaji dibatalkan', 'cancelled' => $rows->count()]);
    }

    public function rekap(Request $request)
    {
        $validated = $request->validate([
            'bulan' => 'nullable|integer|min:1|max:12',
            'tahun' => 'nullable|integer|min:2000|max:2100',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date|after_or_equal:tanggal_mulai',
            'ngaji_schedule_id' => 'nullable|integer|exists:ngaji_schedules,id',
            'ngaji_session_id' => 'nullable|integer|exists:ngaji_sessions,id',
            'ngaji_book_id' => 'nullable|integer|exists:ngaji_books,id',
            'siswa_id' => 'nullable|integer|exists:siswa,id',
            'status' => 'nullable|in:H,I,S,A,Kosong,Dibatalkan',
        ]);

        $start = !empty($validated['tanggal_mulai'])
            ? Carbon::parse($validated['tanggal_mulai'])->startOfDay()
            : Carbon::create((int) ($validated['tahun'] ?? now()->year), (int) ($validated['bulan'] ?? now()->month), 1)->startOfDay();
        $end = !empty($validated['tanggal_akhir'])
            ? Carbon::parse($validated['tanggal_akhir'])->startOfDay()
            : $start->copy()->endOfMonth()->startOfDay();
        if ($start->diffInDays($end) > 62) {
            $end = $start->copy()->addDays(62);
        }

        $schedules = NgajiSchedule::query()
            ->with(['session', 'book', 'teacher:id,name,role', 'complex', 'room', 'classRef'])
            ->where('status', 'Aktif')
            ->when(!empty($validated['ngaji_schedule_id']), fn ($query) => $query->whereKey($validated['ngaji_schedule_id']))
            ->when(!empty($validated['ngaji_session_id']), fn ($query) => $query->where('ngaji_session_id', $validated['ngaji_session_id']))
            ->when(!empty($validated['ngaji_book_id']), fn ($query) => $query->where('ngaji_book_id', $validated['ngaji_book_id']))
            ->get();

        $records = collect();
        foreach ($schedules as $schedule) {
            $students = $this->studentsForSchedule($schedule)
                ->when(!empty($validated['siswa_id']), fn ($collection) => $collection->where('id', (int) $validated['siswa_id']));
            $attendances = AbsensiNgaji::query()
                ->with(['actor:id,name,role'])
                ->whereBetween('tanggal', [$start->toDateString(), $end->toDateString()])
                ->where('ngaji_schedule_id', $schedule->id)
                ->whereIn('siswa_id', $students->pluck('id')->all())
                ->get()
                ->keyBy(fn (AbsensiNgaji $row) => $row->tanggal->format('Y-m-d') . '|' . $row->siswa_id);

            foreach (CarbonPeriod::create($start, $end) as $date) {
                $dateKey = $date->format('Y-m-d');
                foreach ($students as $student) {
                    $attendance = $attendances->get($dateKey . '|' . $student->id);
                    $status = $attendance?->is_cancelled ? 'Dibatalkan' : ($attendance?->status_code ?? 'Kosong');
                    if (!empty($validated['status']) && $validated['status'] !== $status) {
                        continue;
                    }
                    $records->push([
                        'tanggal' => $dateKey,
                        'siswa_id' => $student->id,
                        'nis' => $student->nis,
                        'nama' => $student->nama,
                        'kelas' => $student->kelasRef?->name ?? $student->kelas,
                        'ngaji_schedule_id' => $schedule->id,
                        'sesi' => $schedule->session?->name,
                        'kitab' => $schedule->book?->name,
                        'metode' => $schedule->book?->method,
                        'pengajar' => $schedule->teacher?->name,
                        'komplek' => $schedule->complex?->name ?? $student->santriPondok?->complex?->name,
                        'kamar' => $schedule->room?->name ?? $student->santriPondok?->room?->name,
                        'status' => $status,
                        'status_label' => $attendance?->is_cancelled ? 'Dibatalkan' : ($attendance?->status_label ?? 'Kosong'),
                        'petugas' => $attendance?->actor?->name ?? $attendance?->diinput_oleh,
                        'waktu_input' => $attendance?->created_at?->toIso8601String(),
                    ]);
                }
            }
        }

        $rows = $records
            ->groupBy(fn ($item) => $item['siswa_id'] . '|' . $item['ngaji_schedule_id'])
            ->map(function ($items) {
                $first = $items->first();
                return [
                    'siswa_id' => $first['siswa_id'],
                    'nama' => $first['nama'],
                    'kelas' => $first['kelas'],
                    'sesi' => $first['sesi'],
                    'kitab' => $first['kitab'],
                    'pengajar' => $first['pengajar'],
                    'H' => $items->where('status', 'H')->count(),
                    'I' => $items->where('status', 'I')->count(),
                    'S' => $items->where('status', 'S')->count(),
                    'A' => $items->where('status', 'A')->count(),
                    'Kosong' => $items->where('status', 'Kosong')->count(),
                    'Dibatalkan' => $items->where('status', 'Dibatalkan')->count(),
                    'total' => $items->count(),
                ];
            })
            ->sortBy('nama')
            ->values();

        return response()->json([
            'success' => true,
            'data' => $rows,
            'records' => $records->sortBy([['tanggal', 'desc'], ['nama', 'asc']])->values(),
            'summary' => [
                'H' => $rows->sum('H'),
                'I' => $rows->sum('I'),
                'S' => $rows->sum('S'),
                'A' => $rows->sum('A'),
                'Kosong' => $rows->sum('Kosong'),
                'Dibatalkan' => $rows->sum('Dibatalkan'),
                'total' => $rows->sum('total'),
                'persentase_hadir' => $rows->sum('total') > 0 ? round(($rows->sum('H') / max(1, $rows->sum('total') - $rows->sum('Dibatalkan'))) * 100, 2) : 0,
            ],
            'periode' => ['tanggal_mulai' => $start->toDateString(), 'tanggal_akhir' => $end->toDateString()],
        ]);
    }

    private function masterPayload(array $validated, string $modelClass): array
    {
        $code = $validated['code'] ?? str($validated['name'])->lower()->ascii()->slug('_')->toString();
        if (!isset($validated['code']) && $modelClass::query()->where('code', $code)->exists()) {
            throw ValidationException::withMessages(['name' => ['Nama ini menghasilkan kode yang sudah dipakai. Gunakan nama lain atau isi kode khusus.']]);
        }
        $validated['code'] = $code;
        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['sort_order'] = $validated['sort_order'] ?? 0;

        return $validated;
    }

    private function validateSchedule(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'ngaji_session_id' => $required . '|integer|exists:ngaji_sessions,id',
            'ngaji_book_id' => $required . '|integer|exists:ngaji_books,id',
            'teacher_id' => 'nullable|integer|exists:users,id',
            'boarding_complex_id' => 'nullable|integer|exists:boarding_complexes,id',
            'boarding_room_id' => 'nullable|integer|exists:boarding_rooms,id',
            'class_id' => 'nullable|integer|exists:classes,id',
            'day_id' => 'nullable|integer|exists:days,id',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'status' => 'nullable|in:Aktif,Nonaktif',
            'description' => 'nullable|string|max:500',
        ]);
    }

    private function studentsForSchedule(NgajiSchedule $schedule)
    {
        if ($schedule->boarding_room_id) {
            return SantriPondok::query()
                ->with(['siswa.kelasRef:id,name', 'room.complex', 'complex'])
                ->where('status', 'Aktif')
                ->where('boarding_room_id', $schedule->boarding_room_id)
                ->get()
                ->map(fn (SantriPondok $row) => $row->siswa?->setRelation('santriPondok', $row))
                ->filter()
                ->sortBy('nama')
                ->values();
        }

        if ($schedule->boarding_complex_id) {
            return SantriPondok::query()
                ->with(['siswa.kelasRef:id,name', 'room.complex', 'complex'])
                ->where('status', 'Aktif')
                ->where('boarding_complex_id', $schedule->boarding_complex_id)
                ->get()
                ->map(fn (SantriPondok $row) => $row->siswa?->setRelation('santriPondok', $row))
                ->filter()
                ->sortBy('nama')
                ->values();
        }

        if ($schedule->class_id) {
            return Siswa::query()
                ->with(['kelasRef:id,name', 'santriPondok.room.complex', 'santriPondok.complex'])
                ->where('class_id', $schedule->class_id)
                ->where('status', 'Aktif')
                ->orderBy('nama')
                ->get();
        }

        return SantriPondok::query()
            ->with(['siswa.kelasRef:id,name', 'room.complex', 'complex'])
            ->where('status', 'Aktif')
            ->get()
            ->map(fn (SantriPondok $row) => $row->siswa?->setRelation('santriPondok', $row))
            ->filter()
            ->sortBy('nama')
            ->values();
    }

    private function schedulePayload(NgajiSchedule $schedule): array
    {
        return [
            'id' => $schedule->id,
            'ngaji_session_id' => $schedule->ngaji_session_id,
            'ngaji_book_id' => $schedule->ngaji_book_id,
            'teacher_id' => $schedule->teacher_id,
            'boarding_complex_id' => $schedule->boarding_complex_id,
            'boarding_room_id' => $schedule->boarding_room_id,
            'class_id' => $schedule->class_id,
            'day_id' => $schedule->day_id,
            'start_time' => $schedule->start_time,
            'end_time' => $schedule->end_time,
            'status' => $schedule->status,
            'description' => $schedule->description,
            'sesi' => $schedule->session?->name,
            'kitab' => $schedule->book?->name,
            'metode' => $schedule->book?->method,
            'pengajar' => $schedule->teacher?->name,
            'komplek' => $schedule->complex?->name,
            'kamar' => $schedule->room?->name,
            'kelas' => $schedule->classRef?->name,
            'hari' => $schedule->day?->name,
            'session' => $schedule->session,
            'book' => $schedule->book,
        ];
    }

    private function studentPayload(Siswa $siswa): array
    {
        return [
            'id' => $siswa->id,
            'nis' => $siswa->nis,
            'nisn' => $siswa->nisn,
            'nama' => $siswa->nama,
            'kelas' => $siswa->kelasRef?->name ?? $siswa->kelas,
            'class_id' => $siswa->class_id,
            'santri_pondok_id' => $siswa->santriPondok?->id,
            'boarding_room_id' => $siswa->santriPondok?->boarding_room_id ?? $siswa->boarding_room_id,
            'kamar' => $siswa->santriPondok?->room?->name ?? $siswa->boardingRoom?->name ?? $siswa->kamar,
            'boarding_complex_id' => $siswa->santriPondok?->boarding_complex_id ?? $siswa->boardingRoom?->boarding_complex_id,
            'komplek' => $siswa->santriPondok?->complex?->name ?? $siswa->santriPondok?->room?->complex?->name ?? $siswa->komplek,
        ];
    }

    private function attendancePayload(AbsensiNgaji $attendance): array
    {
        return [
            'id' => $attendance->id,
            'siswa_id' => $attendance->siswa_id,
            'santri_pondok_id' => $attendance->santri_pondok_id,
            'ngaji_schedule_id' => $attendance->ngaji_schedule_id,
            'ngaji_session_id' => $attendance->ngaji_session_id,
            'ngaji_book_id' => $attendance->ngaji_book_id,
            'tanggal' => $attendance->tanggal?->format('Y-m-d'),
            'status_code' => $attendance->status_code,
            'status_label' => $attendance->status_label,
            'keterangan' => $attendance->keterangan,
            'diinput_oleh' => $attendance->diinput_oleh,
            'actor_user_id' => $attendance->actor_user_id,
            'is_cancelled' => (bool) $attendance->is_cancelled,
            'sesi' => $attendance->session?->name,
            'kitab' => $attendance->book?->name,
            'metode' => $attendance->book?->method,
            'siswa' => $attendance->relationLoaded('siswa') && $attendance->siswa ? $this->studentPayload($attendance->siswa) : null,
            'created_at' => $attendance->created_at?->toIso8601String(),
            'updated_at' => $attendance->updated_at?->toIso8601String(),
        ];
    }

    private function notifyGuardians(array $attendances): void
    {
        $studentIds = collect($attendances)->pluck('siswa_id')->filter()->unique();
        if ($studentIds->isEmpty()) {
            return;
        }

        $students = Siswa::query()
            ->with(['guardianProfile:id,user_id', 'wali:id,name'])
            ->whereIn('id', $studentIds)
            ->get()
            ->keyBy('id');

        foreach ($attendances as $attendance) {
            $student = $students->get($attendance['siswa_id'] ?? null);
            $userIds = collect([$student?->wali_id, $student?->guardianProfile?->user_id])->filter()->unique();
            foreach ($userIds as $userId) {
                AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => 'Absensi Ngaji',
                    'message' => sprintf(
                        '%s tercatat %s pada %s (%s) tanggal %s.',
                        $student?->nama ?? 'Santri',
                        $attendance['status_label'] ?? '-',
                        $attendance['sesi'] ?? 'Ngaji',
                        $attendance['kitab'] ?? 'Kitab',
                        $attendance['tanggal'] ?? '-'
                    ),
                    'type' => 'absensi_ngaji',
                    'data' => [
                        'siswa_id' => $attendance['siswa_id'] ?? null,
                        'absensi_ngaji_id' => $attendance['id'] ?? null,
                        'tanggal' => $attendance['tanggal'] ?? null,
                        'status' => $attendance['status_code'] ?? null,
                    ],
                ]);
            }

            if ($student) {
                // Kirim notifikasi lengkap langsung ke aplikasi HP wali santri (Status Bar & In-App)
                app(\App\Services\AppPushNotificationService::class)->notifyAbsensiNgaji($attendance, $student);
            }
        }
    }
}
