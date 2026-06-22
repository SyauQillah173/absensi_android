<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AbsensiNgaji extends Model
{
    protected $table = 'absensi_ngaji';

    protected $fillable = [
        'siswa_id',
        'santri_pondok_id',
        'ngaji_schedule_id',
        'ngaji_session_id',
        'ngaji_book_id',
        'boarding_complex_id',
        'boarding_room_id',
        'class_id',
        'tanggal',
        'status_code',
        'status_label',
        'keterangan',
        'attendance_key',
        'diinput_oleh',
        'actor_user_id',
        'diinput_via',
        'device_id',
        'synced_at',
        'is_cancelled',
        'cancelled_at',
        'cancelled_by',
        'cancel_reason',
    ];

    protected $casts = [
        'tanggal' => 'date',
        'synced_at' => 'datetime',
        'is_cancelled' => 'boolean',
        'cancelled_at' => 'datetime',
    ];

    public const STATUS_LABELS = [
        'H' => 'Hadir',
        'I' => 'Izin',
        'S' => 'Sakit',
        'A' => 'Alfa',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }

    public function santriPondok()
    {
        return $this->belongsTo(SantriPondok::class, 'santri_pondok_id')->withTrashed();
    }

    public function schedule()
    {
        return $this->belongsTo(NgajiSchedule::class, 'ngaji_schedule_id');
    }

    public function session()
    {
        return $this->belongsTo(NgajiSession::class, 'ngaji_session_id');
    }

    public function book()
    {
        return $this->belongsTo(NgajiBook::class, 'ngaji_book_id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    protected static function booted(): void
    {
        static::saving(function (AbsensiNgaji $absensi): void {
            $absensi->status_code = strtoupper(trim((string) $absensi->status_code));
            $absensi->status_label = self::STATUS_LABELS[$absensi->status_code] ?? $absensi->status_label;
            $absensi->attendance_key = self::buildAttendanceKey(
                $absensi->tanggal?->format('Y-m-d') ?? $absensi->tanggal,
                $absensi->siswa_id,
                $absensi->ngaji_schedule_id,
            );
        });
    }

    public static function buildAttendanceKey(mixed $tanggal, mixed $siswaId, mixed $scheduleId): ?string
    {
        $date = trim((string) $tanggal);
        if ($date === '' || !$siswaId || !$scheduleId) {
            return null;
        }

        return implode('_', [
            $date,
            (int) $scheduleId,
            (int) $siswaId,
        ]);
    }
}
