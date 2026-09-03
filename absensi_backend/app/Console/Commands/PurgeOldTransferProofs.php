<?php

namespace App\Console\Commands;

use App\Models\PaymentVerification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PurgeOldTransferProofs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'finance:purge-proofs
                            {--days=60 : Batas umur file dalam hari (default: 60 hari)}
                            {--status=disetujui,ditolak : Status verifikasi yang filenya boleh dibersihkan (pisahkan dengan koma)}
                            {--force : Jalankan tanpa konfirmasi interaktif}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Bersihkan file fisik foto bukti transfer lama yang sudah disetujui/ditolak untuk menghemat storage server';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = (int) $this->option('days');
        if ($days < 1) {
            $days = 60;
        }

        $statusList = array_filter(array_map('trim', explode(',', (string) $this->option('status'))));
        if (empty($statusList)) {
            $statusList = ['disetujui', 'ditolak'];
        }

        $thresholdDate = now()->subDays($days);

        $this->info("================================================================================");
        $this->info("  PEMBERSIHAN ARSIP FISIK FOTO BUKTI TRANSFER PESANTREN");
        $this->info("  Kebijakan Retensi: > {$days} hari (sebelum {$thresholdDate->format('d/m/Y H:i')})");
        $this->info("  Status Sasaran   : " . implode(', ', $statusList));
        $this->info("================================================================================");

        $candidates = PaymentVerification::query()
            ->whereIn('status', $statusList)
            ->where(function ($q) use ($thresholdDate) {
                $q->where('updated_at', '<=', $thresholdDate)
                  ->orWhere('verified_at', '<=', $thresholdDate);
            })
            ->whereNotNull('bukti_foto')
            ->where('bukti_foto', '!=', '')
            ->where('bukti_foto', '!=', 'purged')
            ->get();

        $count = $candidates->count();

        if ($count === 0) {
            $this->info("Tidak ada file bukti transfer lama yang memenuhi kriteria retensi. Storage server aman terkendali!");
            return Command::SUCCESS;
        }

        $this->comment("Ditemukan {$count} rekaman bukti transfer yang siap dibersihkan dari storage.");

        if (!$this->option('force') && !$this->confirm("Apakah Anda yakin ingin menghapus {$count} file foto fisik dari disk server? (Catatan transaksi dan kwitansi tetap aman di database)")) {
            $this->warn("Operasi dibatalkan oleh pengguna.");
            return Command::SUCCESS;
        }

        $deletedFiles = 0;
        $missingFiles = 0;
        $freedBytes = 0;

        $bar = $this->output->createProgressBar($count);
        $bar->start();

        foreach ($candidates as $item) {
            $path = $item->bukti_foto;

            if (Storage::disk('public')->exists($path)) {
                $size = (int) Storage::disk('public')->size($path);
                Storage::disk('public')->delete($path);
                $freedBytes += $size;
                $deletedFiles++;
            } else {
                $missingFiles++;
            }

            // Tandai bahwa file fisik telah dibersihkan secara sah sesuai kebijakan retensi
            $item->update([
                'bukti_foto' => 'purged',
            ]);

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $freedMb = round($freedBytes / (1024 * 1024), 2);

        $this->table(
            ['Metrik', 'Hasil'],
            [
                ['File Fisik Dihapus', "{$deletedFiles} file"],
                ['File Fisik Sudah Hilang Sebelumnya', "{$missingFiles} file"],
                ['Total Baris Diperbarui', "{$count} rekaman (status: purged)"],
                ['Ruang Disk Server Dihemat', "{$freedMb} MB (" . number_format($freedBytes) . " bytes)"],
            ]
        );

        $this->info("Alhamdulillah! Pembersihan arsip bukti transfer selesai dengan sukses.");
        return Command::SUCCESS;
    }
}
