<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Absensi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AbsensiController extends Controller
{
    // GET /api/absensi — list absensi (default: hari ini)
    public function index(Request $request)
    {
        $query = Absensi::with('siswa');

        if ($request->has('tanggal')) {
            $query->where('tanggal', $request->tanggal);
        } else {
            $query->where('tanggal', now()->toDateString());
        }
        if ($request->has('kelas')) {
            $query->where('kelas', $request->kelas);
        }
        if ($request->has('mapel')) {
            $query->where('mapel', $request->mapel);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $data = $query->orderBy('created_at', 'desc')->get();

        $stats = [
            'total' => $data->count(),
            'hadir' => $data->where('status', 'Hadir')->count(),
            'izin' => $data->where('status', 'Izin')->count(),
            'sakit' => $data->where('status', 'Sakit')->count(),
            'alfa' => $data->where('status', 'Alfa')->count(),
        ];

        return response()->json([
            'success' => true,
            'stats' => $stats,
            'data' => $data,
        ]);
    }

    // POST /api/absensi — input absensi 1 siswa (dengan pengecekan duplikat)
    public function store(Request $request)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|exists:siswa,id',
            'tanggal' => 'required|date',
            'status' => 'required|in:Hadir,Izin,Sakit,Alfa',
            'keterangan' => 'nullable|string',
            'kelas' => 'nullable|string',
            'mapel' => 'nullable|string',
            'diinput_oleh' => 'nullable|string',
            'diinput_via' => 'nullable|in:online,offline_sync',
            'device_id' => 'nullable|string',
        ]);

        // Cek apakah sudah ada absensi untuk siswa ini di tanggal, kelas, DAN mapel yang sama
        $existing = Absensi::where('siswa_id', $validated['siswa_id'])
            ->where('tanggal', $validated['tanggal'])
            ->where('kelas', $validated['kelas'] ?? null)
            ->where('mapel', $validated['mapel'] ?? null)
            ->first();

        if ($existing) {
            // Sudah ada! Anti-duplikat — kasih info detail siapa yang input
            return response()->json([
                'success' => false,
                'conflict' => true,
                'message' => 'Absensi ' . ($existing->kelas ?? '') . ' — ' . ($existing->mapel ?? 'Umum') . ' sudah diinput oleh ' . ($existing->diinput_oleh ?? 'sistem') . ' pada ' . $existing->created_at->format('H:i'),
                'existing_data' => $existing->load('siswa'),
            ], 409); // 409 = Conflict
        }

        $validated['synced_at'] = now();
        $absensi = Absensi::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Absensi berhasil dicatat',
            'data' => $absensi->load('siswa'),
        ], 201);
    }

    // POST /api/absensi/bulk — input absensi banyak siswa sekaligus
    public function storeBulk(Request $request)
    {
        $validated = $request->validate([
            'absensi' => 'required|array',
            'absensi.*.siswa_id' => 'required|exists:siswa,id',
            'absensi.*.tanggal' => 'required|date',
            'absensi.*.status' => 'required|in:Hadir,Izin,Sakit,Alfa',
            'absensi.*.keterangan' => 'nullable|string',
            'absensi.*.kelas' => 'nullable|string',
            'absensi.*.mapel' => 'nullable|string',
            'absensi.*.diinput_oleh' => 'nullable|string',
            'absensi.*.diinput_via' => 'nullable|in:online,offline_sync',
            'absensi.*.device_id' => 'nullable|string',
        ]);

        $created = [];
        $conflicts = [];

        foreach ($validated['absensi'] as $item) {
            // Cek duplikat (including mapel)
            $existing = Absensi::where('siswa_id', $item['siswa_id'])
                ->where('tanggal', $item['tanggal'])
                ->where('kelas', $item['kelas'] ?? null)
                ->where('mapel', $item['mapel'] ?? null)
                ->first();

            if ($existing) {
                $conflicts[] = [
                    'siswa_id' => $item['siswa_id'],
                    'message' => 'Sudah diinput oleh ' . ($existing->diinput_oleh ?? 'sistem'),
                ];
                continue;
            }

            $item['synced_at'] = now();
            $created[] = Absensi::create($item);
        }

        return response()->json([
            'success' => true,
            'message' => count($created) . ' absensi berhasil, ' . count($conflicts) . ' sudah ada',
            'created' => $created,
            'conflicts' => $conflicts,
        ], 201);
    }

    // PUT /api/absensi/{id} — update status absensi
    public function update(Request $request, Absensi $absensi)
    {
        $validated = $request->validate([
            'status' => 'sometimes|in:Hadir,Izin,Sakit,Alfa',
            'keterangan' => 'nullable|string',
            'diinput_oleh' => 'nullable|string',
            'actor_role' => 'nullable|string',
            'actor_name' => 'nullable|string',
        ]);

        $actorRole = strtolower($validated['actor_role'] ?? '');
        $actorName = $validated['actor_name'] ?? '';

        if ($actorRole !== 'admin' && $absensi->diinput_oleh !== $actorName) {
            return response()->json([
                'success' => false,
                'message' => 'Anda hanya bisa mengubah absensi milik sendiri',
            ], 403);
        }

        unset($validated['actor_role'], $validated['actor_name']);

        $absensi->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Absensi berhasil diupdate',
            'data' => $absensi->load('siswa'),
        ]);
    }

    // DELETE /api/absensi/{id} — batalkan absensi
    public function destroy(Request $request, Absensi $absensi)
    {
        $actorRole = strtolower($request->query('actor_role', ''));
        $actorName = $request->query('actor_name', '');

        if ($actorRole !== 'admin' && $absensi->diinput_oleh !== $actorName) {
            return response()->json([
                'success' => false,
                'message' => 'Anda hanya bisa membatalkan absensi milik sendiri',
            ], 403);
        }

        $nama = $absensi->siswa ? $absensi->siswa->nama : 'Siswa';
        $absensi->delete();

        return response()->json([
            'success' => true,
            'message' => "Absensi $nama berhasil dibatalkan",
        ]);
    }

    // GET /api/absensi/rekap — rekap absensi per bulan
    public function rekap(Request $request)
    {
        $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer',
            'kelas' => 'nullable|string',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date',
        ]);

        $bulan = $request->bulan;
        $tahun = $request->tahun;

        $query = Absensi::with('siswa')
            ->whereMonth('tanggal', $bulan)
            ->whereYear('tanggal', $tahun);

        if ($request->has('kelas')) {
            $query->where('kelas', $request->kelas);
        }

        // Optional date range filter
        if ($request->tanggal_mulai) {
            $query->where('tanggal', '>=', $request->tanggal_mulai);
        }
        if ($request->tanggal_akhir) {
            $query->where('tanggal', '<=', $request->tanggal_akhir);
        }

        $data = $query->orderBy('tanggal')->get();

        // Group by siswa + mapel (so each mapel gets its own row)
        $grouped = $data->groupBy(function ($item) {
            return $item->siswa_id . '_' . ($item->mapel ?? 'umum');
        })->map(function ($items) {
            $siswa = $items->first()->siswa;
            return [
                'siswa' => $siswa,
                'kelas' => $items->first()->kelas ?? ($siswa ? $siswa->kelas : '-'),
                'mapel' => $items->first()->mapel ?? '-',
                'absensi' => $items->map(function ($a) {
                    return [
                        'tanggal' => $a->tanggal->format('Y-m-d'),
                        'hari' => $a->tanggal->format('d'),
                        'status' => $a->status,
                    ];
                })->values(),
                'total_hadir' => $items->where('status', 'Hadir')->count(),
                'total_izin' => $items->where('status', 'Izin')->count(),
                'total_sakit' => $items->where('status', 'Sakit')->count(),
                'total_alfa' => $items->where('status', 'Alfa')->count(),
                'diinput_oleh' => $items->last()->diinput_oleh ?? 'Admin',
            ];
        })->values();

        return response()->json([
            'success' => true,
            'bulan' => $bulan,
            'tahun' => $tahun,
            'data' => $grouped,
        ]);
    }
}
