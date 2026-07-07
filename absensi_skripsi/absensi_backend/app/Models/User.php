<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'username',
        'password',
        'password_hash',
        'role',
        'status',
        'status_aktif',
        'no_hp',
        'alamat',
    ];

    protected $hidden = [
        'password',
        'password_hash',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'status_aktif' => 'boolean',
            'locked_until' => 'datetime',
        ];
    }

    public function guru()
    {
        return $this->hasOne(Guru::class, 'id_user');
    }

    public function apiAccessTokens()
    {
        return $this->hasMany(ApiAccessToken::class);
    }
}
