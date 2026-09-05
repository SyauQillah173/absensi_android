<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PmbCmsSetting extends Model
{
    use HasFactory;

    protected $table = 'pmb_cms_settings';

    protected $fillable = [
        'key',
        'group',
        'label',
        'value',
        'type',
    ];

    public static function getValue(string $key, $default = null)
    {
        $setting = static::where('key', $key)->first();
        if (!$setting) {
            return $default;
        }

        if ($setting->type === 'boolean') {
            return filter_var($setting->value, FILTER_VALIDATE_BOOLEAN);
        }

        if ($setting->type === 'json') {
            return json_decode($setting->value, true) ?: $default;
        }

        return $setting->value ?? $default;
    }

    public static function setValue(string $key, $value, ?string $group = 'general', ?string $label = null, string $type = 'text'): self
    {
        if (is_array($value) || is_object($value)) {
            $formattedValue = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $type = 'json';
        } elseif (is_bool($value)) {
            $formattedValue = $value ? '1' : '0';
            $type = 'boolean';
        } else {
            $formattedValue = (string)$value;
        }

        $setting = static::firstOrNew(['key' => $key]);
        $setting->value = $formattedValue;
        $setting->type = $type;
        if ($group) {
            $setting->group = $group;
        }
        if ($label && empty($setting->label)) {
            $setting->label = $label;
        }
        $setting->save();

        return $setting;
    }
}
