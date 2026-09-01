<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class FixGuruGender extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'guru:fix-gender {--force : Update automatically without prompt}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Otomatisasi deteksi dan sinkronisasi jenis kelamin Guru/Pengajar (Ustadz vs Ustadzah)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("=================================================================");
        $this->info("     🧕 SINKRONISASI OTOMATIS GENDER GURU: USTADZ VS USTADZAH    ");
        $this->info("=================================================================");

        $gurus = User::where('role', 'guru')->get();
        $updatedFemale = 0;
        $updatedMale = 0;

        foreach ($gurus as $g) {
            $nameUpper = strtoupper(trim((string) $g->name));
            $isFemale = (
                preg_match('/^(USTD\.|USTDZ\.|USTADZAH|HJ\.|NYAI\.|NING\.)/i', $nameUpper) ||
                preg_match('/\b(USTD|USTDZ|USTADZAH|NYAI|NING|HJ|HAJJAH)\b/i', $nameUpper) ||
                $g->jenis_kelamin === 'P'
            );

            $newGender = $isFemale ? 'P' : 'L';

            if ($g->jenis_kelamin !== $newGender) {
                $g->jenis_kelamin = $newGender;
                $g->save();

                if ($newGender === 'P') {
                    $updatedFemale++;
                    $this->line("  🧕 <fg=green>[USTADZAH]</> {$g->name} (ID: {$g->id}) -> Set Gender: P");
                } else {
                    $updatedMale++;
                    $this->line("  👳 <fg=cyan>[USTADZ]</> {$g->name} (ID: {$g->id}) -> Set Gender: L");
                }
            }
        }

        $this->info("-----------------------------------------------------------------");
        $this->info("✅ Berhasil menyinkronkan data gender seluruh guru:");
        $this->info("   - Total Guru Diperiksa : {$gurus->count()} orang");
        $this->info("   - Diperbarui Ustadzah  : {$updatedFemale} orang");
        $this->info("   - Diperbarui Ustadz    : {$updatedMale} orang");
        $this->info("=================================================================");

        return 0;
    }
}
