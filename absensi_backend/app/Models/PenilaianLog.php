<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PenilaianLog extends Model
{
    protected $table = 'penilaian_logs';

    protected $fillable = [
        'source_type',
        'source_id',
        'siswa_id',
        'siswa_nama',
        'kelas',
        'score_type',
        'item_label',
        'score_value',
        'predicate',
        'period_label',
        'actor_id',
        'actor_name',
        'actor_role',
        'action',
        'snapshot',
        'performed_at',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'performed_at' => 'datetime',
    ];

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public static function recordNilai(Nilai $nilai, User $actor, string $action): void
    {
        $nilai->loadMissing(['siswa:id,nama,kelas', 'mataPelajaran:id,nama']);

        static::create([
            'source_type' => 'nilai',
            'source_id' => $nilai->id,
            'siswa_id' => $nilai->siswa_id,
            'siswa_nama' => $nilai->siswa->nama ?? '-',
            'kelas' => $nilai->siswa->kelas ?? null,
            'score_type' => 'Nilai Pelajaran',
            'item_label' => trim(($nilai->mataPelajaran->nama ?? '-') . ' • ' . ($nilai->jenis_ujian ?? '-')),
            'score_value' => (string) $nilai->nilai,
            'predicate' => $nilai->grade,
            'period_label' => $nilai->semester ?? $nilai->tahun_ajaran,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role,
            'action' => $action,
            'snapshot' => [
                'jenis_ujian' => $nilai->jenis_ujian,
                'nilai' => $nilai->nilai,
                'grade' => $nilai->grade,
                'semester' => $nilai->semester,
                'tahun_ajaran' => $nilai->tahun_ajaran,
                'keterangan' => $nilai->keterangan,
            ],
            'performed_at' => now(),
        ]);
    }

    public static function recordHafalan(Hafalan $hafalan, User $actor, string $action): void
    {
        $hafalan->loadMissing(['siswa:id,nama,kelas']);

        $itemLabel = $hafalan->surah
            ? 'Surah ' . $hafalan->surah
            : ($hafalan->juz ? 'Juz ' . $hafalan->juz : 'Hafalan Al-Qur\'an');

        static::create([
            'source_type' => 'hafalan',
            'source_id' => $hafalan->id,
            'siswa_id' => $hafalan->siswa_id,
            'siswa_nama' => $hafalan->siswa->nama ?? '-',
            'kelas' => $hafalan->siswa->kelas ?? null,
            'score_type' => 'Nilai Hafalan',
            'item_label' => $itemLabel,
            'score_value' => (string) ($hafalan->nilai_hafalan ?? $hafalan->status ?? '-'),
            'predicate' => $hafalan->status,
            'period_label' => $hafalan->periode,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role,
            'action' => $action,
            'snapshot' => [
                'juz' => $hafalan->juz,
                'surah' => $hafalan->surah,
                'status' => $hafalan->status,
                'nilai_hafalan' => $hafalan->nilai_hafalan,
                'periode' => $hafalan->periode,
                'keterangan' => $hafalan->keterangan,
            ],
            'performed_at' => now(),
        ]);
    }
}
