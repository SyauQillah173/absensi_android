<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Guru;
use App\Models\Kelas;
use App\Models\MataPelajaran;
use App\Models\Santri;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ThesisMasterController extends Controller
{
    public function bootstrap(Request $request)
    {
        $kelas = $this->kelasQuery($request)->with('guru:id_guru,nama_guru')->get();
        $kelasIds = $kelas->pluck('id_kelas');

        return response()->json([
            'success' => true,
            'data' => [
                'guru' => $request->user()->role === 'admin'
                    ? Guru::with('user:id,username,role')->orderBy('nama_guru')->get()
                    : Guru::where('id_user', $request->user()->id)->get(),
                'kelas' => $kelas,
                'mata_pelajaran' => MataPelajaran::query()
                    ->where('status', 'Aktif')
                    ->orderBy('nama')
                    ->get(['id', 'nama', 'kode', 'status']),
                'santri' => Santri::whereIn('id_kelas', $kelasIds)->orderBy('nama_santri')->get(),
                'server_time' => now()->toIso8601String(),
            ],
        ]);
    }

    public function guruIndex()
    {
        return response()->json(['success' => true, 'data' => Guru::with('user:id,username,role')->orderBy('nama_guru')->get()]);
    }

    public function guruStore(Request $request)
    {
        $data = $request->validate([
            'username' => 'required|string|max:100|unique:users,username',
            'password' => 'required|string|min:8',
            'nama_guru' => 'required|string|max:255',
            'nip_nidm' => 'nullable|string|max:60|unique:guru,nip_nidm',
            'nomor_hp' => ['required', 'string', 'max:20', 'regex:/^(\\+62|62|08)[0-9]{8,13}$/'],
            'alamat' => 'nullable|string',
        ]);

        $guru = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['nama_guru'],
                'email' => $data['username'].'@skripsi.local',
                'username' => $data['username'],
                'password' => Hash::make($data['password']),
                'password_hash' => Hash::make($data['password']),
                'role' => 'guru',
                'status' => 'Aktif',
                'status_aktif' => true,
            ]);

            return Guru::create([
                'id_user' => $user->id,
                'nama_guru' => $data['nama_guru'],
                'nip_nidm' => $data['nip_nidm'] ?? null,
                'nomor_hp' => $this->normalizePhone($data['nomor_hp']),
                'alamat' => $data['alamat'] ?? null,
                'status_aktif' => true,
            ])->load('user:id,username,role');
        });

        return response()->json(['success' => true, 'data' => $guru], 201);
    }

    public function guruUpdate(Request $request, Guru $guru)
    {
        $data = $request->validate([
            'username' => ['sometimes', 'string', 'max:100', Rule::unique('users', 'username')->ignore($guru->id_user)],
            'password' => 'nullable|string|min:8',
            'nama_guru' => 'sometimes|required|string|max:255',
            'nip_nidm' => ['nullable', 'string', 'max:60', Rule::unique('guru', 'nip_nidm')->ignore($guru->id_guru, 'id_guru')],
            'nomor_hp' => ['sometimes', 'required', 'string', 'max:20', 'regex:/^(\\+62|62|08)[0-9]{8,13}$/'],
            'alamat' => 'nullable|string',
            'status_aktif' => 'sometimes|boolean',
        ]);

        DB::transaction(function () use ($guru, $data): void {
            $guru->update(array_filter([
                'nama_guru' => $data['nama_guru'] ?? null,
                'nip_nidm' => $data['nip_nidm'] ?? null,
                'nomor_hp' => isset($data['nomor_hp']) ? $this->normalizePhone($data['nomor_hp']) : null,
                'alamat' => $data['alamat'] ?? null,
                'status_aktif' => $data['status_aktif'] ?? null,
            ], fn ($value) => $value !== null));
            $userData = array_filter([
                'name' => $data['nama_guru'] ?? null,
                'username' => $data['username'] ?? null,
                'status_aktif' => $data['status_aktif'] ?? null,
            ], fn ($value) => $value !== null);
            if (!empty($data['password'])) {
                $userData['password'] = Hash::make($data['password']);
                $userData['password_hash'] = $userData['password'];
            }
            $guru->user()->update($userData);
        });

        return response()->json(['success' => true, 'data' => $guru->fresh('user:id,username,role')]);
    }

    public function guruDestroy(Guru $guru)
    {
        if ($guru->kelas()->exists()) {
            $guru->update(['status_aktif' => false]);
            $guru->user()->update(['status_aktif' => false, 'status' => 'Nonaktif']);
            return response()->json(['success' => true, 'message' => 'Guru dinonaktifkan karena memiliki kelas.']);
        }
        $guru->user()->delete();

        return response()->json(['success' => true, 'message' => 'Guru dihapus.']);
    }

    public function kelasIndex(Request $request)
    {
        return response()->json(['success' => true, 'data' => $this->kelasQuery($request)->with('guru:id_guru,nama_guru')->orderBy('tingkat')->get()]);
    }

    public function kelasStore(Request $request)
    {
        $data = $request->validate([
            'id_guru' => 'required|exists:guru,id_guru',
            'nama_kelas' => 'required|string|max:100|unique:kelas,nama_kelas',
            'tingkat' => 'required|integer|min:1|max:12',
        ]);

        return response()->json(['success' => true, 'data' => Kelas::create($data + ['status_aktif' => true])], 201);
    }

    public function kelasUpdate(Request $request, Kelas $kelas)
    {
        $data = $request->validate([
            'id_guru' => 'sometimes|required|exists:guru,id_guru',
            'nama_kelas' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('kelas', 'nama_kelas')->ignore($kelas->id_kelas, 'id_kelas')],
            'tingkat' => 'sometimes|required|integer|min:1|max:12',
            'status_aktif' => 'sometimes|boolean',
        ]);
        $kelas->update($data);

        return response()->json(['success' => true, 'data' => $kelas->fresh('guru:id_guru,nama_guru')]);
    }

    public function kelasDestroy(Kelas $kelas)
    {
        if ($kelas->santri()->exists() || DB::table('presensi')->where('id_kelas', $kelas->id_kelas)->exists()) {
            $kelas->update(['status_aktif' => false]);
            return response()->json(['success' => true, 'message' => 'Kelas dinonaktifkan karena sudah memiliki data.']);
        }
        $kelas->delete();

        return response()->json(['success' => true, 'message' => 'Kelas dihapus.']);
    }

    public function santriIndex(Request $request)
    {
        $query = Santri::with('kelas:id_kelas,nama_kelas,id_guru')->orderBy('nama_santri');
        $allowed = $this->kelasQuery($request)->pluck('id_kelas');
        if ($request->filled('id_kelas')) {
            $query->where('id_kelas', $request->integer('id_kelas'));
        }

        return response()->json(['success' => true, 'data' => $query->whereIn('id_kelas', $allowed)->get()]);
    }

    public function mapelIndex()
    {
        return response()->json([
            'success' => true,
            'data' => MataPelajaran::query()
                ->orderByRaw("CASE WHEN status = 'Aktif' THEN 0 ELSE 1 END")
                ->orderBy('nama')
                ->get(['id', 'nama', 'kode', 'status']),
        ]);
    }

    public function mapelStore(Request $request)
    {
        $data = $request->validate([
            'nama' => 'required|string|max:120|unique:mata_pelajaran,nama',
            'kode' => 'nullable|string|max:20',
            'status' => 'nullable|in:Aktif,Nonaktif',
        ]);

        return response()->json([
            'success' => true,
            'data' => MataPelajaran::query()->create($data + ['status' => 'Aktif']),
        ], 201);
    }

    public function mapelUpdate(Request $request, MataPelajaran $mataPelajaran)
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'required', 'string', 'max:120', Rule::unique('mata_pelajaran', 'nama')->ignore($mataPelajaran->id)],
            'kode' => 'nullable|string|max:20',
            'status' => 'sometimes|in:Aktif,Nonaktif',
        ]);

        $mataPelajaran->update($data);

        return response()->json(['success' => true, 'data' => $mataPelajaran->fresh()]);
    }

    public function mapelDestroy(MataPelajaran $mataPelajaran)
    {
        $mataPelajaran->update(['status' => 'Nonaktif']);

        return response()->json(['success' => true, 'message' => 'Mata pelajaran dinonaktifkan.']);
    }

    public function santriStore(Request $request)
    {
        $data = $this->validateSantri($request);
        $data['nomor_wa_wali'] = $this->normalizePhone($data['nomor_wa_wali']);

        return response()->json(['success' => true, 'data' => Santri::create($data + ['status_aktif' => true])], 201);
    }

    public function santriUpdate(Request $request, Santri $santri)
    {
        $data = $this->validateSantri($request, $santri);
        if (isset($data['nomor_wa_wali'])) {
            $data['nomor_wa_wali'] = $this->normalizePhone($data['nomor_wa_wali']);
        }
        $santri->update($data);

        return response()->json(['success' => true, 'data' => $santri->fresh('kelas:id_kelas,nama_kelas')]);
    }

    public function santriDestroy(Santri $santri)
    {
        if (DB::table('detail_presensi')->where('id_santri', $santri->id_santri)->exists()) {
            $santri->update(['status_aktif' => false]);
            return response()->json(['success' => true, 'message' => 'Santri dinonaktifkan karena memiliki riwayat presensi.']);
        }
        $santri->delete();

        return response()->json(['success' => true, 'message' => 'Santri dihapus.']);
    }

    private function kelasQuery(Request $request)
    {
        $query = Kelas::query();
        if ($request->user()->role === 'guru') {
            $query->where('id_guru', $request->user()->guru?->id_guru ?? 0);
        }

        return $query;
    }

    private function validateSantri(Request $request, ?Santri $santri = null): array
    {
        $sometimes = $santri ? 'sometimes|' : '';

        return $request->validate([
            'id_kelas' => $sometimes.'required|exists:kelas,id_kelas',
            'nisn' => [$santri ? 'sometimes' : 'required', 'string', 'max:30', Rule::unique('santri', 'nisn')->ignore($santri?->id_santri, 'id_santri')],
            'nama_santri' => $sometimes.'required|string|max:255',
            'jenis_kelamin' => $sometimes.'required|in:L,P',
            'tgl_lahir' => 'nullable|date|before_or_equal:today',
            'alamat' => 'nullable|string',
            'nama_wali' => $sometimes.'required|string|max:255',
            'nomor_wa_wali' => [$santri ? 'sometimes' : 'required', 'string', 'max:20', 'regex:/^(\\+62|62|08)[0-9]{8,13}$/'],
            'status_aktif' => 'sometimes|boolean',
        ]);
    }

    private function normalizePhone(string $phone): string
    {
        $phone = preg_replace('/\D+/', '', $phone);
        if (str_starts_with($phone, '0')) {
            $phone = '62'.substr($phone, 1);
        }

        return $phone;
    }
}
