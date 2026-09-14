<?php

namespace App\Console\Commands;

use App\Models\PmbRegistration;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CleanupExpiredPmbRegistrations extends Command
{
    protected $signature = 'pmb:cleanup-expired {--days=365 : Hapus pendaftar yang belum diterima dan berusia lebih dari jumlah hari ini} {--force : Jalankan tanpa konfirmasi}';
    protected $description = 'Bersihkan berkas dan akun pendaftar PMB kadaluarsa (> 1 tahun) agar tidak membebani penyimpanan server';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $cutoffDate = now()->subDays($days);

        $this->info("Mencari pendaftar PMB kadaluarsa (dibuat sebelum {$cutoffDate->format('Y-m-d H:i')} dan belum diterima)...");

        $expiredQuery = PmbRegistration::query()
            ->where('is_converted', false)
            ->where('status', '!=', 'accepted')
            ->where('created_at', '<', $cutoffDate);

        $count = $expiredQuery->count();

        if ($count === 0) {
            $this->info("Tidak ditemukan data pendaftar kadaluarsa (> {$days} hari). Penyimpanan aman!");
            return 0;
        }

        if (!$this->option('force') && !$this->confirm("Ditemukan {$count} pendaftar kadaluarsa. Hapus permanen beserta berkas & akun login?")) {
            $this->comment('Pembersihan dibatalkan.');
            return 0;
        }

        $registrations = $expiredQuery->get();
        $deletedCount = 0;

        foreach ($registrations as $reg) {
            DB::transaction(function () use ($reg) {
                // Hapus berkas foto/kk/ijazah
                $files = array_filter([
                    $reg->dokumen_foto ? str_replace('/storage/', '', $reg->dokumen_foto) : null,
                    $reg->dokumen_kk ? str_replace('/storage/', '', $reg->dokumen_kk) : null,
                    $reg->dokumen_ijazah ? str_replace('/storage/', '', $reg->dokumen_ijazah) : null,
                ]);
                foreach ($files as $f) {
                    if (Storage::disk('public')->exists($f)) {
                        Storage::disk('public')->delete($f);
                    }
                }

                // Hapus user pendaftar
                if ($reg->user_id) {
                    User::where('id', $reg->user_id)->delete();
                }
                User::where('nis', $reg->registration_number)->delete();

                // Hapus registrasi
                $reg->delete();
            });

            $deletedCount++;
        }

        $this->info("Sukses membersihkan {$deletedCount} data pendaftar kadaluarsa dan menghemat kapasitas server!");
        return 0;
    }
}
