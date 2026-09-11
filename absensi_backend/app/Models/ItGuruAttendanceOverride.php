<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItGuruAttendanceOverride extends Model
{
    protected $table = 'it_guru_attendance_overrides';

    protected $fillable = [
        'teacher_id',
        'jadwal_id',
        'open_lead_minutes',
        'custom_open_hour',
        'close_hour',
        'is_force_open',
        'is_force_locked',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'open_lead_minutes' => 'integer',
        'is_force_open'     => 'boolean',
        'is_force_locked'   => 'boolean',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function jadwal()
    {
        return $this->belongsTo(Jadwal::class, 'jadwal_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
