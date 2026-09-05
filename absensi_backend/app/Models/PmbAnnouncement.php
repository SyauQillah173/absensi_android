<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class PmbAnnouncement extends Model
{
    use HasFactory;

    protected $table = 'pmb_announcements';

    protected $fillable = [
        'title',
        'slug',
        'content',
        'category',
        'event_date',
        'is_pinned',
        'is_published',
        'author_id',
    ];

    protected $casts = [
        'event_date' => 'datetime',
        'is_pinned' => 'boolean',
        'is_published' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($announcement) {
            if (empty($announcement->slug)) {
                $announcement->slug = Str::slug($announcement->title) . '-' . Str::random(5);
            }
        });
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
