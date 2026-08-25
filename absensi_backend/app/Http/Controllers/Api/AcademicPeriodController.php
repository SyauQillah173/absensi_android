<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Services\ActorResolver;
use App\Services\AcademicPeriodService;
use App\Services\AuditLogService;
use App\Services\PaymentBillService;
use Illuminate\Http\Request;

class AcademicPeriodController extends Controller
{
    public function __construct(private readonly AcademicPeriodService $periodService)
    {
    }

    public function index()
    {
        $period = $this->periodService->active();

        return response()->json([
            'success' => true,
            'active' => $this->formatActive($period),
            'data' => AcademicYear::query()
                ->with('semesters')
                ->orderByDesc('year_start')
                ->orderByDesc('id')
                ->get()
                ->map(fn (AcademicYear $year) => $this->formatYear($year))
                ->values(),
        ]);
    }

    public function active()
    {
        return response()->json([
            'success' => true,
            'data' => $this->formatActive($this->periodService->active()),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:30|unique:academic_years,name',
            'year_start' => 'required|integer|min:1900|max:2200',
            'year_end' => 'nullable|integer|min:1901|max:2201',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'active_semester' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $year = $this->periodService->create($validated);
        $autoSync = $year->is_active ? $this->prepareActivePeriod($request, $year) : null;
        app(AuditLogService::class)->record($request, 'academic_periods', 'create', $year, null, $year->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Tahun ajaran berhasil ditambahkan',
            'data' => $this->formatYear($year),
            'auto_sync' => $autoSync,
        ], 201);
    }

    public function update(Request $request, AcademicYear $academicYear)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:30|unique:academic_years,name,' . $academicYear->id,
            'year_start' => 'sometimes|integer|min:1900|max:2200',
            'year_end' => 'nullable|integer|min:1901|max:2201',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'active_semester' => 'nullable|string',
        ]);

        $before = $academicYear->toArray();
        $year = $this->periodService->update($academicYear, $validated);
        $autoSync = $year->is_active ? $this->prepareActivePeriod($request, $year) : null;
        app(AuditLogService::class)->record($request, 'academic_periods', 'update', $year, $before, $year->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Tahun ajaran berhasil diperbarui',
            'data' => $this->formatYear($year),
            'auto_sync' => $autoSync,
        ]);
    }

    public function activate(Request $request, AcademicYear $academicYear)
    {
        $validated = $request->validate([
            'semester' => 'nullable|string',
            'active_semester' => 'nullable|string',
        ]);

        $before = AcademicYear::query()->where('is_active', true)->get()->toArray();
        $year = $this->periodService->activate($academicYear, $validated['semester'] ?? $validated['active_semester'] ?? null);
        $autoSync = $this->prepareActivePeriod($request, $year);
        
        $semester = $year->semesters()->where('is_active', true)->first();
        $billCount = app(PaymentBillService::class)->generateBillsForAcademicPeriod($year, $semester);
        
        app(AuditLogService::class)->record($request, 'academic_periods', 'activate', $year, $before, [
            ...$year->toArray(),
            'payment_bills_generated' => $billCount,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tahun ajaran aktif berhasil diganti',
            'data' => $this->formatYear($year),
            'auto_sync' => $autoSync,
        ]);
    }

    public function semester(Request $request, AcademicYear $academicYear)
    {
        $validated = $request->validate([
            'semester' => 'required|string',
        ]);

        $before = $academicYear->fresh('semesters')->toArray();
        $this->periodService->setSemester($academicYear, $validated['semester']);
        $year = $academicYear->fresh('semesters');
        $autoSync = $this->prepareActivePeriod($request, $year);
        
        $semester = $year->semesters()->where('is_active', true)->first();
        $billCount = app(PaymentBillService::class)->generateBillsForAcademicPeriod($year, $semester);
        
        app(AuditLogService::class)->record($request, 'academic_periods', 'semester', $year, $before, [
            ...$year->toArray(),
            'payment_bills_generated' => $billCount,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Semester aktif berhasil diperbarui',
            'data' => $this->formatYear($year),
            'auto_sync' => $autoSync,
        ]);
    }

    public function syncSiswa(Request $request, AcademicYear $academicYear)
    {
        $validated = $request->validate([
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'semester' => 'nullable|string',
        ]);

        $summary = $this->periodService->syncStudents(
            $academicYear,
            $validated,
            app(ActorResolver::class)->active($request)?->id
        );
        $semester = !empty($summary['semester_id'])
            ? $academicYear->semesters()->find($summary['semester_id'])
            : $academicYear->semesters()->where('is_active', true)->first();
        $billCount = app(PaymentBillService::class)->generateBillsForAcademicPeriod($academicYear->fresh(), $semester);

        app(AuditLogService::class)->record($request, 'academic_periods', 'sync_siswa', $academicYear, null, [
            ...$summary,
            'payment_bills' => $billCount,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Sinkronisasi Completed',
            'data' => [
                ...$summary,
                'payment_bills' => $billCount,
            ],
        ]);
    }

    public function autoPromote(Request $request, AcademicYear $academicYear)
    {
        $actor = app(ActorResolver::class)->active($request);
        if (!$actor || $actor->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Hanya admin yang dapat memproses kenaikan kelas.'], 403);
        }

        $result = $this->periodService->autoPromoteAllStudents($academicYear, $actor->id);

        app(AuditLogService::class)->record($request, 'academic_periods', 'auto_promote', $academicYear, null, $result);

        return response()->json([
            'success' => true,
            'message' => "Kenaikan kelas otomatis berhasil diproses untuk Tahun Ajaran {$academicYear->name}.",
            'data' => $result,
        ]);
    }

    public function destroy(Request $request, AcademicYear $academicYear)
    {
        $actor = app(ActorResolver::class)->active($request);
        if (!$actor || $actor->role !== 'admin') {
            return $this->forbidden('Hanya admin yang dapat menghapus tahun ajaran');
        }

        $totalYears = AcademicYear::query()->count();
        if ($totalYears <= 1) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak dapat menghapus satu-satunya tahun ajaran yang tersisa di sistem.',
            ], 422);
        }

        $before = $academicYear->toArray();
        $this->periodService->delete($academicYear);
        app(AuditLogService::class)->record($request, 'academic_periods', 'delete', null, $before, null);

        return response()->json([
            'success' => true,
            'message' => "Tahun ajaran {$academicYear->name} beserta seluruh tagihan & data terkait berhasil dihapus secara bersih.",
        ]);
    }

    private function prepareActivePeriod(Request $request, AcademicYear $year): array
    {
        $fresh = $year->fresh('semesters');
        $semester = $fresh->semesters->firstWhere('is_active', true);
        $summary = $this->periodService->syncStudents(
            $fresh,
            [
                'semester_id' => $semester?->id,
                'semester' => $semester?->code ?? $fresh->active_semester,
            ],
            app(ActorResolver::class)->active($request)?->id
        );
        $billCount = app(PaymentBillService::class)->generateBillsForAcademicPeriod($fresh, $semester);

        return [
            'siswa' => $summary,
            'payment_bills' => $billCount,
        ];
    }

    private function formatActive(array $period): array
    {
        return [
            'academic_year_id' => $period['academic_year_id'],
            'semester_id' => $period['semester_id'],
            'tahun_ajaran' => $period['tahun_ajaran'],
            'semester' => $period['semester_code'],
            'semester_label' => $period['semester_label'],
            'academic_year' => $this->formatYear($period['academic_year']),
        ];
    }

    private function formatYear(AcademicYear $year): array
    {
        return [
            'id' => $year->id,
            'name' => $year->name,
            'year_start' => $year->year_start,
            'year_end' => $year->year_end,
            'start_date' => optional($year->start_date)->toDateString(),
            'end_date' => optional($year->end_date)->toDateString(),
            'active_semester' => $year->active_semester,
            'is_active' => (bool) $year->is_active,
            'semesters' => $year->semesters
                ? $year->semesters->map(fn ($semester) => [
                    'id' => $semester->id,
                    'code' => $semester->code,
                    'name' => $semester->name,
                    'is_active' => (bool) $semester->is_active,
                ])->values()
                : [],
        ];
    }
}
