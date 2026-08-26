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

            if ($user->isDirty('role_id') && $user->role_id) {
                $user->role = $resolver->nameById('roles', $user->role_id, 'code') ?? $user->role;
            } elseif ($user->isDirty('role') || !$user->role_id) {
                $user->role_id = $resolver->roleId($user->role) ?? $user->role_id;
                $user->role = $resolver->nameById('roles', $user->role_id, 'code') ?? $user->role;
            }

            if ($user->isDirty('user_status_id') && $user->user_status_id) {
                $user->status = $resolver->nameById('user_statuses', $user->user_status_id) ?? $user->status;
            } elseif ($user->isDirty('status') || !$user->user_status_id) {
                $statusId = $resolver->userStatusId($user->status);
                if ($statusId) {
                    $user->user_status_id = $statusId;
                    $user->status = $resolver->nameById('user_statuses', $statusId) ?? $user->status;
                }
            }

            if ($user->role === 'admin') {
                $user->admin_type = $user->admin_type ?: 'utama';
            } elseif ($user->role === 'guru') {
                $user->admin_type = $user->admin_type ?: 'umum';
            } else {
                $user->admin_type = null;
            }
        });

        static::saved(function (User $user): void {
            app(ReferenceResolver::class)->ensureTeacherProfile($user);
        });
    }
}
