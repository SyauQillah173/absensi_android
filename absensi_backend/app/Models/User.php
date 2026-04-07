<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'role',
        'nis',
        'nisn',
        'password',
        'foto_profil',
        'no_hp',
        'jenis_kelamin',
        'nik_user',
        'status',
        'kode_guru',
        'alamat',
        'unit_kerja',
        'kategori_guru',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'unit_kerja' => 'array',
            'kategori_guru' => 'array',
        ];
    }

    /**
     * Relasi: Orang tua punya banyak anak (siswa)
     * Hanya dipakai untuk role 'wali'
     */
    public function anak()
    {
        return $this->hasMany(Siswa::class, 'wali_id');
    }
}
