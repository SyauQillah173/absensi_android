<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AbsensiSholat extends Model
{
    protected $table = 'absensi_sholat';

    protected $fillable = [
        'siswa_id',
        'santri_pondok_id',
        'boarding_room_id',
        'prayer_attendance_type_id',
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
        'M' => 'Masuk',
        'I' => 'Izin',
        'S' => 'Sakit',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }

    public function santriPondok()
    {
        return $this->belongsTo(SantriPondok::class, 'santri_pondok_id')->withTrashed();
    }

    public function boardingRoom()
    {
        return $this->belongsTo(BoardingRoom::class, 'boarding_room_id');
    }

    public function prayerType()
    {
        return $this->belongsTo(PrayerAttendanceType::class, 'prayer_attendance_type_id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    protected static function booted(): void
    {
        static::saving(function (AbsensiSholat $absensi): void {
            $absensi->status_code = strtoupper(trim((string) $absensi->status_code));
            $absensi->status_label = self::STATUS_LABELS[$absensi->status_code] ?? $absensi->status_label;
            $absensi->attendance_key = self::buildAttendanceKey(
                $absensi->tanggal?->format('Y-m-d') ?? $absensi->tanggal,
                $absensi->siswa_id,
                $absensi->boarding_room_id,
                $absensi->prayer_attendance_type_id,
            );
        });
    }

    public static function buildAttendanceKey(mixed $tanggal, mixed $siswaId, mixed $roomId, mixed $prayerTypeId = null): ?string
    {
        $date = trim((string) $tanggal);
        if ($date === '' || !$siswaId) {
            return null;
        }

        return implode('_', [
            $date,
            (int) $siswaId,
            (int) ($roomId ?: 0),
            (int) ($prayerTypeId ?: 0),
        ]);
    }
}
