<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NgajiSchedule extends Model
{
    protected $fillable = [
        'ngaji_session_id',
        'ngaji_book_id',
        'teacher_id',
        'boarding_complex_id',
        'boarding_room_id',
        'class_id',
        'day_id',
        'start_time',
        'end_time',
        'status',
        'description',
    ];

    public function session()
    {
        return $this->belongsTo(NgajiSession::class, 'ngaji_session_id');
    }

    public function book()
    {
        return $this->belongsTo(NgajiBook::class, 'ngaji_book_id');
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function complex()
    {
        return $this->belongsTo(BoardingComplex::class, 'boarding_complex_id');
    }

    public function room()
    {
        return $this->belongsTo(BoardingRoom::class, 'boarding_room_id');
    }

    public function classRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function day()
    {
        return $this->belongsTo(Day::class, 'day_id');
    }
}
