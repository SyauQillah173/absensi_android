<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MataPelajaran extends Model
{
    protected $table = 'mata_pelajaran';

    protected $fillable = ['nama', 'kode', 'status'];

    public function jadwal()
    {
        return $this->hasMany(Jadwal::class, 'mapel_id');
    }

    public function nilai()
    {
        return $this->hasMany(Nilai::class, 'mapel_id');
    }

    /**
     * Many-to-many: guru yang mengajar mapel ini
     */
    public function guru()
    {
        return $this->belongsToMany(User::class, 'mapel_guru', 'mapel_id', 'user_id')
                    ->withTimestamps();
    }
}
