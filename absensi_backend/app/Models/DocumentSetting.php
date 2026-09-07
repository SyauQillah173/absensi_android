<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentSetting extends Model
{
    protected $table = 'document_settings';

    protected $fillable = [
        'kepala_madin_nama',
        'jabatan',
        'signature_mode',
        'signature_path',
        'document_logo_path',
        'payment_admin_name',
        'payment_admin_title',
        'payment_signature_mode',
        'payment_signature_path',
        'receipt_width',
        'bank_name',
        'bank_code',
        'bank_account_number',
        'bank_account_holder',
        'bank_sub_name',
    ];

    public function getInstitutionNameAttribute(): string
    {
        $name = trim((string) ($this->attributes['payment_admin_name'] ?? ''));
        if ($name === '' || strtoupper($name) === "MTS ASSA'ADAH II") {
            return 'YAYASAN PONDOK PESANTREN QOMARUDDIN';
        }
        return $name;
    }

    public function getInstitutionAddressAttribute(): string
    {
        $addr = trim((string) ($this->attributes['payment_admin_title'] ?? ''));
        if ($addr === '' || stripos($addr, 'MTS') !== false) {
            return 'JL. MASJID KIYAI GEDE BUNGAH GRESIK';
        }
        return $addr;
    }
}
