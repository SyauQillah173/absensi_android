<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BoardingRoom;
use App\Models\KelompokBelajar;
use App\Models\SantriPondok;
use App\Models\Siswa;
use App\Models\SiswaTahunAjaran;
use App\Services\AuditLogService;
use App\Services\ReferenceResolver;
use App\Services\WaliAccountService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class SiswaController extends Controller
{
    public function __construct(private readonly WaliAccountService $waliAccountService)
    {
    }

    public function index(Request $request)
    {
        $query = Siswa::query();

        if ($request->boolean('with_wali')) {
            $query->with(['wali:id,name,email,no_hp,status']);
        }
        if ($request->boolean('for_payment') || $request->boolean('for_boarding') || $request->filled('academic_year_id') || $request->filled('semester_id')) {
            $query->with(['wali:id,name,email,no_hp,status', 'kelasRef:id,name', 'boardingRoom.complex', 'santriPondok.room.complex', 'kelompokBelajar:id,nama,kategori,sifir,class_id']);
        } else {
            $query->with(['boardingRoom.complex', 'santriPondok.room.complex']);
        }

        if ($request->filled('academic_year_id')) {
            $academicYearId = $request->integer('academic_year_id');
            $semesterId = $request->filled('semester_id') ? $request->integer('semester_id') : null;
            $query->whereHas('tahunAjaran', function ($builder) use ($academicYearId, $semesterId) {
                $builder->where('academic_year_id', $academicYearId)
                    ->where('is_active', true);
                if ($semesterId) {
                    $builder->where('semester_id', $semesterId);
                }
            });
        }

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        } elseif ($request->has('kelas')) {
            $classId = app(ReferenceResolver::class)->classId($request->kelas, false);
            $classId ? $query->where('class_id', $classId) : $query->whereRaw('1 = 0');
        }
        if ($request->has('status')) {
            $statusId = app(ReferenceResolver::class)->studentStatusId($request->status);
            $statusId ? $query->where('student_status_id', $statusId) : $query->whereRaw('1 = 0');
        }
        if ($request->filled('search')) {
            $search = '%' . trim((string) $request->search) . '%';
            $query->where(function ($builder) use ($search) {
                $builder->where('nama', 'ilike', $search)
                    ->orWhere('nis', 'ilike', $search)
                    ->orWhere('nisn', 'ilike', $search)
                    ->orWhere('kelas', 'ilike', $search)
                    ->orWhereHas('kelasRef', fn ($nested) => $nested->where('name', 'ilike', $search));
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query
                ->orderByRaw("CASE WHEN status = 'Aktif' THEN 0 ELSE 1 END")
                ->orderBy('nama')
                ->get()
                ->map(function (Siswa $siswa) use ($request) {
                if (!$request->boolean('for_payment') && !$request->boolean('for_boarding') && !$request->filled('academic_year_id')) {
                    return $siswa;
                }

                $row = $siswa->toArray();
                $row['wali_nama'] = $siswa->wali?->name ?? $siswa->nama_wali;
                $row['kelas'] = $siswa->kelasRef?->name ?? $siswa->kelas;
                $row['kelompok_belajar_label'] = $siswa->kelompokBelajar
                    ->pluck('nama')
                    ->filter()
                    ->values()
                    ->implode(', ');
                return $row;
            })->values(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nis' => 'required|string|unique:siswa,nis',
            'nisn' => 'nullable|string',
            'nama' => 'required|string',
            'nama_panggilan' => 'nullable|string',
            'tempat_lahir' => 'nullable|string',
            'tanggal_lahir' => 'nullable|date',
            'jenis_kelamin' => 'required|in:L,P',
            'nik' => 'nullable|string|max:16',
            'no_kk' => 'nullable|string|max:16',
            'no_akta' => 'nullable|string',
            'dokumen_akta' => 'nullable|string',
            'nama_wali' => 'nullable|string',
            'no_telepon_wali' => 'nullable|string',
            'kelas' => 'nullable|string',
            'class_id' => 'nullable|integer|exists:classes,id',
            'status' => 'required|in:Aktif,Nonaktif,Lulus',
            'alamat' => 'nullable|string',
            'kewarganegaraan' => 'nullable|string',
            'provinsi' => 'nullable|string',
            'province_code' => 'nullable|string',
            'province_id' => 'nullable|integer|exists:provinces,id',
            'kota' => 'nullable|string',
            'city_code' => 'nullable|string',
            'city_id' => 'nullable|integer|exists:cities,id',
            'kecamatan' => 'nullable|string',
            'district_code' => 'nullable|string',
            'district_id' => 'nullable|integer|exists:districts,id',
            'kelurahan' => 'nullable|string',
            'village_code' => 'nullable|string',
            'village_id' => 'nullable|integer|exists:villages,id',
            'kode_pos' => 'nullable|string|max:5',
            'no_whatsapp' => 'nullable|string|max:20',
            'email_siswa' => 'nullable|string|email',
            'asal_sekolah' => 'nullable|string',
            'sekolah_formal' => 'nullable|string',
            'school_origin_id' => 'nullable|integer|exists:school_origins,id',
            'previous_asal_sekolah' => 'nullable|string',
            'previous_school_origin_id' => 'nullable|integer|exists:school_origins,id',
            'tahun_lulus' => 'nullable|string|max:4',
            'tahun_akademik_masuk' => 'nullable|string',
            'tahun_akademik_masuk_madin' => 'nullable|string',
            'tahun_akademik_masuk_formal' => 'nullable|string',
            'jenis_santri' => 'nullable|string',
            'student_type_id' => 'nullable|integer|exists:student_types,id',
            'anak_ke' => 'nullable|string',
            'jml_saudara' => 'nullable|string',
            'nama_ayah' => 'nullable|string',
            'nik_ayah' => 'nullable|string|max:16',
            'tempat_lahir_ayah' => 'nullable|string',
            'tanggal_lahir_ayah' => 'nullable|date',
            'nama_ibu' => 'nullable|string',
            'nik_ibu' => 'nullable|string|max:16',
            'tempat_lahir_ibu' => 'nullable|string',
            'tanggal_lahir_ibu' => 'nullable|date',
            'pendidikan_ayah' => 'nullable|string',
            'father_education_id' => 'nullable|integer|exists:education_levels,id',
            'pendidikan_ibu' => 'nullable|string',
            'mother_education_id' => 'nullable|integer|exists:education_levels,id',
            'pekerjaan_ayah' => 'nullable|string',
            'father_occupation_id' => 'nullable|integer|exists:occupations,id',
            'penghasilan_ayah' => 'nullable|string',
            'father_income_id' => 'nullable|integer|exists:income_ranges,id',
            'pekerjaan_ibu' => 'nullable|string',
            'mother_occupation_id' => 'nullable|integer|exists:occupations,id',
            'penghasilan_ibu' => 'nullable|string',
            'mother_income_id' => 'nullable|integer|exists:income_ranges,id',
            'alamat_ayah' => 'nullable|string',
            'alamat_ibu' => 'nullable|string',
            'alamat_lengkap_ayah' => 'nullable|string',
            'alamat_lengkap_ibu' => 'nullable|string',
            'no_ayah' => 'nullable|string',
            'no_whatsapp_ayah' => 'nullable|string|max:20',
            'no_ibu' => 'nullable|string',
            'no_whatsapp_ibu' => 'nullable|string|max:20',
            'nama_wali_keluarga' => 'nullable|string',
            'pekerjaan_wali_keluarga' => 'nullable|string',
            'guardian_occupation_id' => 'nullable|integer|exists:occupations,id',
            'alamat_wali_keluarga' => 'nullable|string',
            'wali_sama_dengan' => 'nullable|string',
            'guardian_relationship_id' => 'nullable|integer|exists:guardian_relationships,id',
            'tanggal_masuk' => 'nullable|date',
            'tempat_tinggal' => 'nullable|string',
            'residence_type_id' => 'nullable|integer|exists:residence_types,id',
            'transportasi' => 'nullable|string',
            'transport_mode_id' => 'nullable|integer|exists:transport_modes,id',
            'status_mondok' => 'nullable|in:mondok,tidak_mondok',
            'boarding_room_id' => 'nullable|integer|exists:boarding_rooms,id',
            'komplek' => 'nullable|string',
            'kamar' => 'nullable|string',
            'tanggal_diterima_pondok' => 'nullable|date',
            'tanggal_diterima_sekolah' => 'nullable|date',
            'tinggi_badan' => 'nullable|string',
            'berat_badan' => 'nullable|string',
            'golongan_darah' => 'nullable|string',
            'blood_type_id' => 'nullable|integer|exists:blood_types,id',
            'foto_santri' => 'nullable|string',
            'catatan_santri' => 'nullable|string',
        ]);
        $validated = $this->normalizeBoardingFields($validated);
        $validated = $this->mirrorGuardianFromParent($validated);
        $validated = $this->normalizeStudentReferences($validated);

        $siswa = DB::transaction(function () use ($validated) {
            $siswa = Siswa::create($validated);
            $this->syncKelompokBelajar($siswa, $validated['kelas'] ?? null);
            $this->syncSantriPondok($siswa);
            $this->waliAccountService->syncForStudent($siswa);

            return $siswa->fresh();
        });
        app(AuditLogService::class)->record($request, 'siswa', 'create', $siswa, null, $siswa->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil ditambahkan',
            'data' => $siswa->load('wali:id,name,email,no_hp,status'),
        ], 201);
    }

    public function import(Request $request)
    {
        $validated = $request->validate([
            'rows' => 'required|array|min:1',
            'rows.*' => 'array',
        ]);

        $imported = [];
        $updated = [];
        $errors = [];
        $warnings = [];

        $academicPeriodService = app(\App\Services\AcademicPeriodService::class);
        $activePeriod = $academicPeriodService->active();
        $academicYearId = $activePeriod['academic_year_id'];
        $semesterId = $activePeriod['semester_id'];
        $tahunAjaranName = $activePeriod['tahun_ajaran'];
        $semesterName = $activePeriod['semester_label'];

        $maxSiswaId = Siswa::max('id') ?? 0;

        foreach ($validated['rows'] as $index => $row) {
            $rowNumber = $index + 2;
            $payload = $this->prepareImportPayload($row);
            $rowWarnings = [];

            // Auto-generate numeric NIS if empty
            if (empty($payload['nis'])) {
                $payload['nis'] = date('y') . str_pad((string)($maxSiswaId + $index + 1), 4, '0', STR_PAD_LEFT);
            }

            // Check if existing student matches by NIK, NISN, NIS, or (Nama + Tanggal Lahir)
            $existingStudent = null;
            if (!empty($payload['nik'])) {
                $existingStudent = Siswa::where('nik', $payload['nik'])->first();
            }
            if (!$existingStudent && !empty($payload['nisn'])) {
                $existingStudent = Siswa::where('nisn', $payload['nisn'])->first();
            }
            if (!$existingStudent && !empty($row['nis'])) {
                $existingStudent = Siswa::where('nis', $row['nis'])->first();
            }
            if (!$existingStudent && !empty($payload['nama']) && !empty($payload['tanggal_lahir'])) {
                $existingStudent = Siswa::whereRaw('LOWER(TRIM(nama)) = ?', [strtolower(trim($payload['nama']))])
                    ->where('tanggal_lahir', $payload['tanggal_lahir'])
                    ->first();
            }

            $validator = Validator::make(
                $payload,
                [
                    'nis' => 'required|string|max:100' . ($existingStudent ? '|unique:siswa,nis,' . $existingStudent->id : '|unique:siswa,nis'),
                    'nisn' => 'nullable|string|max:100',
                    'nama' => 'required|string|max:255',
                    'jenis_kelamin' => 'required|in:L,P',
                    'status' => 'nullable|in:Aktif,Nonaktif,Lulus',
                    'class_id' => 'nullable|integer|exists:classes,id',
                    'province_id' => 'nullable|integer|exists:provinces,id',
                    'city_id' => 'nullable|integer|exists:cities,id',
                    'district_id' => 'nullable|integer|exists:districts,id',
                    'village_id' => 'nullable|integer|exists:villages,id',
                    'tanggal_lahir' => 'nullable|date',
                    'tanggal_masuk' => 'nullable|date',
                    'email_siswa' => 'nullable|email',
                    'school_origin_id' => 'nullable|integer|exists:school_origins,id',
                    'previous_school_origin_id' => 'nullable|integer|exists:school_origins,id',
                    'status_mondok' => 'nullable|in:mondok,tidak_mondok',
                    'boarding_room_id' => 'nullable|integer|exists:boarding_rooms,id',
                    'komplek' => 'nullable|string',
                    'kamar' => 'nullable|string',
                    'tanggal_diterima_pondok' => 'nullable|date',
                    'tanggal_diterima_sekolah' => 'nullable|date',
                    'kode_pos' => 'nullable|string|max:10',
                    'no_whatsapp' => 'nullable|string|max:20',
                    'no_telepon_wali' => 'nullable|string|max:20',
                ],
                [
                    'nis.required' => 'NIS wajib diisi',
                    'nis.unique' => 'NIS sudah terdaftar',
                    'nama.required' => 'Nama lengkap siswa wajib diisi',
                    'jenis_kelamin.required' => 'Jenis kelamin wajib diisi',
                    'jenis_kelamin.in' => 'Jenis kelamin harus L atau P',
                    'status.in' => 'Status siswa harus Aktif, Nonaktif, atau Lulus',
                    'tanggal_lahir.date' => 'Tanggal lahir tidak valid',
                    'tanggal_masuk.date' => 'Tanggal masuk tidak valid',
                    'email_siswa.email' => 'Email siswa tidak valid',
                ]
            );
            $validator->after(function ($validator) use (&$payload, &$rowWarnings) {
                try {
                    [$payload, $rowWarnings] = $this->normalizeStudentReferencesForImport($payload);
                } catch (ValidationException $exception) {
                    foreach ($exception->errors() as $field => $messages) {
                        foreach ($messages as $message) {
                            $validator->errors()->add($field, $message);
                        }
                    }
                }
            });

            if ($validator->fails()) {
                $errors[] = [
                    'row' => $rowNumber,
                    'nis' => $payload['nis'] ?? '-',
                    'nama' => $payload['nama'] ?? '-',
                    'alasan' => $validator->errors()->all(),
                ];
                continue;
            }

            try {
                DB::transaction(function () use ($payload, $existingStudent, $academicYearId, $semesterId, $tahunAjaranName, $semesterName, &$imported, &$updated) {
                    $kelasLabel = $payload['kelas'] ?? null;
                    if ($existingStudent) {
                        $updateData = array_filter($payload, fn($val) => $val !== null && $val !== '');
                        $existingStudent->update($updateData);
                        $siswa = $existingStudent;
                        $updated[] = [
                            'id' => $siswa->id,
                            'nis' => $siswa->nis,
                            'nama' => $siswa->nama,
                            'kelas' => $siswa->kelas,
                        ];
                    } else {
                        $siswa = Siswa::create($payload);
                        $imported[] = [
                            'id' => $siswa->id,
                            'nis' => $siswa->nis,
                            'nama' => $siswa->nama,
                            'kelas' => $siswa->kelas,
                        ];
                    }

                    $this->syncKelompokBelajar($siswa, $kelasLabel);
                    $this->syncSantriPondok($siswa);
                    $this->waliAccountService->syncForStudent($siswa);

                    if ($academicYearId) {
                        SiswaTahunAjaran::updateOrCreate(
                            [
                                'siswa_id' => $siswa->id,
                                'academic_year_id' => $academicYearId,
                                'semester_id' => $semesterId,
                            ],
                            [
                                'tahun_ajaran' => $tahunAjaranName,
                                'semester' => $semesterName,
                                'class_id' => $siswa->class_id,
                                'kelas' => $siswa->kelas,
                                'wali_id' => $siswa->wali_id,
                                'student_status_id' => $siswa->student_status_id,
                                'status_santri' => $siswa->status ?? 'Aktif',
                                'is_active' => true,
                                'synced_at' => now(),
                            ]
                        );
                    }
                });

                foreach ($rowWarnings as $warning) {
                    $warnings[] = [
                        'row' => $rowNumber,
                        'nis' => $payload['nis'] ?? '-',
                        'nama' => $payload['nama'] ?? '-',
                        'field' => $warning['field'],
                        'message' => $warning['message'],
                    ];
                }
            } catch (\Throwable $exception) {
                $errors[] = [
                    'row' => $rowNumber,
                    'nis' => $payload['nis'] ?? '-',
                    'nama' => $payload['nama'] ?? '-',
                    'alasan' => [$exception->getMessage()],
                ];
            }
        }

        $totalSuccess = count($imported) + count($updated);

        return response()->json([
            'success' => true,
            'message' => $totalSuccess > 0
                ? "Import data siswa selesai ({$totalSuccess} data diproses: " . count($imported) . " baru, " . count($updated) . " diperbarui)"
                : 'Tidak ada data siswa yang berhasil diimport',
            'total_baris' => count($validated['rows']),
            'berhasil' => count($imported),
            'diperbarui' => count($updated),
            'gagal' => count($errors),
            'errors' => $errors,
            'warnings' => $warnings,
            'data' => array_merge($imported, $updated),
        ]);
    }

    public function show(Siswa $siswa)
    {
        return response()->json([
            'success' => true,
            'data' => $siswa->load(['absensi', 'pembayaran', 'nilai', 'kelompokBelajar', 'boardingRoom.complex']),
        ]);
    }

    public function update(Request $request, Siswa $siswa)
    {
        $validated = $request->validate([
            'nis' => 'sometimes|string|unique:siswa,nis,' . $siswa->id,
            'nisn' => 'nullable|string',
            'nama' => 'sometimes|string',
            'nama_panggilan' => 'nullable|string',
            'tempat_lahir' => 'nullable|string',
            'tanggal_lahir' => 'nullable|date',
            'jenis_kelamin' => 'sometimes|in:L,P',
            'nik' => 'nullable|string|max:16',
            'no_kk' => 'nullable|string|max:16',
            'no_akta' => 'nullable|string',
            'dokumen_akta' => 'nullable|string',
            'nama_wali' => 'nullable|string',
            'no_telepon_wali' => 'nullable|string',
            'kelas' => 'nullable|string',
            'class_id' => 'nullable|integer|exists:classes,id',
            'status' => 'sometimes|in:Aktif,Nonaktif,Lulus',
            'alamat' => 'nullable|string',
            'kewarganegaraan' => 'nullable|string',
            'provinsi' => 'nullable|string',
            'province_code' => 'nullable|string',
            'province_id' => 'nullable|integer|exists:provinces,id',
            'kota' => 'nullable|string',
            'city_code' => 'nullable|string',
            'city_id' => 'nullable|integer|exists:cities,id',
            'kecamatan' => 'nullable|string',
            'district_code' => 'nullable|string',
            'district_id' => 'nullable|integer|exists:districts,id',
            'kelurahan' => 'nullable|string',
            'village_code' => 'nullable|string',
            'village_id' => 'nullable|integer|exists:villages,id',
            'kode_pos' => 'nullable|string|max:5',
            'no_whatsapp' => 'nullable|string|max:20',
            'email_siswa' => 'nullable|string|email',
            'asal_sekolah' => 'nullable|string',
            'sekolah_formal' => 'nullable|string',
            'school_origin_id' => 'nullable|integer|exists:school_origins,id',
            'previous_asal_sekolah' => 'nullable|string',
            'previous_school_origin_id' => 'nullable|integer|exists:school_origins,id',
            'tahun_lulus' => 'nullable|string|max:4',
            'tahun_akademik_masuk' => 'nullable|string',
            'tahun_akademik_masuk_madin' => 'nullable|string',
            'tahun_akademik_masuk_formal' => 'nullable|string',
            'jenis_santri' => 'nullable|string',
            'student_type_id' => 'nullable|integer|exists:student_types,id',
            'anak_ke' => 'nullable|string',
            'jml_saudara' => 'nullable|string',
            'nama_ayah' => 'nullable|string',
            'nik_ayah' => 'nullable|string|max:16',
            'tempat_lahir_ayah' => 'nullable|string',
            'tanggal_lahir_ayah' => 'nullable|date',
            'nama_ibu' => 'nullable|string',
            'nik_ibu' => 'nullable|string|max:16',
            'tempat_lahir_ibu' => 'nullable|string',
            'tanggal_lahir_ibu' => 'nullable|date',
            'pendidikan_ayah' => 'nullable|string',
            'father_education_id' => 'nullable|integer|exists:education_levels,id',
            'pendidikan_ibu' => 'nullable|string',
            'mother_education_id' => 'nullable|integer|exists:education_levels,id',
            'pekerjaan_ayah' => 'nullable|string',
            'father_occupation_id' => 'nullable|integer|exists:occupations,id',
            'penghasilan_ayah' => 'nullable|string',
            'father_income_id' => 'nullable|integer|exists:income_ranges,id',
            'pekerjaan_ibu' => 'nullable|string',
            'mother_occupation_id' => 'nullable|integer|exists:occupations,id',
            'penghasilan_ibu' => 'nullable|string',
            'mother_income_id' => 'nullable|integer|exists:income_ranges,id',
            'alamat_ayah' => 'nullable|string',
            'alamat_ibu' => 'nullable|string',
            'alamat_lengkap_ayah' => 'nullable|string',
            'alamat_lengkap_ibu' => 'nullable|string',
            'no_ayah' => 'nullable|string',
            'no_whatsapp_ayah' => 'nullable|string|max:20',
            'no_ibu' => 'nullable|string',
            'no_whatsapp_ibu' => 'nullable|string|max:20',
            'nama_wali_keluarga' => 'nullable|string',
            'pekerjaan_wali_keluarga' => 'nullable|string',
            'guardian_occupation_id' => 'nullable|integer|exists:occupations,id',
            'alamat_wali_keluarga' => 'nullable|string',
            'wali_sama_dengan' => 'nullable|string',
            'guardian_relationship_id' => 'nullable|integer|exists:guardian_relationships,id',
            'tanggal_masuk' => 'nullable|date',
            'tempat_tinggal' => 'nullable|string',
            'residence_type_id' => 'nullable|integer|exists:residence_types,id',
            'transportasi' => 'nullable|string',
            'transport_mode_id' => 'nullable|integer|exists:transport_modes,id',
            'status_mondok' => 'nullable|in:mondok,tidak_mondok',
            'boarding_room_id' => 'nullable|integer|exists:boarding_rooms,id',
            'komplek' => 'nullable|string',
            'kamar' => 'nullable|string',
            'tanggal_diterima_pondok' => 'nullable|date',
            'tanggal_diterima_sekolah' => 'nullable|date',
            'tinggi_badan' => 'nullable|string',
            'berat_badan' => 'nullable|string',
            'golongan_darah' => 'nullable|string',
            'blood_type_id' => 'nullable|integer|exists:blood_types,id',
            'foto_santri' => 'nullable|string',
            'catatan_santri' => 'nullable|string',
        ]);
        $validated = $this->normalizeBoardingFields($validated);
        $validated = $this->mirrorGuardianFromParent($validated);
        $validated = $this->normalizeStudentReferences($validated);

        $before = $siswa->toArray();
        $siswa = DB::transaction(function () use ($validated, $siswa) {
            $siswa->update($validated);
            $this->syncKelompokBelajar($siswa, $validated['kelas'] ?? $siswa->kelas);
            $this->syncSantriPondok($siswa);
            $this->waliAccountService->syncForStudent($siswa);

            return $siswa->fresh();
        });
        app(AuditLogService::class)->record($request, 'siswa', 'update', $siswa, $before, $siswa->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil diupdate',
            'data' => $siswa->load('wali:id,name,email,no_hp,status'),
        ]);
    }

    public function destroy(Request $request, Siswa $siswa)
    {
        $before = $siswa->toArray();
        $siswa->delete();
        app(AuditLogService::class)->record($request, 'siswa', 'delete', $siswa, $before, null);

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil dihapus',
        ]);
    }

    public function bulkStatus(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:siswa,id',
            'status' => 'required|in:Aktif,Nonaktif,Lulus',
            'tahun_lulus' => 'nullable|string|max:4',
        ]);

        $ids = array_values(array_unique(array_map('intval', $validated['ids'])));
        $status = $validated['status'];
        $tahunLulus = $this->cleanString($validated['tahun_lulus'] ?? null);

        DB::transaction(function () use ($ids, $status, $tahunLulus) {
            $siswaList = Siswa::query()->whereIn('id', $ids)->get();
            $studentStatusId = app(ReferenceResolver::class)->studentStatusId($status);

            foreach ($siswaList as $siswa) {
                $payload = [
                    'status' => $status,
                    'student_status_id' => $studentStatusId,
                ];

                if ($status === 'Lulus' && $tahunLulus !== null) {
                    $payload['tahun_lulus'] = $tahunLulus;
                } elseif ($status !== 'Lulus') {
                    $payload['tahun_lulus'] = null;
                }

                $siswa->update($payload);
                $this->waliAccountService->syncForStudent($siswa);
            }
        });

        $updated = Siswa::query()
            ->whereIn('id', $ids)
            ->orderBy('nama')
            ->get();

        return response()->json([
            'success' => true,
            'message' => count($ids) . ' siswa berhasil diubah ke status ' . $status,
            'updated_count' => count($ids),
            'data' => $updated,
        ]);
    }

    public function restoreAlumni(Request $request, Siswa $siswa)
    {
        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');
        $siswa->update([
            'status' => 'Aktif',
            'student_status_id' => $activeStatusId,
            'tahun_lulus' => null,
        ]);
        $this->waliAccountService->syncForStudent($siswa);

        return response()->json([
            'success' => true,
            'message' => "Santri {$siswa->nama} berhasil dipulihkan menjadi Santri Aktif.",
            'data' => $siswa->fresh(),
        ]);
    }

    // Upload dokumen akta atau foto santri (Shielded against RCE / webshell upload)
    public function uploadFile(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:5120', // max 5MB, strict whitelisted extensions
            'type' => 'required|in:dokumen_akta,foto_santri,foto_profil',
        ]);

        $file = $request->file('file');
        $type = $request->type;
        $folder = $type === 'foto_profil' ? 'profil' : ($type === 'foto_santri' ? 'foto_santri' : 'dokumen');
        $path = $file->store($folder, 'public');

        return response()->json([
            'success' => true,
            'path' => $path,
            'url' => asset('storage/' . $path),
        ]);
    }

    private function prepareImportPayload(array $row): array
    {
        $kelasLabel = $this->cleanString(
            $row['kelompok_belajar'] ?? $row['kelas'] ?? $row['kelas_sifir'] ?? $row['sifir'] ?? null
        );
        $namaWali = $this->cleanString(
            $row['nama_wali']
            ?? $row['nama_wali_orang_tua']
            ?? $row['nama_wali_keluarga']
            ?? null
        );

        $tahunLulus = $this->cleanString($row['tahun_lulus'] ?? null);
        if ($tahunLulus && strlen($tahunLulus) > 4) {
            $tahunLulus = substr($tahunLulus, 0, 4);
        }

        $nik = $this->cleanString($row['nik'] ?? null);
        if ($nik && strlen($nik) > 16) {
            $nik = substr($nik, 0, 16);
        }
        $noKk = $this->cleanString($row['no_kk'] ?? $row['kk'] ?? null);
        if ($noKk && strlen($noKk) > 16) {
            $noKk = substr($noKk, 0, 16);
        }
        $nikAyah = $this->cleanString($row['nik_ayah'] ?? null);
        if ($nikAyah && strlen($nikAyah) > 16) {
            $nikAyah = substr($nikAyah, 0, 16);
        }
        $nikIbu = $this->cleanString($row['nik_ibu'] ?? null);
        if ($nikIbu && strlen($nikIbu) > 16) {
            $nikIbu = substr($nikIbu, 0, 16);
        }

        return [
            'nis' => $this->cleanString($row['nis'] ?? null),
            'nisn' => $this->cleanString($row['nisn'] ?? null),
            'nik' => $nik,
            'no_kk' => $noKk,
            'nama' => $this->cleanString(
                $row['nama'] ?? $row['nama_lengkap_siswa'] ?? $row['nama_santri'] ?? null
            ),
            'jenis_kelamin' => $this->normalizeGender(
                $row['jenis_kelamin'] ?? $row['jk'] ?? null
            ),
            'nama_wali' => $namaWali,
            'nama_wali_keluarga' => $namaWali,
            'no_telepon_wali' => $this->cleanString(
                $row['no_telepon_wali']
                ?? $row['no_hp_whatsapp']
                ?? $row['no_whatsapp']
                ?? $row['no_hp']
                ?? $row['no_telp']
                ?? null
            ),
            'status' => $this->normalizeStatus(
                $row['status'] ?? $row['status_siswa'] ?? $row['status_santri'] ?? null
            ),
            'kelas' => $kelasLabel,
            'tempat_lahir' => $this->cleanString($row['tempat_lahir'] ?? null),
            'tanggal_lahir' => $this->normalizeDate($row['tanggal_lahir'] ?? null),
            'alamat' => $this->cleanString(
                $row['alamat'] ?? $row['alamat_lengkap'] ?? null
            ),
            'alamat_lengkap_ayah' => $this->cleanString(
                $row['alamat_lengkap_ayah'] ?? $row['alamat_ayah'] ?? null
            ),
            'alamat_lengkap_ibu' => $this->cleanString(
                $row['alamat_lengkap_ibu'] ?? $row['alamat_ibu'] ?? null
            ),
            'kewarganegaraan' => $this->cleanString(
                $row['kewarganegaraan'] ?? 'Indonesia'
            ),
            'provinsi' => $this->cleanString($row['provinsi'] ?? null),
            'kota' => $this->cleanString($row['kota'] ?? $row['kabupaten'] ?? $row['kab_kota'] ?? null),
            'kecamatan' => $this->cleanString($row['kecamatan'] ?? null),
            'kelurahan' => $this->cleanString($row['kelurahan'] ?? $row['desa'] ?? null),
            'kode_pos' => $this->cleanString($row['kode_pos'] ?? null),
            'no_whatsapp' => $this->cleanString(
                $row['no_whatsapp'] ?? $row['no_hp_whatsapp'] ?? $row['no_hp'] ?? $row['no_telp'] ?? null
            ),
            'email_siswa' => $this->cleanString(
                $row['email_siswa'] ?? $row['email'] ?? null
            ),
            'nama_ayah' => $this->cleanString($row['nama_ayah'] ?? null),
            'nik_ayah' => $nikAyah,
            'nama_ibu' => $this->cleanString($row['nama_ibu'] ?? null),
            'nik_ibu' => $nikIbu,
            'no_ayah' => $this->cleanString($row['no_ayah'] ?? $row['no_whatsapp_ayah'] ?? null),
            'no_ibu' => $this->cleanString($row['no_ibu'] ?? $row['no_whatsapp_ibu'] ?? null),
            'catatan_santri' => $this->cleanString(
                $row['catatan_santri'] ?? $row['catatan_lain'] ?? null
            ),
            'asal_sekolah' => $this->cleanString($row['asal_sekolah'] ?? null),
            'tahun_lulus' => $tahunLulus,
            'anak_ke' => $this->cleanString($row['anak_ke'] ?? null),
            'jml_saudara' => $this->cleanString($row['jml_saudara'] ?? $row['jumlah_saudara'] ?? null),
            'tinggi_badan' => $this->cleanString($row['tinggi_badan'] ?? null),
            'berat_badan' => $this->cleanString($row['berat_badan'] ?? null),
            'sekolah_formal' => $this->cleanString($row['sekolah_formal'] ?? null),
            'school_origin_id' => $this->cleanInt($row['school_origin_id'] ?? null),
            'previous_asal_sekolah' => $this->cleanString($row['previous_asal_sekolah'] ?? $row['sekolah_asal_sebelumnya'] ?? null),
            'previous_school_origin_id' => $this->cleanInt($row['previous_school_origin_id'] ?? null),
            'tahun_akademik_masuk' => $this->cleanString(
                $row['tahun_akademik_masuk'] ?? $row['tahun_akademik_masuk_madin'] ?? null
            ),
            'tahun_akademik_masuk_formal' => $this->cleanString(
                $row['tahun_akademik_masuk_formal'] ?? null
            ),
            'jenis_santri' => $this->cleanString($row['jenis_santri'] ?? null),
            'tanggal_masuk' => $this->normalizeDate($row['tanggal_masuk'] ?? null),
            'status_mondok' => $this->normalizeBoardingStatus(
                $row['status_mondok'] ?? $row['mondok'] ?? (!empty($row['kamar']) || !empty($row['komplek']) ? 'mondok' : null)
            ),
            'boarding_room_id' => $this->cleanInt($row['boarding_room_id'] ?? null),
            'komplek' => $this->cleanString($row['komplek'] ?? $row['complex'] ?? null),
            'kamar' => $this->cleanString($row['kamar'] ?? $row['room'] ?? null),
            'tanggal_diterima_pondok' => $this->normalizeDate($row['tanggal_diterima_pondok'] ?? null),
            'tanggal_diterima_sekolah' => $this->normalizeDate(
                $row['tanggal_diterima_sekolah'] ?? $row['tanggal_diterima_akademik'] ?? null
            ),
            'pendidikan_ayah' => $this->cleanString($row['pendidikan_ayah'] ?? null),
            'pendidikan_ibu' => $this->cleanString($row['pendidikan_ibu'] ?? null),
            'pekerjaan_ayah' => $this->cleanString($row['pekerjaan_ayah'] ?? null),
            'pekerjaan_ibu' => $this->cleanString($row['pekerjaan_ibu'] ?? null),
            'pekerjaan_wali_keluarga' => $this->cleanString($row['pekerjaan_wali'] ?? $row['pekerjaan_wali_keluarga'] ?? null),
            'penghasilan_ayah' => $this->cleanString($row['penghasilan_ayah'] ?? null),
            'penghasilan_ibu' => $this->cleanString($row['penghasilan_ibu'] ?? null),
            'wali_sama_dengan' => $this->cleanString($row['wali_sama_dengan'] ?? null),
            'tempat_tinggal' => $this->cleanString($row['tempat_tinggal'] ?? null),
            'transportasi' => $this->cleanString($row['transportasi'] ?? null),
            'golongan_darah' => $this->cleanString($row['golongan_darah'] ?? null),
        ];

        $payload = $this->normalizeBoardingFields($payload);
        $payload = $this->mirrorGuardianFromParent($payload);

        return $payload;
    }

    private function syncKelompokBelajar(Siswa $siswa, ?string $kelasLabel): void
    {
        if (!$kelasLabel) {
            return;
        }

        $classId = app(ReferenceResolver::class)->classId($kelasLabel, false);
        $kelompok = KelompokBelajar::query()
            ->when($classId, fn ($query) => $query->where('class_id', $classId))
            ->when(!$classId, function ($query) use ($kelasLabel) {
                $query->where('nama', 'ilike', $kelasLabel)
                    ->orWhere('sifir', 'ilike', $kelasLabel);
            })
            ->first();

        if ($kelompok) {
            $siswa->kelompokBelajar()->syncWithoutDetaching([$kelompok->id]);
            if ($siswa->kelas !== $kelompok->nama) {
                $siswa->update(['kelas' => $kelompok->nama]);
            }
        }
    }

    private function syncSantriPondok(Siswa $siswa): void
    {
        if ($siswa->status_mondok === 'mondok' && $siswa->boarding_room_id) {
            $room = BoardingRoom::find($siswa->boarding_room_id);
            if ($room) {
                SantriPondok::updateOrCreate(
                    ['siswa_id' => $siswa->id],
                    [
                        'boarding_complex_id' => $room->boarding_complex_id,
                        'boarding_room_id' => $room->id,
                        'status' => $siswa->status ?? 'Aktif',
                        'is_resident' => true,
                        'participates_prayer' => true,
                        'started_at' => now(),
                    ]
                );
            }
        } elseif ($siswa->status_mondok === 'tidak_mondok') {
            SantriPondok::where('siswa_id', $siswa->id)->delete();
        }
    }

    private function normalizeStatus(mixed $value): string
    {
        $raw = strtolower(trim((string) $value));
        if (in_array($raw, ['lulus', 'alumni', 'graduated'], true)) {
            return 'Lulus';
        }

        return $raw === 'nonaktif' ? 'Nonaktif' : 'Aktif';
    }

    private function normalizeClassReference(array $payload, bool $throw = true): array
    {
        $classId = $payload['class_id'] ?? null;
        $kelas = $payload['kelas'] ?? null;

        if ($classId) {
            $className = app(ReferenceResolver::class)->className($classId);
            if ($className && empty($payload['kelas'])) {
                $payload['kelas'] = $className;
            }
            return $payload;
        }

        if ($kelas) {
            $resolvedClassId = app(ReferenceResolver::class)->classId($kelas, false);
            if ($resolvedClassId) {
                $payload['class_id'] = $resolvedClassId;
            }
        }

        return $payload;
    }

    private function normalizeStudentReferences(array $payload, bool $throw = true): array
    {
        $payload = $this->normalizeClassReference($payload, $throw);

        $resolver = app(ReferenceResolver::class);

        if (array_key_exists('status', $payload) || array_key_exists('student_status_id', $payload)) {
            $payload['student_status_id'] = $payload['student_status_id'] ?? $resolver->studentStatusId($payload['status'] ?? null);
        }
        if (array_key_exists('jenis_santri', $payload) || array_key_exists('student_type_id', $payload)) {
            $payload['student_type_id'] = $payload['student_type_id'] ?? $resolver->studentTypeId($payload['jenis_santri'] ?? null);
            $this->rejectUnresolvedReference($payload, 'jenis_santri', 'student_type_id', 'Jenis santri tidak ditemukan di master jenis santri.');
        }
        if (array_key_exists('asal_sekolah', $payload) || array_key_exists('school_origin_id', $payload)) {
            $payload['school_origin_id'] = $payload['school_origin_id'] ?? $resolver->schoolOriginId($payload['asal_sekolah'] ?? null);
            $this->rejectUnresolvedReference($payload, 'asal_sekolah', 'school_origin_id', 'Sekolah asal tidak ditemukan di master sekolah asal.');
        }
        if (array_key_exists('previous_asal_sekolah', $payload) || array_key_exists('previous_school_origin_id', $payload)) {
            $payload['previous_school_origin_id'] = $payload['previous_school_origin_id']
                ?? $resolver->schoolOriginId($payload['previous_asal_sekolah'] ?? null);
            $this->rejectUnresolvedReference($payload, 'previous_asal_sekolah', 'previous_school_origin_id', 'Sekolah asal sebelumnya tidak ditemukan di master sekolah asal.');
        }
        if (array_key_exists('provinsi', $payload) || array_key_exists('province_id', $payload) || array_key_exists('province_code', $payload)) {
            $payload['province_id'] = $payload['province_id'] ?? $resolver->provinceId($payload['provinsi'] ?? null, $payload['province_code'] ?? null);
            $this->rejectUnresolvedReference($payload, 'provinsi', 'province_id', 'Provinsi tidak ditemukan di master wilayah.');
        }
        if (array_key_exists('kota', $payload) || array_key_exists('city_id', $payload) || array_key_exists('city_code', $payload)) {
            $payload['city_id'] = $payload['city_id'] ?? $resolver->cityId($payload['kota'] ?? null, $payload['province_id'] ?? null, $payload['city_code'] ?? null);
            $this->rejectUnresolvedReference($payload, 'kota', 'city_id', 'Kota/kabupaten tidak ditemukan di master wilayah.');
        }
        if (array_key_exists('kecamatan', $payload) || array_key_exists('district_id', $payload) || array_key_exists('district_code', $payload)) {
            $payload['district_id'] = $payload['district_id'] ?? $resolver->districtId($payload['kecamatan'] ?? null, $payload['city_id'] ?? null, $payload['district_code'] ?? null);
            $this->rejectUnresolvedReference($payload, 'kecamatan', 'district_id', 'Kecamatan tidak ditemukan di master wilayah.');
        }
        if (array_key_exists('kelurahan', $payload) || array_key_exists('village_id', $payload) || array_key_exists('village_code', $payload)) {
            $payload['village_id'] = $payload['village_id'] ?? $resolver->villageId($payload['kelurahan'] ?? null, $payload['district_id'] ?? null, $payload['village_code'] ?? null);
            $this->rejectUnresolvedReference($payload, 'kelurahan', 'village_id', 'Desa/kelurahan tidak ditemukan di master wilayah.');
        }

        if (array_key_exists('pendidikan_ayah', $payload) || array_key_exists('father_education_id', $payload)) {
            $payload['father_education_id'] = $payload['father_education_id'] ?? $resolver->educationLevelId($payload['pendidikan_ayah'] ?? null);
            $this->rejectUnresolvedReference($payload, 'pendidikan_ayah', 'father_education_id', 'Pendidikan ayah tidak ditemukan di master pendidikan.');
        }
        if (array_key_exists('pendidikan_ibu', $payload) || array_key_exists('mother_education_id', $payload)) {
            $payload['mother_education_id'] = $payload['mother_education_id'] ?? $resolver->educationLevelId($payload['pendidikan_ibu'] ?? null);
            $this->rejectUnresolvedReference($payload, 'pendidikan_ibu', 'mother_education_id', 'Pendidikan ibu tidak ditemukan di master pendidikan.');
        }
        if (array_key_exists('pekerjaan_ayah', $payload) || array_key_exists('father_occupation_id', $payload)) {
            $payload['father_occupation_id'] = $payload['father_occupation_id'] ?? $resolver->occupationId($payload['pekerjaan_ayah'] ?? null);
            $this->rejectUnresolvedReference($payload, 'pekerjaan_ayah', 'father_occupation_id', 'Pekerjaan ayah tidak ditemukan di master pekerjaan.');
        }
        if (array_key_exists('pekerjaan_ibu', $payload) || array_key_exists('mother_occupation_id', $payload)) {
            $payload['mother_occupation_id'] = $payload['mother_occupation_id'] ?? $resolver->occupationId($payload['pekerjaan_ibu'] ?? null);
            $this->rejectUnresolvedReference($payload, 'pekerjaan_ibu', 'mother_occupation_id', 'Pekerjaan ibu tidak ditemukan di master pekerjaan.');
        }
        if (array_key_exists('pekerjaan_wali_keluarga', $payload) || array_key_exists('guardian_occupation_id', $payload)) {
            $payload['guardian_occupation_id'] = $payload['guardian_occupation_id'] ?? $resolver->occupationId($payload['pekerjaan_wali_keluarga'] ?? null);
            $this->rejectUnresolvedReference($payload, 'pekerjaan_wali_keluarga', 'guardian_occupation_id', 'Pekerjaan wali tidak ditemukan di master pekerjaan.');
        }
        if (array_key_exists('penghasilan_ayah', $payload) || array_key_exists('father_income_id', $payload)) {
            $payload['father_income_id'] = $payload['father_income_id'] ?? $resolver->incomeRangeId($payload['penghasilan_ayah'] ?? null);
            $this->rejectUnresolvedReference($payload, 'penghasilan_ayah', 'father_income_id', 'Penghasilan ayah tidak ditemukan di master penghasilan.');
        }
        if (array_key_exists('penghasilan_ibu', $payload) || array_key_exists('mother_income_id', $payload)) {
            $payload['mother_income_id'] = $payload['mother_income_id'] ?? $resolver->incomeRangeId($payload['penghasilan_ibu'] ?? null);
            $this->rejectUnresolvedReference($payload, 'penghasilan_ibu', 'mother_income_id', 'Penghasilan ibu tidak ditemukan di master penghasilan.');
        }
        if (array_key_exists('wali_sama_dengan', $payload) || array_key_exists('guardian_relationship_id', $payload)) {
            $payload['guardian_relationship_id'] = $payload['guardian_relationship_id'] ?? $resolver->guardianRelationshipId($payload['wali_sama_dengan'] ?? null);
            $this->rejectUnresolvedReference($payload, 'wali_sama_dengan', 'guardian_relationship_id', 'Hubungan wali tidak ditemukan di master hubungan wali.');
        }
        if (array_key_exists('tempat_tinggal', $payload) || array_key_exists('residence_type_id', $payload)) {
            $payload['residence_type_id'] = $payload['residence_type_id'] ?? $resolver->residenceTypeId($payload['tempat_tinggal'] ?? null);
            $this->rejectUnresolvedReference($payload, 'tempat_tinggal', 'residence_type_id', 'Tempat tinggal tidak ditemukan di master tempat tinggal.');
        }
        if (array_key_exists('transportasi', $payload) || array_key_exists('transport_mode_id', $payload)) {
            $payload['transport_mode_id'] = $payload['transport_mode_id'] ?? $resolver->transportModeId($payload['transportasi'] ?? null);
            $this->rejectUnresolvedReference($payload, 'transportasi', 'transport_mode_id', 'Transportasi tidak ditemukan di master transportasi.');
        }
        if (array_key_exists('golongan_darah', $payload) || array_key_exists('blood_type_id', $payload)) {
            $payload['blood_type_id'] = $payload['blood_type_id'] ?? $resolver->bloodTypeId($payload['golongan_darah'] ?? null);
            $this->rejectUnresolvedReference($payload, 'golongan_darah', 'blood_type_id', 'Golongan darah tidak ditemukan di master golongan darah.');
        }

        if (!empty($payload['class_id']) || array_key_exists('kelas', $payload)) {
            $payload['kelas'] = $resolver->className($payload['class_id'] ?? null) ?? ($payload['kelas'] ?? null);
        }
        if (!empty($payload['student_status_id']) || array_key_exists('status', $payload)) {
            $payload['status'] = $resolver->studentStatusName($payload['student_status_id'] ?? null) ?? ($payload['status'] ?? 'Aktif');
        }
        if (!empty($payload['school_origin_id']) || array_key_exists('asal_sekolah', $payload)) {
            $payload['asal_sekolah'] = $resolver->schoolOriginName($payload['school_origin_id'] ?? null) ?? ($payload['asal_sekolah'] ?? null);
        }
        if (!empty($payload['previous_school_origin_id']) || array_key_exists('previous_asal_sekolah', $payload)) {
            $payload['previous_asal_sekolah'] = $resolver->schoolOriginName($payload['previous_school_origin_id'] ?? null)
                ?? ($payload['previous_asal_sekolah'] ?? null);
        }
        if (!empty($payload['province_id']) || array_key_exists('provinsi', $payload)) {
            $payload['provinsi'] = $resolver->nameById('provinces', $payload['province_id'] ?? null) ?? ($payload['provinsi'] ?? null);
        }
        if (!empty($payload['city_id']) || array_key_exists('kota', $payload)) {
            $payload['kota'] = $resolver->nameById('cities', $payload['city_id'] ?? null) ?? ($payload['kota'] ?? null);
        }
        if (!empty($payload['district_id']) || array_key_exists('kecamatan', $payload)) {
            $payload['kecamatan'] = $resolver->nameById('districts', $payload['district_id'] ?? null) ?? ($payload['kecamatan'] ?? null);
        }
        if (!empty($payload['village_id']) || array_key_exists('kelurahan', $payload)) {
            $payload['kelurahan'] = $resolver->nameById('villages', $payload['village_id'] ?? null) ?? ($payload['kelurahan'] ?? null);
        }

        return $payload;
    }

    private function mirrorGuardianFromParent(array $payload): array
    {
        if (!empty($payload['alamat_lengkap_ayah'])) {
            $payload['alamat_ayah'] = $payload['alamat_ayah'] ?? $payload['alamat_lengkap_ayah'];
        }
        if (!empty($payload['alamat_lengkap_ibu'])) {
            $payload['alamat_ibu'] = $payload['alamat_ibu'] ?? $payload['alamat_lengkap_ibu'];
        }

        $relationship = strtolower(trim((string) ($payload['wali_sama_dengan'] ?? '')));
        if ($relationship === 'ayah') {
            $payload['nama_wali_keluarga'] = $payload['nama_ayah'] ?? $payload['nama_wali_keluarga'] ?? null;
            $payload['pekerjaan_wali_keluarga'] = $payload['pekerjaan_ayah'] ?? $payload['pekerjaan_wali_keluarga'] ?? null;
            $payload['guardian_occupation_id'] = $payload['father_occupation_id'] ?? $payload['guardian_occupation_id'] ?? null;
            $payload['alamat_wali_keluarga'] = $payload['alamat_ayah'] ?? $payload['alamat'] ?? $payload['alamat_wali_keluarga'] ?? null;
            $payload['no_telepon_wali'] = $payload['no_whatsapp_ayah'] ?? $payload['no_ayah'] ?? $payload['no_telepon_wali'] ?? null;
        } elseif ($relationship === 'ibu') {
            $payload['nama_wali_keluarga'] = $payload['nama_ibu'] ?? $payload['nama_wali_keluarga'] ?? null;
            $payload['pekerjaan_wali_keluarga'] = $payload['pekerjaan_ibu'] ?? $payload['pekerjaan_wali_keluarga'] ?? null;
            $payload['guardian_occupation_id'] = $payload['mother_occupation_id'] ?? $payload['guardian_occupation_id'] ?? null;
            $payload['alamat_wali_keluarga'] = $payload['alamat_ibu'] ?? $payload['alamat'] ?? $payload['alamat_wali_keluarga'] ?? null;
            $payload['no_telepon_wali'] = $payload['no_whatsapp_ibu'] ?? $payload['no_ibu'] ?? $payload['no_telepon_wali'] ?? null;
        }

        return $payload;
    }

    private function normalizeBoardingFields(array $payload): array
    {
        if (!empty($payload['boarding_room_id'])) {
            $room = BoardingRoom::query()
                ->with('complex:id,name')
                ->find($payload['boarding_room_id']);
            if ($room) {
                $payload['kamar'] = $room->name;
                $payload['komplek'] = $room->complex?->name;
                $payload['status_mondok'] = 'mondok';
            }
        } elseif (!empty($payload['komplek']) && !empty($payload['kamar'])) {
            $room = BoardingRoom::query()
                ->where('name', 'ilike', $payload['kamar'])
                ->whereHas('complex', fn ($query) => $query->where('name', 'ilike', $payload['komplek']))
                ->first();
            if ($room) {
                $payload['boarding_room_id'] = $room->id;
                $payload['status_mondok'] = 'mondok';
            }
        }

        if (array_key_exists('status_mondok', $payload)) {
            $payload['status_mondok'] = $this->normalizeBoardingStatus($payload['status_mondok']);
            if ($payload['status_mondok'] === 'tidak_mondok') {
                $payload['tanggal_diterima_pondok'] = null;
                $payload['boarding_room_id'] = null;
                $payload['komplek'] = null;
                $payload['kamar'] = null;
            }
        }

        return $payload;
    }

    private function normalizeBoardingStatus(mixed $value): ?string
    {
        $raw = strtolower(trim((string) $value));
        if ($raw === '') {
            return null;
        }
        if (str_contains($raw, 'tidak') || in_array($raw, ['non', 'no', 'false', '0'], true)) {
            return 'tidak_mondok';
        }
        if (str_contains($raw, 'mondok') || str_contains($raw, 'pondok') || in_array($raw, ['ya', 'yes', 'true', '1'], true)) {
            return 'mondok';
        }

        return null;
    }

    private function normalizeStudentReferencesForImport(array $payload): array
    {
        $warnings = [];
        $resolver = app(ReferenceResolver::class);

        if (!empty($payload['kelas']) && empty($payload['class_id'])) {
            $classId = $resolver->classId($payload['kelas'], false);
            if ($classId) {
                $payload['class_id'] = $classId;
                $payload['kelas'] = $resolver->className($classId) ?? $payload['kelas'];
            } else {
                $warnings[] = $this->importWarning('kelas', 'Kelas tidak ditemukan di master; field dikosongkan.');
                $payload['kelas'] = null;
                $payload['class_id'] = null;
            }
        }

        if (array_key_exists('status', $payload) || array_key_exists('student_status_id', $payload)) {
            $payload['student_status_id'] = $payload['student_status_id'] ?? $resolver->studentStatusId($payload['status'] ?? null);
            $payload['status'] = $resolver->studentStatusName($payload['student_status_id'] ?? null) ?? ($payload['status'] ?? 'Aktif');
        }

        [$payload, $warnings] = $this->resolveImportReference(
            $payload,
            $warnings,
            'jenis_santri',
            'student_type_id',
            fn ($value) => $resolver->studentTypeId($value),
            'student_types',
            'Jenis santri tidak ditemukan di master; field dikosongkan.'
        );

        [$payload, $warnings] = $this->resolveImportReference(
            $payload,
            $warnings,
            'asal_sekolah',
            'school_origin_id',
            fn ($value) => $resolver->schoolOriginId($value),
            'school_origins',
            'Sekolah asal tidak ditemukan di master; field dikosongkan.'
        );

        [$payload, $warnings] = $this->resolveImportReference(
            $payload,
            $warnings,
            'previous_asal_sekolah',
            'previous_school_origin_id',
            fn ($value) => $resolver->schoolOriginId($value),
            'school_origins',
            'Sekolah asal sebelumnya tidak ditemukan di master; field dikosongkan.'
        );

        [$payload, $warnings] = $this->resolveImportReference(
            $payload,
            $warnings,
            'provinsi',
            'province_id',
            fn ($value) => $resolver->provinceId($value, $payload['province_code'] ?? null),
            'provinces',
            'Provinsi tidak ditemukan di master wilayah; field dikosongkan.'
        );
        [$payload, $warnings] = $this->resolveImportReference(
            $payload,
            $warnings,
            'kota',
            'city_id',
            fn ($value) => $resolver->cityId($value, $payload['province_id'] ?? null, $payload['city_code'] ?? null),
            'cities',
            'Kota/kabupaten tidak ditemukan di master wilayah; field dikosongkan.'
        );
        [$payload, $warnings] = $this->resolveImportReference(
            $payload,
            $warnings,
            'kecamatan',
            'district_id',
            fn ($value) => $resolver->districtId($value, $payload['city_id'] ?? null, $payload['district_code'] ?? null),
            'districts',
            'Kecamatan tidak ditemukan di master wilayah; field dikosongkan.'
        );
        [$payload, $warnings] = $this->resolveImportReference(
            $payload,
            $warnings,
            'kelurahan',
            'village_id',
            fn ($value) => $resolver->villageId($value, $payload['district_id'] ?? null, $payload['village_code'] ?? null),
            'villages',
            'Desa/kelurahan tidak ditemukan di master wilayah; field dikosongkan.'
        );

        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'pendidikan_ayah', 'father_education_id', fn ($value) => $resolver->educationLevelId($value), 'education_levels', 'Pendidikan ayah tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'pendidikan_ibu', 'mother_education_id', fn ($value) => $resolver->educationLevelId($value), 'education_levels', 'Pendidikan ibu tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'pekerjaan_ayah', 'father_occupation_id', fn ($value) => $resolver->occupationId($value), 'occupations', 'Pekerjaan ayah tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'pekerjaan_ibu', 'mother_occupation_id', fn ($value) => $resolver->occupationId($value), 'occupations', 'Pekerjaan ibu tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'pekerjaan_wali_keluarga', 'guardian_occupation_id', fn ($value) => $resolver->occupationId($value), 'occupations', 'Pekerjaan wali tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'penghasilan_ayah', 'father_income_id', fn ($value) => $resolver->incomeRangeId($value), 'income_ranges', 'Penghasilan ayah tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'penghasilan_ibu', 'mother_income_id', fn ($value) => $resolver->incomeRangeId($value), 'income_ranges', 'Penghasilan ibu tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'wali_sama_dengan', 'guardian_relationship_id', fn ($value) => $resolver->guardianRelationshipId($value), 'guardian_relationships', 'Hubungan wali tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'tempat_tinggal', 'residence_type_id', fn ($value) => $resolver->residenceTypeId($value), 'residence_types', 'Tempat tinggal tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'transportasi', 'transport_mode_id', fn ($value) => $resolver->transportModeId($value), 'transport_modes', 'Transportasi tidak ditemukan di master; field dikosongkan.');
        [$payload, $warnings] = $this->resolveImportReference($payload, $warnings, 'golongan_darah', 'blood_type_id', fn ($value) => $resolver->bloodTypeId($value), 'blood_types', 'Golongan darah tidak ditemukan di master; field dikosongkan.');

        return [$payload, $warnings];
    }

    private function resolveImportReference(
        array $payload,
        array $warnings,
        string $labelField,
        string $idField,
        callable $resolver,
        string $table,
        string $message
    ): array {
        if (!array_key_exists($labelField, $payload) && !array_key_exists($idField, $payload)) {
            return [$payload, $warnings];
        }

        $label = trim((string) ($payload[$labelField] ?? ''));
        $id = $payload[$idField] ?? null;

        if (!$id && $label !== '') {
            $id = $resolver($label);
        }

        if ($id) {
            $payload[$idField] = $id;
            $payload[$labelField] = app(ReferenceResolver::class)->nameById($table, (int) $id) ?? $label;
            return [$payload, $warnings];
        }

        if ($label !== '') {
            $warnings[] = $this->importWarning($labelField, $message);
            $payload[$labelField] = null;
            $payload[$idField] = null;
        }

        return [$payload, $warnings];
    }

    private function importWarning(string $field, string $message): array
    {
        return [
            'field' => $field,
            'message' => $message,
        ];
    }

    private function rejectUnresolvedReference(array $payload, string $labelField, string $idField, string $message): void
    {
        // Allow flexible free-text input for schools, occupations, educations, etc.
        // If the value doesn't match a master reference ID, the text value is safely stored in the database.
        return;
    }

    private function normalizeGender(mixed $value): string
    {
        $raw = strtoupper(trim((string) $value));
        if (in_array($raw, ['P', 'PEREMPUAN'], true)) {
            return 'P';
        }

        if (in_array($raw, ['L', 'LAKI-LAKI', 'LAKI LAKI'], true)) {
            return 'L';
        }

        return '';
    }

    private function normalizeDate(mixed $value): ?string
    {
        $raw = trim((string) $value);
        if ($raw === '' || $raw === '-') {
            return null;
        }

        $raw = str_replace('/', '-', $raw);
        if (preg_match('/^\d{2}-\d{2}-\d{4}$/', $raw)) {
            [$day, $month, $year] = explode('-', $raw);
            return sprintf('%s-%s-%s', $year, $month, $day);
        }

        return $raw;
    }

    private function cleanString(mixed $value): ?string
    {
        $clean = trim((string) $value);
        return $clean === '' ? null : $clean;
    }

    private function cleanInt(mixed $value): ?int
    {
        $id = (int) trim((string) $value);
        return $id > 0 ? $id : null;
    }
}
