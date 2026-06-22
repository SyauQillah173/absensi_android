<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SantriPondok extends Model
{
    use SoftDeletes;

    protected $table = 'santri_pondok';

    protected $fillable = [
        'siswa_id',
        'boarding_complex_id',
        'boarding_room_id',
        'class_id',
        'status',
        'is_resident',
        'participates_prayer',
        'started_at',
        'ended_at',
        'notes',
    ];

    protected $casts = [
        'is_resident' => 'boolean',
        'participates_prayer' => 'boolean',
        'started_at' => 'date',
        'ended_at' => 'date',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }

    public function complex()
    {
        return $this->belongsTo(BoardingComplex::class, 'boarding_complex_id');
    }

    public function room()
    {
        return $this->belongsTo(BoardingRoom::class, 'boarding_room_id');
    }

    public function kelasRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }
}
