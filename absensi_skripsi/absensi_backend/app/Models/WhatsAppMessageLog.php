<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsAppMessageLog extends Model
{
    protected $table = 'whatsapp_message_logs';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['next_retry_at' => 'datetime', 'sent_at' => 'datetime'];
    }

    public function detailPresensi()
    {
        return $this->belongsTo(DetailPresensi::class, 'id_detail_presensi');
    }
}
