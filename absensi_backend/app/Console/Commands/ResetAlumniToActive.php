<?php

namespace App\Console\Commands;

use App\Models\Siswa;
use App\Services\ReferenceResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ResetAlumniToActive extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'santri:reset-alumni-to-active';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Memulihkan santri yang sempat berstatus Lulus (alumni) dari uji coba kembali menjadi Santri Aktif';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Memeriksa data santri berstatus Lulus...');

        $lulusStatusId = app(ReferenceResolver::class)->studentStatusId('Lulus');
        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif') ?? 1;

        $query = Siswa::query()->where(function ($q) use ($lulusStatusId) {
            $q->where('status', 'Lulus');
            if ($lulusStatusId) {
                $q->orWhere('student_status_id', $lulusStatusId);
            }
        });

        $count = $query->count();

        if ($count === 0) {
            $this->info('Tidak ada santri berstatus Lulus. Seluruh data sudah Aktif.');
            return Command::SUCCESS;
        }

        $this->warn("Ditemukan {$count} santri berstatus Lulus.");

        DB::transaction(function () use ($query, $activeStatusId) {
            $query->update([
                'status' => 'Aktif',
                'student_status_id' => $activeStatusId,
                'tanggal_lulus' => null,
                'tahun_lulus' => null,
                'nomor_ijazah' => null,
                'catatan_kelulusan' => null,
            ]);
        });

        $this->info("ALHAMDULILLAH! Sebanyak {$count} santri telah berhasil dipulihkan menjadi Santri Aktif 100%. Data alumni sekarang bersih.");

        return Command::SUCCESS;
    }
}
