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
    ];
}
