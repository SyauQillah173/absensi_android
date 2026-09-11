<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItSystemControl extends Model
{
    protected $table = 'it_system_controls';

    protected $fillable = [
        'key',
        'value',
        'description',
        'updated_by',
    ];

    protected $casts = [
        'value' => 'array',
    ];

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Dapatkan konfigurasi berdasarkan key dengan fallback default
     */
    public static function getByKey(string $key, array $default = []): array
    {
        $setting = static::where('key', $key)->first();
        if (!$setting || !is_array($setting->value)) {
            return $default;
        }

        return array_merge($default, $setting->value);
    }

    /**
     * Simpan / perbarui konfigurasi berdasarkan key
     */
    public static function setByKey(string $key, array $value, ?string $description = null, ?int $userId = null): self
    {
        return static::updateOrCreate(
            ['key' => $key],
            [
                'value'       => $value,
                'description' => $description,
                'updated_by'  => $userId ?: auth()->id(),
            ]
        );
    }
}
