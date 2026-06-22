<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Services\ReferenceResolver;
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
        'role_id',
        'admin_type',
        'nis',
        'nisn',
        'password',
        'password_default_encrypted',
        'password_current_encrypted',
        'password_changed_at',
        'foto_profil',
        'no_hp',
        'jenis_kelamin',
        'nik_user',
        'status',
        'user_status_id',
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
        'password_default_encrypted',
        'password_current_encrypted',
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
            'password_changed_at' => 'datetime',
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

    public function roleRef()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function statusRef()
    {
        return $this->belongsTo(UserStatus::class, 'user_status_id');
    }

    public function teacherProfile()
    {
        return $this->hasOne(TeacherProfile::class);
    }

    public function paymentSecuritySetting()
    {
        return $this->hasOne(AdminPaymentSecuritySetting::class);
    }

    public function notifications()
    {
        return $this->hasMany(AppNotification::class);
    }

    public function guruAbsensiSholatAccess()
    {
        return $this->hasMany(GuruAbsensiSholatAccess::class);
    }

    public function apiAccessTokens()
    {
        return $this->hasMany(ApiAccessToken::class);
    }

    protected static function booted(): void
    {
        static::saving(function (User $user): void {
            $resolver = app(ReferenceResolver::class);
            $user->role_id = $user->role_id ?: $resolver->roleId($user->role);
            $user->user_status_id = $user->user_status_id ?: $resolver->userStatusId($user->status);
            $user->role = $resolver->nameById('roles', $user->role_id, 'code') ?? $user->role;
            $user->status = $resolver->nameById('user_statuses', $user->user_status_id) ?? $user->status;
            if ($user->role === 'admin') {
                $user->admin_type = $user->admin_type ?: 'utama';
            } else {
                $user->admin_type = null;
            }
        });

        static::saved(function (User $user): void {
            app(ReferenceResolver::class)->ensureTeacherProfile($user);
        });
    }
}
