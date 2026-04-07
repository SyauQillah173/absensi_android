<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Siswa;
use Illuminate\Http\Request;

class SiswaController extends Controller
{
    public function index(Request $request)
    {
        $query = Siswa::query();

        if ($request->boolean('with_wali')) {
            $query->with(['wali:id,name,email,no_hp,status']);
        }

        if ($request->has('kelas')) {
            $query->where('kelas', $request->kelas);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('search')) {
            $query->where('nama', 'ilike', '%' . $request->search . '%');
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('nama')->get(),
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
            'status' => 'required|in:Aktif,Nonaktif',
            'alamat' => 'nullable|string',
            'kewarganegaraan' => 'nullable|string',
            'provinsi' => 'nullable|string',
            'kota' => 'nullable|string',
            'kecamatan' => 'nullable|string',
            'kelurahan' => 'nullable|string',
            'kode_pos' => 'nullable|string|max:5',
            'no_whatsapp' => 'nullable|string|max:20',
            'email_siswa' => 'nullable|string|email',
            'asal_sekolah' => 'nullable|string',
            'tahun_lulus' => 'nullable|string|max:4',
            'tahun_akademik_masuk' => 'nullable|string',
            'jenis_santri' => 'nullable|string',
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
            'pendidikan_ibu' => 'nullable|string',
            'pekerjaan_ayah' => 'nullable|string',
            'penghasilan_ayah' => 'nullable|string',
            'pekerjaan_ibu' => 'nullable|string',
            'penghasilan_ibu' => 'nullable|string',
            'alamat_ayah' => 'nullable|string',
            'alamat_ibu' => 'nullable|string',
            'no_ayah' => 'nullable|string',
            'no_whatsapp_ayah' => 'nullable|string|max:20',
            'no_ibu' => 'nullable|string',
            'no_whatsapp_ibu' => 'nullable|string|max:20',
            'nama_wali_keluarga' => 'nullable|string',
            'pekerjaan_wali_keluarga' => 'nullable|string',
            'alamat_wali_keluarga' => 'nullable|string',
            'wali_sama_dengan' => 'nullable|string',
            'tanggal_masuk' => 'nullable|date',
            'tempat_tinggal' => 'nullable|string',
            'transportasi' => 'nullable|string',
            'tinggi_badan' => 'nullable|string',
            'berat_badan' => 'nullable|string',
            'golongan_darah' => 'nullable|string',
            'foto_santri' => 'nullable|string',
            'catatan_santri' => 'nullable|string',
        ]);

        $siswa = Siswa::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil ditambahkan',
            'data' => $siswa,
        ], 201);
    }

    public function show(Siswa $siswa)
    {
        return response()->json([
            'success' => true,
            'data' => $siswa->load(['absensi', 'pembayaran', 'nilai', 'kelompokBelajar']),
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
            'status' => 'sometimes|in:Aktif,Nonaktif',
            'alamat' => 'nullable|string',
            'kewarganegaraan' => 'nullable|string',
            'provinsi' => 'nullable|string',
            'kota' => 'nullable|string',
            'kecamatan' => 'nullable|string',
            'kelurahan' => 'nullable|string',
            'kode_pos' => 'nullable|string|max:5',
            'no_whatsapp' => 'nullable|string|max:20',
            'email_siswa' => 'nullable|string|email',
            'asal_sekolah' => 'nullable|string',
            'tahun_lulus' => 'nullable|string|max:4',
            'tahun_akademik_masuk' => 'nullable|string',
            'jenis_santri' => 'nullable|string',
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
            'pendidikan_ibu' => 'nullable|string',
            'pekerjaan_ayah' => 'nullable|string',
            'penghasilan_ayah' => 'nullable|string',
            'pekerjaan_ibu' => 'nullable|string',
            'penghasilan_ibu' => 'nullable|string',
            'alamat_ayah' => 'nullable|string',
            'alamat_ibu' => 'nullable|string',
            'no_ayah' => 'nullable|string',
            'no_whatsapp_ayah' => 'nullable|string|max:20',
            'no_ibu' => 'nullable|string',
            'no_whatsapp_ibu' => 'nullable|string|max:20',
            'nama_wali_keluarga' => 'nullable|string',
            'pekerjaan_wali_keluarga' => 'nullable|string',
            'alamat_wali_keluarga' => 'nullable|string',
            'wali_sama_dengan' => 'nullable|string',
            'tanggal_masuk' => 'nullable|date',
            'tempat_tinggal' => 'nullable|string',
            'transportasi' => 'nullable|string',
            'tinggi_badan' => 'nullable|string',
            'berat_badan' => 'nullable|string',
            'golongan_darah' => 'nullable|string',
            'foto_santri' => 'nullable|string',
            'catatan_santri' => 'nullable|string',
        ]);

        $siswa->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil diupdate',
            'data' => $siswa,
        ]);
    }

    public function destroy(Siswa $siswa)
    {
        $siswa->delete();

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil dihapus',
        ]);
    }

    // Upload dokumen akta atau foto santri
    public function uploadFile(Request $request)
    {
        $request->validate([
            'file' => 'required|file|max:5120', // max 5MB
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
}
