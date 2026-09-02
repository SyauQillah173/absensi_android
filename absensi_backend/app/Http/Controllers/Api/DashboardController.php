<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Absensi;
use App\Models\AbsensiNgaji;
use App\Models\AbsensiSholat;
use App\Models\AppNotification;
use App\Models\BoardingComplex;
use App\Models\BoardingRoom;
use App\Models\GuruAbsensiSholatAccess;
use App\Models\Jadwal;
use App\Models\MataPelajaran;
use App\Models\NgajiSchedule;
use App\Models\Pembayaran;
use App\Models\PrayerAttendanceType;
use App\Models\SantriPondok;
use App\Models\Siswa;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\GuruAttendanceStatusService;
use App\Services\MapelAccessService;
use App\Services\PermissionService;
use App\Services\ReferenceResolver;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __construct(
        private readonly MapelAccessService $mapelAccessService,
        private readonly GuruAttendanceStatusService $attendanceStatusService,
        private readonly PermissionService $permissionService,
    ) {
    }

    public function index(Request $request)
    {
        $today = now()->toDateString();
        $actor = $this->resolveActor($request);

        if (!$actor) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi pengguna tidak valid atau akun sedang nonaktif',
            ], 403);
        }

        if ($actor && $actor->role === 'guru') {
            return response()->json($this->withPermissions($this->buildGuruDashboard($actor, $today), $actor));
        }

        if ($actor && $actor->role === 'wali') {
            return response()->json($this->withPermissions($this->buildWaliDashboard($actor, $today), $actor));
        }

        $dashboardData = Cache::remember("admin_dashboard_{$today}", 15, fn () => $this->buildAdminDashboard($today));

        return response()->json($this->withPermissions($dashboardData, $actor));
    }

    private function buildAdminDashboard(string $today): array
    {
        $absensiHariIni = Absensi::with('siswa')
            ->where('tanggal', $today)
            ->whereNotNull('class_id')
            ->whereNotNull('mapel_id')
            ->whereNotNull('jadwal_id')
            ->get();
        $pembayaranHariIni = Pembayaran::where('tanggal', $today)->get();

        $absensiPerKelas = $absensiHariIni->groupBy(function ($item) {
            return implode('|', [
                $item->class_id,
                $item->mapel_id,
                $item->jadwal_id,
            ]);
        })->map(function ($items) {
            $first = $items->first();
            return [
                'kelas' => $first->kelas,
                'mapel' => $first->mapel,
                'class_id' => $first->class_id,
                'mapel_id' => $first->mapel_id,
                'jadwal_id' => $first->jadwal_id,
                'total' => $items->count(),
                'hadir' => $items->where('status', 'Hadir')->count(),
                'izin' => $items->where('status', 'Izin')->count(),
                'sakit' => $items->where('status', 'Sakit')->count(),
                'alfa' => $items->where('status', 'Alfa')->count(),
                'diinput_oleh' => $first->diinput_oleh ?? 'Admin',
                'diinput_via' => $first->diinput_via ?? 'online',
                'waktu' => optional($first->created_at)->format('H:i:s') ?? '-',
                'created_at' => $items->max('created_at')?->toIso8601String(),
                'status' => $this->resolveAbsensiStatus($first->diinput_via),
            ];
        })->sortByDesc('created_at')->values();

            $siswaPerKomplek = BoardingComplex::withCount(['santriPondok' => function ($q) {
                    $q->whereNull('deleted_at')->where('status', 'Aktif');
                }])
                ->orderBy('sort_order')
                ->get()
                ->filter(fn ($c) => $c->santri_pondok_count > 0)
                ->map(fn ($c) => [
                    'name' => $c->name,
                    'value' => (int) $c->santri_pondok_count,
                ])
                ->values();

            if ($siswaPerKomplek->isEmpty()) {
                $siswaPerKomplek = Siswa::select('komplek as name', DB::raw('count(*) as value'))
                    ->whereNotNull('komplek')
                    ->where('komplek', '!=', '')
                    ->groupBy('komplek')
                    ->orderByDesc('value')
                    ->get()
                    ->map(fn ($r) => ['name' => $r->name, 'value' => (int) $r->value]);
            }

            $siswaPerKamar = BoardingRoom::with('complex')
                ->withCount(['santriPondok' => function ($q) {
                    $q->whereNull('deleted_at')->where('status', 'Aktif');
                }])
                ->orderByDesc('santri_pondok_count')
                ->take(12)
                ->get()
                ->filter(fn ($r) => $r->santri_pondok_count > 0)
                ->map(fn ($r) => [
                    'name' => $r->name,
                    'kamar' => $r->name,
                    'komplek' => $r->complex?->name ?? 'Umum',
                    'value' => (int) $r->santri_pondok_count,
                    'capacity' => (int) ($r->capacity ?? 0),
                ])
                ->values();

            if ($siswaPerKamar->isEmpty()) {
                $siswaPerKamar = Siswa::select('kamar as name', 'komplek', DB::raw('count(*) as value'))
                    ->whereNotNull('kamar')
                    ->where('kamar', '!=', '')
                    ->groupBy('kamar', 'komplek')
                    ->orderByDesc('value')
                    ->take(12)
                    ->get()
                    ->map(fn ($r) => [
                        'name' => $r->name,
                        'kamar' => $r->name,
                        'komplek' => $r->komplek ?? 'Umum',
                        'value' => (int) $r->value,
                        'capacity' => 0,
                    ]);
            }

            $totalSantriMondok = SantriPondok::whereNull('deleted_at')->where('status', 'Aktif')->count()
                ?: Siswa::whereNotNull('komplek')->where('komplek', '!=', '')->count();

        $madinClasses = \App\Models\SchoolClass::where(function ($q) {
            $q->where('category', '!=', 'Formal')
              ->orWhere('name', 'ilike', 'Sifir%');
        })->orderBy('id')->get(['id', 'name', 'category', 'gender_group']);

        $madinClassIds = $madinClasses->pluck('id')->toArray();

        $madinCounts = Siswa::whereIn('class_id', $madinClassIds)
            ->select('class_id', 'jenis_kelamin', DB::raw('count(*) as total'))
            ->groupBy('class_id', 'jenis_kelamin')
            ->get()
            ->groupBy('class_id');

        $siswaPerKelasMadin = $madinClasses->map(function ($c) use ($madinCounts) {
            $items = collect($madinCounts->get($c->id, []));
            $pa = (int) ($items->firstWhere('jenis_kelamin', 'L')?->total ?? 0);
            $pi = (int) ($items->firstWhere('jenis_kelamin', 'P')?->total ?? 0);
            return [
                'id' => $c->id,
                'name' => $c->name,
                'kelas' => $c->name,
                'category' => $c->category ?: 'Madin',
                'gender_group' => $c->gender_group,
                'value' => $pa + $pi,
                'putra' => $pa,
                'putri' => $pi,
            ];
        })->values();

        $formalClasses = \App\Models\SchoolClass::where('category', 'Formal')
            ->orderBy('id')
            ->get(['id', 'name', 'category', 'gender_group']);

        $formalCounts = Siswa::whereNotNull('sekolah_formal')
            ->where('sekolah_formal', '!=', '')
            ->where('sekolah_formal', 'not ilike', 'Sifir%')
            ->where('sekolah_formal', 'not ilike', '%Awal%')
            ->where('sekolah_formal', 'not ilike', '%Tsani%')
            ->where('sekolah_formal', 'not ilike', '%Tsalis%')
            ->where('sekolah_formal', 'not ilike', '%Robi%')
            ->where('sekolah_formal', 'not ilike', '%Khomis%')
            ->where('sekolah_formal', 'not ilike', '%Sadis%')
            ->select('sekolah_formal', 'jenis_kelamin', DB::raw('count(*) as total'))
            ->groupBy('sekolah_formal', 'jenis_kelamin')
            ->get()
            ->groupBy('sekolah_formal');

        $siswaPerKelasSekolah = $formalClasses->map(function ($c) use ($formalCounts) {
            $items = collect($formalCounts->get((string) $c->name, []));
            $pa = (int) ($items->firstWhere('jenis_kelamin', 'L')?->total ?? 0);
            $pi = (int) ($items->firstWhere('jenis_kelamin', 'P')?->total ?? 0);
            return [
                'id' => $c->id,
                'name' => $c->name,
                'kelas' => $c->name,
                'category' => 'Formal',
                'gender_group' => $c->gender_group,
                'value' => $pa + $pi,
                'putra' => $pa,
                'putri' => $pi,
            ];
        })->values();

        $existingFormalNames = $formalClasses->pluck('name')->map(fn ($n) => (string) $n)->toArray();
        $customFormal = $formalCounts->keys()->map(fn ($k) => (string) $k)->filter(fn ($k) => !in_array($k, $existingFormalNames));
        foreach ($customFormal as $customName) {
            $items = collect($formalCounts->get((string) $customName, []));
            $pa = (int) ($items->firstWhere('jenis_kelamin', 'L')?->total ?? 0);
            $pi = (int) ($items->firstWhere('jenis_kelamin', 'P')?->total ?? 0);
            if ($pa + $pi > 0) {
                $siswaPerKelasSekolah->push([
                    'id' => 0,
                    'name' => (string) $customName,
                    'kelas' => (string) $customName,
                    'category' => 'Formal',
                    'gender_group' => null,
                    'value' => $pa + $pi,
                    'putra' => $pa,
                    'putri' => $pi,
                ]);
            }
        }

        return [
            'success' => true,
            'tanggal' => $today,
            'role' => 'admin',
            'absensi' => [
                'total' => $absensiHariIni->count(),
                'hadir' => $absensiHariIni->where('status', 'Hadir')->count(),
                'izin' => $absensiHariIni->where('status', 'Izin')->count(),
                'sakit' => $absensiHariIni->where('status', 'Sakit')->count(),
                'alfa' => $absensiHariIni->where('status', 'Alfa')->count(),
                'per_kelas' => $absensiPerKelas,
                'terbaru' => $absensiHariIni
                    ->sortByDesc('created_at')
                    ->take(8)
                    ->map(fn (Absensi $row) => [
                        'id' => $row->id,
                        'siswa_id' => $row->siswa_id,
                        'siswa_nama' => $row->siswa?->nama,
                        'kelas' => $row->kelas,
                        'mapel' => $row->mapel,
                        'status' => $row->status,
                        'petugas' => $row->diinput_oleh,
                        'waktu' => $row->created_at?->format('H:i'),
                        'created_at' => $row->created_at?->toIso8601String(),
                    ])
                    ->values(),
            ],
            'absensi_sholat' => $this->buildAdminPrayerSummary($today),
            'absensi_ngaji' => $this->buildAdminNgajiSummary($today),
            'pembayaran' => [
                'total_masuk' => $pembayaranHariIni->sum('jumlah'),
                'jumlah_transaksi' => $pembayaranHariIni->count(),
            ],
            'statistik' => [
                'total_siswa' => Siswa::count(),
                'siswa_aktif' => $this->activeStudentsQuery()->count(),
                'total_santri_mondok' => $totalSantriMondok,
                'total_mapel' => MataPelajaran::where('status', 'Aktif')->count(),
                'total_asrama' => BoardingComplex::count() ?: $siswaPerKomplek->count(),
                'total_kamar' => BoardingRoom::count() ?: Siswa::whereNotNull('kamar')->where('kamar', '!=', '')->distinct('kamar')->count(),
                'total_kelas_madin' => $madinClasses->count(),
                'total_kelas_sekolah' => $siswaPerKelasSekolah->count(),
                'total_santri_madin' => $siswaPerKelasMadin->sum('value'),
                'total_santri_sekolah' => $siswaPerKelasSekolah->sum('value'),
                'siswa_per_gender' => Siswa::select('jenis_kelamin', DB::raw('count(*) as total'))
                    ->groupBy('jenis_kelamin')
                    ->get()
                    ->map(fn ($row) => [
                        'name' => $row->jenis_kelamin === 'L' ? 'Santri Putra' : 'Santri Putri',
                        'gender' => $row->jenis_kelamin,
                        'value' => (int) $row->total
                    ]),
                'siswa_per_kelas' => $siswaPerKelasMadin,
                'siswa_per_kelas_madin' => $siswaPerKelasMadin,
                'siswa_per_kelas_sekolah' => $siswaPerKelasSekolah,
                'siswa_per_komplek' => $siswaPerKomplek,
                'siswa_per_kamar' => $siswaPerKamar,
            ],
        ];
    }

    private function groupGuruDashboardCards($cards)
    {
        return collect($cards)
            ->groupBy(function (array $card) {
                return implode('|', [
                    $card['mapel'] ?? '-',
                    $card['hari'] ?? '-',
                    $card['jam_mulai'] ?? '-',
                    $card['jam_selesai'] ?? '-',
                    $card['status'] ?? '-',
                ]);
            })
            ->map(function ($items) {
                $kelasList = collect($items)
                    ->pluck('kelas')
                    ->filter()
                    ->unique()
                    ->values();

                $first = $items->first();
                $kelasCount = $kelasList->count();
                $kelasLabel = $kelasCount <= 1
                    ? ($kelasList->first() ?? ($first['kelas'] ?? '-'))
                    : $this->summarizeKelasList($kelasList->all());

                return [
                    ...$first,
                    'kelas' => $kelasLabel,
                    'class_id' => $kelasCount === 1 ? ($first['class_id'] ?? null) : null,
                    'kelas_count' => $kelasCount,
                    'kelas_list' => $kelasList->all(),
                    'is_multi_class' => $kelasCount > 1,
                    'total' => collect($items)->sum('total'),
                    'hadir' => collect($items)->sum('hadir'),
                    'izin' => collect($items)->sum('izin'),
                    'sakit' => collect($items)->sum('sakit'),
                    'alfa' => collect($items)->sum('alfa'),
                ];
            })
            ->values();
    }

    private function summarizeKelasList(array $kelasList): string
    {
        $count = count($kelasList);
        if ($count <= 1) {
            return $kelasList[0] ?? '-';
        }

        if ($count === 2) {
            return implode(', ', $kelasList);
        }

        return implode(', ', array_slice($kelasList, 0, 2)) . ' +' . ($count - 2) . ' kelas';
    }

    private function buildGuruDashboard(User $guru, string $today): array
    {
        $dayMap = [
            0 => 'Ahad',
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
        ];
        $now = Carbon::now('Asia/Jakarta');
        $currentTime = $now->format('H:i');
        $todayDay = $dayMap[$now->dayOfWeek] ?? 'Senin';
        $tomorrowDay = $dayMap[($now->dayOfWeek + 1) % 7] ?? 'Selasa';

        // 1. Fetch all Jadwal for this teacher
        $jadwalQuery = Jadwal::query()
            ->with(['mataPelajaran', 'kelasRef'])
            ->where(function ($q) use ($guru) {
                $q->where('teacher_id', $guru->id)
                    ->orWhere('guru', $guru->name);
                if (!empty($guru->kode_guru)) {
                    $q->orWhere('guru', $guru->kode_guru);
                }
            })
            ->orderByRaw("CASE hari
                WHEN 'Ahad' THEN 1
                WHEN 'Senin' THEN 2
                WHEN 'Selasa' THEN 3
                WHEN 'Rabu' THEN 4
                WHEN 'Kamis' THEN 5
                WHEN 'Jumat' THEN 6
                WHEN 'Sabtu' THEN 7
                ELSE 99
            END")
            ->orderBy('jam_mulai');

        $allJadwal = $jadwalQuery->get();
        $jadwalHariIni = $allJadwal->where('hari', $todayDay)->values();
        $jadwalBesok = $allJadwal->where('hari', $tomorrowDay)->values();

        // 2. Classes and Students taught
        $classIds = $allJadwal->pluck('class_id')->filter()->unique()->values()->all();
        $totalSantriDiampu = !empty($classIds)
            ? Siswa::query()->whereIn('class_id', $classIds)->where('status', 'Aktif')->count()
            : 0;

        // 3. Check today's attendance for this teacher's classes
        $absensiHariIni = Absensi::query()
            ->whereDate('tanggal', $today)
            ->where(function ($q) use ($guru, $jadwalHariIni) {
                $q->where('actor_user_id', $guru->id)
                    ->orWhere('diinput_oleh', 'ilike', "%{$guru->name}%");

                $jIds = $jadwalHariIni->pluck('id')->filter()->all();
                if (!empty($jIds)) {
                    $q->orWhereIn('jadwal_id', $jIds);
                }

                foreach ($jadwalHariIni as $j) {
                    if ($j->class_id && $j->mapel_id) {
                        $q->orWhere(function ($sub) use ($j) {
                            $sub->where('class_id', $j->class_id)
                                ->where('mapel_id', $j->mapel_id);
                        });
                    }
                }
            })
            ->get();

        $formatCard = function (Jadwal $j, bool $isToday = true, bool $isTomorrow = false) use ($absensiHariIni, $currentTime, $guru) {
            $absensi = $absensiHariIni->filter(function ($a) use ($j) {
                if ($a->jadwal_id && (int) $a->jadwal_id === (int) $j->id) {
                    return true;
                }
                if ($a->class_id && $a->mapel_id && (int) $a->class_id === (int) $j->class_id && (int) $a->mapel_id === (int) $j->mapel_id) {
                    return true;
                }
                return false;
            });
            $isDone = $absensi->isNotEmpty();

            $jamMulai = $j->jam_mulai ? substr((string) $j->jam_mulai, 0, 5) : '07:00';
            $jamSelesai = $j->jam_selesai ? substr((string) $j->jam_selesai, 0, 5) : '08:30';

            // Hitung 1 jam sebelum jam mulai pelajaran
            try {
                $parsedMulai = Carbon::createFromFormat('H:i', $jamMulai);
                $jamAktifMulai = (clone $parsedMulai)->subHour()->format('H:i');
            } catch (\Exception) {
                $jamAktifMulai = '06:00';
            }

            $canInput = false;
            $isLate = false;
            $timeStatus = 'normal';
            $badgeStatus = 'Sedang Aktif';
            $pesanRamah = '';

            if (!$isToday) {
                if ($isTomorrow) {
                    $timeStatus = 'besok';
                    $badgeStatus = '📅 Jadwal Besok';
                    $pesanRamah = "Jadwal untuk besok hari {$j->hari}: Pelajaran {$j->mataPelajaran?->nama} pukul {$jamMulai} - {$jamSelesai}.";
                } else {
                    $timeStatus = 'hari_lain';
                    $badgeStatus = "📅 Hari {$j->hari}";
                    $pesanRamah = "Jadwal hari {$j->hari}: Pelajaran {$j->mataPelajaran?->nama} pukul {$jamMulai} - {$jamSelesai}.";
                }
            } else {
                if ($isDone) {
                    $timeStatus = 'sudah_absen';
                    $badgeStatus = '✅ Sudah Diabsen';
                    $canInput = false;
                    $pesanRamah = 'Presensi kelas ini sudah berhasil disimpan dan terkunci.';
                } elseif ($currentTime < $jamAktifMulai) {
                    $timeStatus = 'segera';
                    $badgeStatus = '⏳ Segera Aktif';
                    $canInput = false;
                    $pesanRamah = "Jadwal akan aktif pada pukul {$jamAktifMulai} (1 jam sebelum jam pelajaran dimulai).";
                } elseif ($currentTime >= $jamAktifMulai && $currentTime <= $jamSelesai) {
                    $timeStatus = 'aktif';
                    $badgeStatus = '🟢 Sedang Aktif';
                    $canInput = true;
                    $isLate = false;
                    $pesanRamah = '🟢 Jadwal sedang aktif! Silakan klik untuk input presensi santri sekarang.';
                } elseif ($currentTime > $jamSelesai && $currentTime <= '23:00') {
                    $timeStatus = 'terlambat';
                    $badgeStatus = '⚠️ Terlambat Input';
                    $canInput = true;
                    $isLate = true;
                    $pesanRamah = '⚠️ Jam KBM telah selesai. Guru masih dapat mengisi presensi sebelum pukul 23:00 (Status: Terlambat Input).';
                } else {
                    $timeStatus = 'ditutup';
                    $badgeStatus = '🔒 Waktu Ditutup';
                    $canInput = false;
                    $isLate = true;
                    $pesanRamah = '🔒 Waktu input presensi guru telah ditutup (maksimal 23:00). Hubungi Admin Utama jika ada presensi susulan.';
                }
            }

            return [
                'id' => $j->id,
                'hari' => $j->hari,
                'jam_mulai' => $jamMulai,
                'jam_selesai' => $jamSelesai,
                'jam_aktif_mulai' => $jamAktifMulai,
                'waktu' => "{$jamMulai} - {$jamSelesai}",
                'ruangan' => $j->ruangan ?: '-',
                'class_id' => $j->class_id,
                'kelas' => $j->sifir ?: optional($j->kelasRef)->name ?: '-',
                'mapel_id' => $j->mapel_id,
                'mapel' => optional($j->mataPelajaran)->nama ?: optional($j->mataPelajaran)->name ?: '-',
                'guru' => $j->guru ?: $guru->name,
                'status_absen' => $isDone ? 'completed' : ($canInput ? ($isLate ? 'active_late' : 'active') : 'locked'),
                'status_waktu' => $timeStatus,
                'badge_status' => $badgeStatus,
                'pesan_ramah' => $pesanRamah,
                'can_input' => $canInput,
                'is_late' => $isLate,
                'is_done' => $isDone,
                'total_hadir' => $absensi->where('status', 'Hadir')->count(),
                'total_izin' => $absensi->where('status', 'Izin')->count(),
                'total_sakit' => $absensi->where('status', 'Sakit')->count(),
                'total_alfa' => $absensi->where('status', 'Alfa')->count(),
                'total_siswa' => $absensi->count(),
            ];
        };

        $jadwalCardsHariIni = $jadwalHariIni->map(fn (Jadwal $j) => $formatCard($j, true, false))->values();
        $jadwalCardsBesok = $jadwalBesok->map(fn (Jadwal $j) => $formatCard($j, false, true))->values();
        $jadwalCardsMingguan = $allJadwal->map(fn (Jadwal $j) => $formatCard($j, $j->hari === $todayDay, $j->hari === $tomorrowDay))->values();

        // 4. Sholat Access for Guru
        $sholatAccess = GuruAbsensiSholatAccess::query()
            ->where('user_id', $guru->id)
            ->where('is_active', true)
            ->get();
        $canSholat = $sholatAccess->isNotEmpty() || $guru->role === 'admin';

        // 5. Ngaji Schedule for Guru
        $ngajiSchedules = NgajiSchedule::query()
            ->where('status', 'Aktif')
            ->where('teacher_id', $guru->id)
            ->get();
        $canNgaji = $ngajiSchedules->isNotEmpty() || $guru->role === 'admin';

        return [
            'success' => true,
            'tanggal' => $today,
            'waktu_sekarang' => $currentTime,
            'hari_ini' => $todayDay,
            'hari_besok' => $tomorrowDay,
            'role' => 'guru',
            'guru' => [
                'id' => $guru->id,
                'name' => $guru->name,
                'kode_guru' => $guru->kode_guru,
                'jenis_kelamin' => $guru->jenis_kelamin ?: ($guru->gelar_ustadz === 'Ustadzah' ? 'P' : 'L'),
                'panggilan' => $guru->gelar_ustadz,
                'unit_kerja' => $guru->unit_kerja ?: 'Madrasah Diniyah PP Qomaruddin',
            ],
            'hak_akses' => [
                'absen_madin' => true,
                'absen_sholat' => $canSholat,
                'absen_ngaji' => $canNgaji,
                'nilai' => true,
            ],
            'jadwal_hari_ini' => $jadwalCardsHariIni,
            'jadwal_besok' => $jadwalCardsBesok,
            'jadwal_mingguan' => $jadwalCardsMingguan,
            'stats' => [
                'total_jadwal_hari_ini' => $jadwalHariIni->count(),
                'jadwal_sudah_diabsen' => $jadwalCardsHariIni->where('is_done', true)->count(),
                'jadwal_aktif_sekarang' => $jadwalCardsHariIni->where('can_input', true)->count(),
                'jadwal_belum_diabsen' => $jadwalCardsHariIni->where('is_done', false)->count(),
                'total_santri_diampu' => $totalSantriDiampu,
                'total_kelas_diampu' => count($classIds),
            ],
            'absensi_sholat' => $canSholat ? $this->buildGuruPrayerSummary($guru, $today) : null,
            'absensi_ngaji' => $canNgaji ? $this->buildGuruNgajiSummary($guru, $today) : null,
        ];
    }

    private function buildWaliDashboard(User $wali, string $today): array
    {
        $anakIds = Siswa::query()
            ->where('wali_id', $wali->id)
            ->orWhereHas('guardianProfile', fn ($query) => $query->where('user_id', $wali->id))
            ->pluck('id');

        $absensiHariIni = Absensi::query()
            ->with('siswa:id,nama')
            ->whereDate('tanggal', $today)
            ->whereNotNull('class_id')
            ->whereNotNull('mapel_id')
            ->whereNotNull('jadwal_id')
            ->when(
                $anakIds->isNotEmpty(),
                fn ($builder) => $builder->whereIn('siswa_id', $anakIds),
                fn ($builder) => $builder->whereRaw('1 = 0'),
            )
            ->orderByDesc('created_at')
            ->get();

        $cards = $absensiHariIni
            ->groupBy(function ($item) {
                return implode('|', [
                    $item->class_id,
                    $item->mapel_id,
                    $item->jadwal_id,
                    $item->siswa_id,
                ]);
            })
            ->map(function ($items) {
                $first = $items->first();
                return [
                    'siswa_id' => $first->siswa_id,
                    'siswa_nama' => $first->siswa?->nama,
                    'kelas' => $first->kelas,
                    'mapel' => $first->mapel,
                    'class_id' => $first->class_id,
                    'mapel_id' => $first->mapel_id,
                    'jadwal_id' => $first->jadwal_id,
                    'status' => 'completed',
                    'total' => $items->count(),
                    'hadir' => $items->where('status', 'Hadir')->count(),
                    'izin' => $items->where('status', 'Izin')->count(),
                    'sakit' => $items->where('status', 'Sakit')->count(),
                    'alfa' => $items->where('status', 'Alfa')->count(),
                    'diinput_oleh' => $first->diinput_oleh ?? 'Guru/Admin',
                    'diinput_via' => 'riwayat_final',
                    'waktu' => optional($first->created_at)->format('H:i:s') ?? '-',
                ];
            })
            ->values();

        return [
            'success' => true,
            'tanggal' => $today,
            'role' => 'wali',
            'absensi' => [
                'total' => $absensiHariIni->count(),
                'hadir' => $absensiHariIni->where('status', 'Hadir')->count(),
                'izin' => $absensiHariIni->where('status', 'Izin')->count(),
                'sakit' => $absensiHariIni->where('status', 'Sakit')->count(),
                'alfa' => $absensiHariIni->where('status', 'Alfa')->count(),
                'per_kelas' => $cards,
            ],
            'absensi_sholat' => $this->buildWaliPrayerSummary($anakIds, $today),
            'absensi_ngaji' => $this->buildWaliNgajiSummary($anakIds, $today),
            'pembayaran' => [
                'total_masuk' => 0,
                'jumlah_transaksi' => 0,
            ],
            'statistik' => [
                'total_siswa' => $anakIds->count(),
                'siswa_aktif' => $this->activeStudentsQuery()->whereIn('id', $anakIds)->count(),
                'total_mapel' => $cards->pluck('mapel')->filter()->unique()->count(),
            ],
        ];
    }

    private function resolveActor(Request $request): ?User
    {
        return app(ActorResolver::class)->active($request, ['user_id', 'actor_user_id']);
    }

    private function activeStudentsQuery()
    {
        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');

        return Siswa::query()->where(function ($query) use ($activeStatusId) {
            if ($activeStatusId) {
                $query->where('student_status_id', $activeStatusId);
            }
            $query->orWhere('status', 'Aktif');
        });
    }

    private function buildAdminNgajiSummary(string $today): array
    {
        $schedules = NgajiSchedule::query()
            ->where('status', 'Aktif')
            ->get();

        $rows = AbsensiNgaji::query()
            ->with(['siswa:id,nama,nis,kelas', 'session:id,name', 'book:id,name', 'schedule.teacher:id,name'])
            ->whereDate('tanggal', $today)
            ->where('is_cancelled', false)
            ->get();

        return $this->formatNgajiSummary(
            $rows,
            $schedules->count(),
            $this->expectedNgajiStudentCount($schedules),
        );
    }

    private function buildGuruNgajiSummary(User $guru, string $today): array
    {
        $schedules = NgajiSchedule::query()
            ->where('status', 'Aktif')
            ->where('teacher_id', $guru->id)
            ->get();

        $scheduleIds = $schedules->pluck('id')->all();
        $rows = AbsensiNgaji::query()
            ->with(['siswa:id,nama,nis,kelas', 'session:id,name', 'book:id,name', 'schedule.teacher:id,name'])
            ->whereDate('tanggal', $today)
            ->when(
                !empty($scheduleIds),
                fn ($query) => $query->whereIn('ngaji_schedule_id', $scheduleIds),
                fn ($query) => $query->whereRaw('1 = 0'),
            )
            ->where('is_cancelled', false)
            ->get();

        return $this->formatNgajiSummary(
            $rows,
            $schedules->count(),
            $this->expectedNgajiStudentCount($schedules),
        );
    }

    private function buildWaliNgajiSummary($anakIds, string $today): array
    {
        $childIds = collect($anakIds)->map(fn ($id) => (int) $id)->filter()->values()->all();
        $schedules = NgajiSchedule::query()
            ->where('status', 'Aktif')
            ->get()
            ->filter(fn (NgajiSchedule $schedule) => $this->ngajiStudentCountForSchedule($schedule, $childIds) > 0)
            ->values();

        $rows = AbsensiNgaji::query()
            ->with(['siswa:id,nama,nis,kelas', 'session:id,name', 'book:id,name', 'schedule.teacher:id,name'])
            ->whereDate('tanggal', $today)
            ->when(
                !empty($childIds),
                fn ($query) => $query->whereIn('siswa_id', $childIds),
                fn ($query) => $query->whereRaw('1 = 0'),
            )
            ->where('is_cancelled', false)
            ->orderByDesc('created_at')
            ->get();

        return $this->formatNgajiSummary(
            $rows,
            $schedules->count(),
            $this->expectedNgajiStudentCount($schedules, $childIds),
        );
    }

    private function expectedNgajiStudentCount($schedules, ?array $onlyStudentIds = null): int
    {
        return collect($schedules)->sum(fn (NgajiSchedule $schedule) => $this->ngajiStudentCountForSchedule($schedule, $onlyStudentIds));
    }

    private function ngajiStudentCountForSchedule(NgajiSchedule $schedule, ?array $onlyStudentIds = null): int
    {
        $filterStudents = function ($query) use ($onlyStudentIds) {
            if (!empty($onlyStudentIds)) {
                $query->whereIn('siswa_id', $onlyStudentIds);
            }
        };

        if ($schedule->boarding_room_id) {
            return SantriPondok::query()
                ->where('status', 'Aktif')
                ->where('boarding_room_id', $schedule->boarding_room_id)
                ->when(!empty($onlyStudentIds), $filterStudents)
                ->count();
        }

        if ($schedule->boarding_complex_id) {
            return SantriPondok::query()
                ->where('status', 'Aktif')
                ->where('boarding_complex_id', $schedule->boarding_complex_id)
                ->when(!empty($onlyStudentIds), $filterStudents)
                ->count();
        }

        if ($schedule->class_id) {
            return $this->activeStudentsQuery()
                ->where('class_id', $schedule->class_id)
                ->when(!empty($onlyStudentIds), fn ($query) => $query->whereIn('id', $onlyStudentIds))
                ->count();
        }

        return SantriPondok::query()
            ->where('status', 'Aktif')
            ->when(!empty($onlyStudentIds), $filterStudents)
            ->count();
    }

    private function formatNgajiSummary($rows, int $expectedSchedules, int $expectedTotal = 0): array
    {
        $scheduleDone = $rows
            ->pluck('ngaji_schedule_id')
            ->filter()
            ->unique()
            ->count();
        $attended = $rows->count();
        $present = $rows->where('status_code', 'H')->count();
        $effectiveTotal = max($expectedTotal, $attended);
        $activities = $rows
            ->groupBy('ngaji_schedule_id')
            ->map(function ($items) {
                $first = $items->sortByDesc('created_at')->first();

                return [
                    'ngaji_schedule_id' => $first?->ngaji_schedule_id,
                    'sesi' => $first?->session?->name,
                    'kitab' => $first?->book?->name,
                    'pengajar' => $first?->schedule?->teacher?->name,
                    'total' => $items->count(),
                    'hadir' => $items->where('status_code', 'H')->count(),
                    'izin' => $items->where('status_code', 'I')->count(),
                    'sakit' => $items->where('status_code', 'S')->count(),
                    'alfa' => $items->where('status_code', 'A')->count(),
                    'waktu' => $first?->created_at?->format('H:i'),
                    'created_at' => $first?->created_at?->toIso8601String(),
                ];
            })
            ->sortByDesc('created_at')
            ->values();

        return [
            'total' => $attended,
            'expected_total' => $expectedTotal,
            'H' => $present,
            'I' => $rows->where('status_code', 'I')->count(),
            'S' => $rows->where('status_code', 'S')->count(),
            'A' => $rows->where('status_code', 'A')->count(),
            'kosong' => max(0, $expectedTotal - $attended),
            'jadwal_sudah_diabsen' => $scheduleDone,
            'jadwal_belum_diabsen' => max(0, $expectedSchedules - $scheduleDone),
            'persentase_hadir' => $effectiveTotal > 0 ? round(($present / $effectiveTotal) * 100, 2) : 0,
            'aktivitas' => $activities,
            'terbaru' => $rows->sortByDesc('created_at')->take(5)->map(fn (AbsensiNgaji $row) => [
                'id' => $row->id,
                'siswa_id' => $row->siswa_id,
                'siswa_nama' => $row->siswa?->nama,
                'nis' => $row->siswa?->nis,
                'kelas' => $row->siswa?->kelas,
                'ngaji_schedule_id' => $row->ngaji_schedule_id,
                'sesi' => $row->session?->name,
                'kitab' => $row->book?->name,
                'status' => $row->status_label,
                'status_code' => $row->status_code,
                'pengajar' => $row->schedule?->teacher?->name,
                'waktu' => $row->created_at?->format('H:i'),
                'created_at' => $row->created_at?->toIso8601String(),
            ])->values(),
        ];
    }

    private function buildAdminPrayerSummary(string $today): array
    {
        $typeCount = $this->activePrayerTypeCount();
        $rows = AbsensiSholat::query()
            ->with(['boardingRoom.complex', 'siswa:id,nama', 'prayerType:id,name'])
            ->whereDate('tanggal', $today)
            ->where('is_cancelled', false)
            ->get();
        $expected = SantriPondok::query()
            ->where('status', 'Aktif')
            ->where('participates_prayer', true);

        return $this->formatPrayerSummary(
            $rows,
            (clone $expected)->whereNotNull('boarding_room_id')->distinct()->count('boarding_room_id') * $typeCount,
            $expected->count() * $typeCount,
        );
    }

    private function buildGuruPrayerSummary(User $guru, string $today): array
    {
        $typeCount = $this->activePrayerTypeCount();
        $allowedRoomIds = $this->guruPrayerRoomIds($guru);
        $rows = AbsensiSholat::query()
            ->with(['boardingRoom.complex', 'siswa:id,nama', 'prayerType:id,name'])
            ->whereDate('tanggal', $today)
            ->whereIn('boarding_room_id', $allowedRoomIds)
            ->where('is_cancelled', false)
            ->get();
        $expected = SantriPondok::query()
            ->where('status', 'Aktif')
            ->where('participates_prayer', true)
            ->whereIn('boarding_room_id', $allowedRoomIds);

        return $this->formatPrayerSummary(
            $rows,
            (clone $expected)->whereNotNull('boarding_room_id')->distinct()->count('boarding_room_id') * $typeCount,
            $expected->count() * $typeCount,
        );
    }

    private function buildWaliPrayerSummary($anakIds, string $today): array
    {
        $typeCount = $this->activePrayerTypeCount();
        $rows = AbsensiSholat::query()
            ->with(['boardingRoom.complex', 'siswa:id,nama', 'prayerType:id,name'])
            ->whereDate('tanggal', $today)
            ->when(
                $anakIds->isNotEmpty(),
                fn ($query) => $query->whereIn('siswa_id', $anakIds),
                fn ($query) => $query->whereRaw('1 = 0'),
            )
            ->where('is_cancelled', false)
            ->orderByDesc('created_at')
            ->get();
        $expected = SantriPondok::query()
            ->where('status', 'Aktif')
            ->where('participates_prayer', true)
            ->when(
                $anakIds->isNotEmpty(),
                fn ($query) => $query->whereIn('siswa_id', $anakIds),
                fn ($query) => $query->whereRaw('1 = 0'),
            );

        return $this->formatPrayerSummary($rows, 0, $expected->count() * $typeCount);
    }

    private function formatPrayerSummary($rows, int $expectedRooms, int $expectedTotal = 0): array
    {
        $roomsDone = $rows
            ->filter(fn (AbsensiSholat $row) => !empty($row->boarding_room_id))
            ->map(fn (AbsensiSholat $row) => $row->boarding_room_id . '|' . ($row->prayer_attendance_type_id ?: 0))
            ->unique()
            ->count();
        $attended = $rows->count();
        $present = $rows->where('status_code', 'M')->count();
        $effectiveTotal = max($expectedTotal, $attended);
        $activities = $rows
            ->groupBy(fn (AbsensiSholat $row) => ($row->boarding_room_id ?: 0) . '|' . ($row->prayer_attendance_type_id ?: 0))
            ->map(function ($items) {
                $first = $items->sortByDesc('created_at')->first();

                return [
                    'boarding_room_id' => $first?->boarding_room_id,
                    'prayer_attendance_type_id' => $first?->prayer_attendance_type_id,
                    'jenis_sholat' => $first?->prayerType?->name,
                    'komplek' => $first?->boardingRoom?->complex?->name,
                    'kamar' => $first?->boardingRoom?->name,
                    'total' => $items->count(),
                    'masuk' => $items->where('status_code', 'M')->count(),
                    'izin' => $items->where('status_code', 'I')->count(),
                    'sakit' => $items->where('status_code', 'S')->count(),
                    'waktu' => $first?->created_at?->format('H:i'),
                    'created_at' => $first?->created_at?->toIso8601String(),
                ];
            })
            ->sortByDesc('created_at')
            ->values();

        return [
            'total' => $attended,
            'expected_total' => $expectedTotal,
            'M' => $present,
            'I' => $rows->where('status_code', 'I')->count(),
            'S' => $rows->where('status_code', 'S')->count(),
            'kosong' => max(0, $expectedTotal - $attended),
            'kamar_sudah_diabsen' => $roomsDone,
            'kamar_belum_diabsen' => max(0, $expectedRooms - $roomsDone),
            'persentase_hadir' => $effectiveTotal > 0 ? round(($present / $effectiveTotal) * 100, 2) : 0,
            'aktivitas' => $activities,
            'terbaru' => $rows->sortByDesc('created_at')->take(5)->map(fn (AbsensiSholat $row) => [
                'id' => $row->id,
                'siswa_id' => $row->siswa_id,
                'siswa_nama' => $row->siswa?->nama,
                'prayer_attendance_type_id' => $row->prayer_attendance_type_id,
                'jenis_sholat' => $row->prayerType?->name,
                'status' => $row->status_label,
                'status_code' => $row->status_code,
                'komplek' => $row->boardingRoom?->complex?->name,
                'kamar' => $row->boardingRoom?->name,
                'waktu' => $row->created_at?->format('H:i'),
                'created_at' => $row->created_at?->toIso8601String(),
            ])->values(),
        ];
    }

    private function activePrayerTypeCount(): int
    {
        return max(1, PrayerAttendanceType::query()->where('is_active', true)->count());
    }

    private function guruPrayerRoomIds(User $guru): array
    {
        $accessRows = GuruAbsensiSholatAccess::query()
            ->where('user_id', $guru->id)
            ->where('is_active', true)
            ->where(function ($query) {
                $query->where('can_input', true)->orWhere('can_view_rekap', true);
            })
            ->get();

        if ($accessRows->isEmpty()) {
            return [];
        }

        if ($accessRows->contains(fn ($row) => !$row->boarding_room_id && !$row->boarding_complex_id)) {
            return BoardingRoom::query()->pluck('id')->all();
        }

        $roomIds = $accessRows->pluck('boarding_room_id')->filter()->map(fn ($id) => (int) $id);
        $complexIds = $accessRows->whereNull('boarding_room_id')->pluck('boarding_complex_id')->filter();
        if ($complexIds->isNotEmpty()) {
            $roomIds = $roomIds->merge(
                BoardingRoom::query()->whereIn('boarding_complex_id', $complexIds)->pluck('id')->map(fn ($id) => (int) $id)
            );
        }

        return $roomIds->unique()->values()->all();
    }

    private function resolveAbsensiStatus(?string $inputVia): string
    {
        return $inputVia === 'offline' ? 'pending' : 'completed';
    }

    private function withPermissions(array $payload, User $actor): array
    {
        $payload['permissions'] = $this->permissionService->permissionsForUser($actor);
        $payload['notifications'] = [
            'unread_count' => AppNotification::query()
                ->where('user_id', $actor->id)
                ->where('is_read', false)
                ->count(),
        ];

        return $payload;
    }

}
