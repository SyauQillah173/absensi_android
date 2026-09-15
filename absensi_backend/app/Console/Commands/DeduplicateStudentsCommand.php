<?php

namespace App\Console\Commands;

use App\Models\Siswa;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class DeduplicateStudentsCommand extends Command
{
    protected $signature = 'siswa:deduplicate 
                            {--dry-run : Jalankan analisa dan tampilkan data duplikat tanpa mengubah/menghapus database}
                            {--merge : Eksekusi penggabungan (merge) data relasi dan pembersihan record duplikat}
                            {--threshold=85 : Ambang batas persentase kemiripan nama (default: 85)}
                            {--force : Lewati konfirmasi interaktif saat eksekusi merge}';

    protected $description = 'Deteksi, analisa, dan bersihkan duplikasi data santri dengan algoritma fonetik dan Levenshtein';

    public function handle(): int
    {
        $this->printBanner();

        $isDryRun = $this->option('dry-run');
        $isMerge = $this->option('merge');
        $threshold = (float) $this->option('threshold');
        $force = $this->option('force');

        if (!$isDryRun && !$isMerge) {
            $this->warn("⚠️  Anda belum memilih mode eksekusi.");
            $choice = $this->choice(
                "Pilih aksi yang ingin dijalankan:",
                [
                    1 => 'Analisa Saja (Dry-Run: Tinjau calon data duplikat tanpa mengubah apapun)',
                    2 => 'Eksekusi Penggabungan & Hapus Duplikat (Merge: Pindahkan data lalu bersihkan)',
                    3 => 'Batalkan',
                ],
                1
            );

            if ($choice === 'Analisa Saja (Dry-Run: Tinjau calon data duplikat tanpa mengubah apapun)') {
                $isDryRun = true;
            } elseif ($choice === 'Eksekusi Penggabungan & Hapus Duplikat (Merge: Pindahkan data lalu bersihkan)') {
                $isMerge = true;
            } else {
                $this->info("Operasi dibatalkan.");
                return self::SUCCESS;
            }
        }

        $this->info("🔍 Mengambil data seluruh santri dari database...");
        $allStudents = Siswa::orderBy('id')->get();
        $totalCount = $allStudents->count();
        $this->info("   Total santri saat ini: <comment>{$totalCount}</comment> data.");

        // Preload relasi penting untuk performa
        $this->info("⚡ Memuat indeks tagihan & transaksi...");
        $billCounts = DB::table('payment_bills')
            ->select('siswa_id', DB::raw('COUNT(*) as c'))
            ->groupBy('siswa_id')
            ->pluck('c', 'siswa_id')
            ->toArray();

        $payCounts = DB::table('pembayaran')
            ->select('siswa_id', DB::raw('COUNT(*) as c'))
            ->groupBy('siswa_id')
            ->pluck('c', 'siswa_id')
            ->toArray();

        // 1. Deteksi Kandidat Duplikat
        $this->info("🧠 Menganalisa nama dengan normalisasi fonetik & similarity token (threshold: {$threshold}%)...");
        $duplicatePairs = $this->detectDuplicates($allStudents, $threshold, $billCounts);

        if (empty($duplicatePairs)) {
            $this->info("✅ Tidak ditemukan data santri yang duplikat dengan ambang batas {$threshold}%. Database bersih!");
            return self::SUCCESS;
        }

        $this->warn("⚠️  Ditemukan " . count($duplicatePairs) . " pasangan kandidat data ganda / duplikat!\n");

        // 2. Susun Tabel Perbandingan Master vs Duplikat
        $tableRows = [];
        $plan = [];

        foreach ($duplicatePairs as $idx => $pair) {
            $s1 = $pair['s1'];
            $s2 = $pair['s2'];
            $sim = $pair['sim'];
            $reason = $pair['reason'];

            // Tentukan siapa MASTER dan siapa DUPLIKAT (CLONE)
            $resolved = $this->determineMasterAndClone($s1, $s2, $billCounts, $payCounts);
            $master = $resolved['master'];
            $clone = $resolved['clone'];

            $mBills = $billCounts[$master->id] ?? 0;
            $cBills = $billCounts[$clone->id] ?? 0;

            $plan[] = [
                'index' => $idx + 1,
                'master' => $master,
                'clone' => $clone,
                'sim' => $sim,
                'reason' => $reason,
                'master_bills' => $mBills,
                'clone_bills' => $cBills,
            ];

            $tableRows[] = [
                $idx + 1,
                "[ID {$master->id}]\n{$master->nama}\nNIS: {$master->nis}",
                "Kls: " . ($master->kelas ?: '-') . "\nKmr: " . ($master->kamar ?: '-') . "\nBills: {$mBills}",
                "[ID {$clone->id}]\n{$clone->nama}\nNIS: {$clone->nis}",
                "Kls: " . ($clone->kelas ?: '-') . "\nKmr: " . ($clone->kamar ?: '-') . "\nBills: {$cBills}",
                "{$sim}%\n({$reason})"
            ];
        }

        $this->table(
            ['No', 'MASTER (Dipertahankan)', 'Info Master', 'DUPLIKAT (Akan Di-Merge & Hapus)', 'Info Duplikat', 'Kemiripan'],
            $tableRows
        );

        // Simpan log analisa ke storage
        $logPath = storage_path('logs/deduplikasi_santri_' . date('Ymd_His') . '.json');
        File::ensureDirectoryExists(dirname($logPath));
        File::put($logPath, json_encode($plan, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $this->comment("📝 Log analisa lengkap disimpan di: {$logPath}");

        // Jika Mode Dry-Run, berhenti di sini
        if ($isDryRun) {
            $this->info("\n💡 [MODE SIMULASI / DRY-RUN]");
            $this->info("   Data di atas adalah simulasi. Tidak ada data yang dihapus atau diubah di database.");
            $this->info("   Untuk mengeksekusi penggabungan data, jalankan:");
            $this->line("   <fg=cyan>php artisan siswa:deduplicate --merge</>");
            return self::SUCCESS;
        }

        // Jika Mode Merge
        if ($isMerge) {
            $this->warn("\n🚨 [PERINGATAN EKSEKUSI PENGGABUNGAN DATA]");
            $this->line("   - Seluruh data relasi milik santri duplikat (tagihan, pembayaran, absensi, dll) akan dialihkan ke Master.");
            $this->line("   - Kolom yang kosong pada Master akan dilengkapi dari data Duplikat.");
            $this->line("   - Record duplikat kemudian akan dihapus dengan aman dari tabel siswa.");

            if (!$force) {
                if (!$this->confirm("Apakah Anda yakin ingin memproses " . count($plan) . " data duplikat ini?", false)) {
                    $this->info("Penggabungan dibatalkan oleh pengguna.");
                    return self::SUCCESS;
                }
            }

            $this->info("\n🚀 Memulai proses penggabungan data dalam transaksi database...");
            $mergedCount = 0;

            DB::beginTransaction();
            try {
                foreach ($plan as $item) {
                    $master = Siswa::find($item['master']->id);
                    $clone = Siswa::find($item['clone']->id);

                    if (!$master || !$clone) {
                        continue;
                    }

                    $this->mergeStudentData($master, $clone);
                    $mergedCount++;
                    $this->line("   ✓ Berhasil merge ID {$clone->id} ('{$clone->nama}') -> ID {$master->id} ('{$master->nama}')");
                }

                DB::commit();
                $this->info("\n🎉 SUKSES! Sebanyak {$mergedCount} data santri duplikat berhasil digabungkan & dibersihkan!");
                $remainingTotal = Siswa::count();
                $this->info("   Total santri riil di database sekarang: <comment>{$remainingTotal}</comment> data.");
            } catch (\Throwable $e) {
                DB::rollBack();
                $this->error("\n❌ TERJADI KESALAHAN! Seluruh perubahan di-rollback (database tetap aman).");
                $this->error("   Error: " . $e->getMessage());
                return self::FAILURE;
            }
        }

        return self::SUCCESS;
    }

    /**
     * Menentukan mana record MASTER (dipertahankan) dan mana CLONE (duplikat)
     */
    protected function determineMasterAndClone(Siswa $s1, Siswa $s2, array $billCounts, array $payCounts): array
    {
        $score1 = 0;
        $score2 = 0;

        // 1. Punya kamar asrama = poin besar
        if (!empty(trim($s1->kamar ?? ''))) $score1 += 50;
        if (!empty(trim($s2->kamar ?? ''))) $score2 += 50;

        // 2. Punya bills tagihan
        $b1 = $billCounts[$s1->id] ?? 0;
        $b2 = $billCounts[$s2->id] ?? 0;
        if ($b1 > 0) $score1 += 30;
        if ($b2 > 0) $score2 += 30;

        // 3. Punya riwayat bayar
        $p1 = $payCounts[$s1->id] ?? 0;
        $p2 = $payCounts[$s2->id] ?? 0;
        if ($p1 > 0) $score1 += 20;
        if ($p2 > 0) $score2 += 20;

        // 4. Kelengkapan data identitas
        if (!empty($s1->nisn)) $score1 += 5;
        if (!empty($s2->nisn)) $score2 += 5;
        if (!empty($s1->nik)) $score1 += 5;
        if (!empty($s2->nik)) $score2 += 5;
        if (!empty($s1->no_whatsapp)) $score1 += 5;
        if (!empty($s2->no_whatsapp)) $score2 += 5;

        // 5. Tie breaker: ID lebih kecil (dibuat lebih awal)
        if ($score1 === $score2) {
            return $s1->id < $s2->id
                ? ['master' => $s1, 'clone' => $s2]
                : ['master' => $s2, 'clone' => $s1];
        }

        return $score1 > $score2
            ? ['master' => $s1, 'clone' => $s2]
            : ['master' => $s2, 'clone' => $s1];
    }

    /**
     * Menggabungkan data clone ke master secara aman (Zero Data Loss)
     */
    protected function mergeStudentData(Siswa $master, Siswa $clone): void
    {
        // Ambil snapshot atribut clone
        $cloneData = $clone->toArray();

        // 0. Kosongkan field unique pada clone di DB terlebih dahulu agar tidak memicu unique violation
        DB::table('siswa')->where('id', $clone->id)->update([
            'nisn' => null,
            'nik' => null,
        ]);

        // 1. Pindahkan atribut identitas yang kosong di Master
        $fillableAttributes = [
            'nisn', 'nik', 'no_kk', 'no_akta', 'dokumen_akta',
            'sekolah_formal', 'asal_sekolah', 'school_origin_id',
            'no_whatsapp', 'email_siswa', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
            'nama_ayah', 'nik_ayah', 'no_whatsapp_ayah',
            'nama_ibu', 'nik_ibu', 'no_whatsapp_ibu',
            'nama_wali', 'no_telepon_wali', 'wali_id', 'guardian_profile_id',
            'alamat', 'provinsi', 'kota', 'kecamatan', 'kelurahan',
            'status_mondok', 'kategori_spp', 'foto_santri', 'catatan_santri'
        ];

        foreach ($fillableAttributes as $attr) {
            $cloneVal = $cloneData[$attr] ?? null;
            if (empty($master->$attr) && !empty($cloneVal)) {
                $master->$attr = $cloneVal;
            }
        }

        // Jika Master belum punya kamar tapi Clone punya
        if (empty($master->kamar) && !empty($clone->kamar)) {
            $master->kamar = $clone->kamar;
            $master->komplek = $clone->komplek;
            $master->boarding_room_id = $clone->boarding_room_id;
        }

        $master->save();

        // 2. Relink Payment Bills
        $cloneBills = DB::table('payment_bills')->where('siswa_id', $clone->id)->get();
        foreach ($cloneBills as $cb) {
            // Cek apakah master sudah punya tagihan dengan rule & period_key yang sama
            $existsOnMaster = DB::table('payment_bills')
                ->where('siswa_id', $master->id)
                ->where('payment_bill_rule_id', $cb->payment_bill_rule_id)
                ->where('period_key', $cb->period_key)
                ->first();

            if ($existsOnMaster) {
                // Jika tagihan clone sudah lunas tapi master belum, update master jadi lunas
                if ($cb->status === 'paid' && $existsOnMaster->status !== 'paid') {
                    DB::table('payment_bills')->where('id', $existsOnMaster->id)->update([
                        'status' => 'paid',
                        'paid_at' => $cb->paid_at,
                        'paid_amount' => $cb->paid_amount,
                    ]);
                }
                // Hapus bill duplikat milik clone
                DB::table('payment_bills')->where('id', $cb->id)->delete();
            } else {
                // Pindahkan kepemilikan tagihan ke master
                DB::table('payment_bills')->where('id', $cb->id)->update(['siswa_id' => $master->id]);
            }
        }

        // 3. Relink Pembayaran
        if (DB::getSchemaBuilder()->hasTable('pembayaran')) {
            DB::table('pembayaran')->where('siswa_id', $clone->id)->update(['siswa_id' => $master->id]);
        }

        // 4. Relink Payment Verifications
        if (DB::getSchemaBuilder()->hasTable('payment_verifications')) {
            DB::table('payment_verifications')->where('siswa_id', $clone->id)->update(['siswa_id' => $master->id]);
        }

        // 5. Relink Payment Bill Students
        if (DB::getSchemaBuilder()->hasTable('payment_bill_students')) {
            $pbsList = DB::table('payment_bill_students')->where('siswa_id', $clone->id)->get();
            foreach ($pbsList as $pbs) {
                $already = DB::table('payment_bill_students')
                    ->where('siswa_id', $master->id)
                    ->where('payment_bill_rule_id', $pbs->payment_bill_rule_id)
                    ->exists();
                if ($already) {
                    DB::table('payment_bill_students')->where('id', $pbs->id)->delete();
                } else {
                    DB::table('payment_bill_students')->where('id', $pbs->id)->update(['siswa_id' => $master->id]);
                }
            }
        }

        // 6. Relink Santri Pondok
        if (DB::getSchemaBuilder()->hasTable('santri_pondok')) {
            $hasMasterSp = DB::table('santri_pondok')->where('siswa_id', $master->id)->exists();
            if ($hasMasterSp) {
                DB::table('santri_pondok')->where('siswa_id', $clone->id)->delete();
            } else {
                DB::table('santri_pondok')->where('siswa_id', $clone->id)->update(['siswa_id' => $master->id]);
            }
        }

        // 7. Relink Absensi Umum
        if (DB::getSchemaBuilder()->hasTable('absensi')) {
            $cloneAbsensi = DB::table('absensi')->where('siswa_id', $clone->id)->get();
            foreach ($cloneAbsensi as $abs) {
                $conflict = DB::table('absensi')
                    ->where('siswa_id', $master->id)
                    ->where('tanggal', $abs->tanggal)
                    ->exists();
                if ($conflict) {
                    DB::table('absensi')->where('id', $abs->id)->delete();
                } else {
                    DB::table('absensi')->where('id', $abs->id)->update(['siswa_id' => $master->id]);
                }
            }
        }

        // 8. Relink Absensi Sholat & Ngaji
        if (DB::getSchemaBuilder()->hasTable('absensi_sholat')) {
            DB::table('absensi_sholat')->where('siswa_id', $clone->id)->update(['siswa_id' => $master->id]);
        }
        if (DB::getSchemaBuilder()->hasTable('absensi_ngaji')) {
            DB::table('absensi_ngaji')->where('siswa_id', $clone->id)->update(['siswa_id' => $master->id]);
        }

        // 9. Relink Pelanggaran Santri
        if (DB::getSchemaBuilder()->hasTable('pelanggaran_santri')) {
            DB::table('pelanggaran_santri')->where('siswa_id', $clone->id)->update(['siswa_id' => $master->id]);
        }

        // 10. Relink Siswa Tahun Ajaran
        if (DB::getSchemaBuilder()->hasTable('siswa_tahun_ajaran')) {
            $staList = DB::table('siswa_tahun_ajaran')->where('siswa_id', $clone->id)->get();
            foreach ($staList as $sta) {
                $hasSta = DB::table('siswa_tahun_ajaran')
                    ->where('siswa_id', $master->id)
                    ->where('academic_year_id', $sta->academic_year_id)
                    ->where('semester_id', $sta->semester_id)
                    ->exists();
                if ($hasSta) {
                    DB::table('siswa_tahun_ajaran')->where('id', $sta->id)->delete();
                } else {
                    DB::table('siswa_tahun_ajaran')->where('id', $sta->id)->update(['siswa_id' => $master->id]);
                }
            }
        }

        // 11. Hapus record Clone setelah semua relasi beres
        $clone->delete();
    }

    /**
     * Deteksi Pasangan Duplikat
     */
    protected function detectDuplicates($students, float $threshold, array $billCounts): array
    {
        $pairs = [];
        $seen = [];

        // Normalisasi dan pembuatan token untuk seluruh santri
        $indexed = [];
        foreach ($students as $s) {
            $clean = $this->cleanString($s->nama);
            $words = $this->extractKeywords($s->nama);
            $indexed[] = [
                'siswa' => $s,
                'clean' => $clean,
                'words' => $words,
            ];
        }

        // Buat indeks inverted per kata unik (panjang >= 4) dan per prefix clean string
        $wordMap = [];
        $prefixMap = [];
        foreach ($indexed as $idx => $item) {
            foreach ($item['words'] as $w) {
                if (!isset($wordMap[$w])) $wordMap[$w] = [];
                $wordMap[$w][] = $idx;
            }
            if (strlen($item['clean']) >= 4) {
                $pfx = substr($item['clean'], 0, 4);
                if (!isset($prefixMap[$pfx])) $prefixMap[$pfx] = [];
                $prefixMap[$pfx][] = $idx;
            }
        }

        // Gabungkan kedua sumber indeks
        $combinedIndices = array_merge(array_values($wordMap), array_values($prefixMap));

        // Cek pasangan yang memiliki kesamaan kata atau prefix
        foreach ($combinedIndices as $studentIndices) {
            $studentIndices = array_unique($studentIndices);
            $count = count($studentIndices);
            if ($count < 2 || $count > 15) continue; // hindari kelompok yang terlalu besar

            for ($i = 0; $i < $count; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    $idx1 = $studentIndices[$i];
                    $idx2 = $studentIndices[$j];
                    $s1 = $indexed[$idx1]['siswa'];
                    $s2 = $indexed[$idx2]['siswa'];

                    if ($s1->id === $s2->id) continue;

                    $pairKey = min($s1->id, $s2->id) . '_' . max($s1->id, $s2->id);
                    if (isset($seen[$pairKey])) continue;

                    $c1 = $indexed[$idx1]['clean'];
                    $c2 = $indexed[$idx2]['clean'];

                    // Cek jika KEDUA santri sama-sama memiliki Kamar Asrama BERBEDA dan sama-sama punya tagihan
                    $kmr1 = trim($s1->kamar ?? '');
                    $kmr2 = trim($s2->kamar ?? '');
                    $b1 = $billCounts[$s1->id] ?? 0;
                    $b2 = $billCounts[$s2->id] ?? 0;
                    if (!empty($kmr1) && !empty($kmr2) && strcasecmp($kmr1, $kmr2) !== 0 && $b1 > 0 && $b2 > 0) {
                        // Dua santri berbeda yang kebetulan memiliki nama sama dan tinggal di kamar berbeda
                        continue;
                    }

                    // 1. Cek Exact Normalized
                    if ($c1 === $c2) {
                        $seen[$pairKey] = true;
                        $pairs[] = [
                            's1' => $s1,
                            's2' => $s2,
                            'sim' => 100,
                            'reason' => 'Exact Match'
                        ];
                        continue;
                    }

                    // 2. Cek Levenshtein pada clean string
                    $maxLen = max(strlen($c1), strlen($c2));
                    if ($maxLen > 0) {
                        $lev = levenshtein($c1, $c2);
                        $sim = round((1 - ($lev / $maxLen)) * 100, 1);

                        // Abaikan jika jenis kelamin berbeda (pasti orang beda)
                        if (!empty($s1->jenis_kelamin) && !empty($s2->jenis_kelamin) && $s1->jenis_kelamin !== $s2->jenis_kelamin) {
                            continue;
                        }

                        // Guard 1: Jika kata depan (first word) memiliki huruf awal berbeda dan bukan variasi fonetik
                        $w1 = $this->extractAllWords($s1->nama);
                        $w2 = $this->extractAllWords($s2->nama);
                        if (!empty($w1) && !empty($w2)) {
                            $firstWord1 = $this->stripTitles($w1[0]);
                            $firstWord2 = $this->stripTitles($w2[0]);
                            if (!empty($firstWord1) && !empty($firstWord2)) {
                                $char1 = $firstWord1[0];
                                $char2 = $firstWord2[0];
                                $allowedInitialSwaps = [
                                    'k' => ['q', 'c'],
                                    'q' => ['k'],
                                    'c' => ['k', 's'],
                                    'f' => ['v', 'p'],
                                    'v' => ['f'],
                                    'p' => ['f'],
                                    'z' => ['j', 'd'],
                                    'j' => ['z'],
                                    'd' => ['z'],
                                    'e' => ['i'],
                                    'i' => ['e'],
                                    'u' => ['o'],
                                    'o' => ['u'],
                                ];
                                if ($char1 !== $char2) {
                                    $isAllowed = isset($allowedInitialSwaps[$char1]) && in_array($char2, $allowedInitialSwaps[$char1]);
                                    if (!$isAllowed) {
                                        continue; // Huruf awal nama depan beda (misal: Zahrotul vs Mahirotul) -> BEDA ORANG
                                    }
                                }

                                $maxFw = max(strlen($firstWord1), strlen($firstWord2));
                                $levFw = levenshtein($firstWord1, $firstWord2);
                                $fwSim = (1 - ($levFw / $maxFw)) * 100;
                                if ($fwSim < 75) {
                                    continue;
                                }
                            }
                        }

                        // Guard 2: Jika KEDUA santri sama-sama memiliki Kamar Asrama BERBEDA dan sama-sama punya tagihan
                        $kmr1 = trim($s1->kamar ?? '');
                        $kmr2 = trim($s2->kamar ?? '');
                        if (!empty($kmr1) && !empty($kmr2) && strcasecmp($kmr1, $kmr2) !== 0) {
                            // Cek jenjang kelas: jika satu VII (SMP/MTS) dan satu X/XI (SMA/SMK), pasti orang beda
                            $isDifferentLevel = (preg_match('/(VII|VIII|IX|7|8|9)/i', $s1->kelas) && preg_match('/(X|XI|XII|10|11|12)/i', $s2->kelas))
                                             || (preg_match('/(VII|VIII|IX|7|8|9)/i', $s2->kelas) && preg_match('/(X|XI|XII|10|11|12)/i', $s1->kelas));
                            if ($isDifferentLevel) {
                                continue; // Beda jenjang sekolah (SMP vs SMA), dua orang berbeda dengan nama sama
                            }
                        }

                        if ($sim >= $threshold) {
                            $seen[$pairKey] = true;
                            $pairs[] = [
                                's1' => $s1,
                                's2' => $s2,
                                'sim' => $sim,
                                'reason' => 'Levenshtein Similarity'
                            ];
                        }
                    }
                }
            }
        }

        // Urutkan dari kemiripan tertinggi
        usort($pairs, fn($a, $b) => $b['sim'] <=> $a['sim']);

        return $pairs;
    }

    /**
     * Normalisasi string nama
     */
    protected function cleanString(string $name): string
    {
        $n = strtolower($name);
        $n = preg_replace('/[0-9]/', '', $n);
        $n = preg_replace('/\b(muhammad|mohammad|mochammad|moch|mohamad|muhamad|moh|m)\b[\.\s]*/', 'm ', $n);
        $n = preg_replace('/\b(achmad|ahmad|akhmad|ach|ah)\b[\.\s]*/', 'ahmad ', $n);
        $n = preg_replace('/\b(abdul|abd)\b[\.\s]*/', 'abdul ', $n);
        $n = preg_replace('/[^a-z]/', '', $n);
        $n = str_replace(['kh', 'dz', 'dh', 'th', 'sh', 'sy', 'ph', 'v'], ['k', 'z', 'd', 't', 's', 's', 'f', 'f'], $n);
        $n = preg_replace('/(.)\1+/', '$1', $n);
        return $n;
    }

    /**
     * Ekstrak kata unik yang representatif (bukan kata umum)
     */
    protected function extractKeywords(string $name): array
    {
        $n = strtolower($name);
        $n = preg_replace('/[0-9]/', '', $n);
        $n = preg_replace('/[^a-z\s]/', ' ', $n);
        $words = array_filter(explode(' ', $n), fn($w) => strlen(trim($w)) >= 4);

        $commonWords = ['muhammad', 'mohammad', 'ahmad', 'achmad', 'abdul', 'binti', 'santri', 'putra', 'putri'];
        $filtered = [];

        foreach ($words as $w) {
            $w = trim($w);
            if (in_array($w, $commonWords)) continue;
            // Fonetik ringkas
            $w = str_replace(['kh', 'dz', 'dh', 'th', 'sh', 'sy', 'ph', 'v'], ['k', 'z', 'd', 't', 's', 's', 'f', 'f'], $w);
            $w = preg_replace('/(.)\1+/', '$1', $w);
            $filtered[] = $w;
        }

        return array_values(array_unique($filtered));
    }

    protected function extractAllWords(string $name): array
    {
        $n = strtolower($name);
        $n = preg_replace('/[0-9]/', '', $n);
        $n = preg_replace('/[^a-z\s]/', ' ', $n);
        $words = array_values(array_filter(explode(' ', $n), fn($w) => strlen(trim($w)) > 0));
        return $words;
    }

    protected function stripTitles(string $word): string
    {
        $w = strtolower(trim($word));
        if (in_array($w, ['m', 'moh', 'mohammad', 'muhammad', 'muhamad', 'moch', 'mochammad'])) {
            return 'm';
        }
        if (in_array($w, ['ah', 'ach', 'ahmad', 'achmad', 'akhmad'])) {
            return 'ahmad';
        }
        if (in_array($w, ['abd', 'abdul'])) {
            return 'abdul';
        }
        return $w;
    }

    protected function printBanner(): void
    {
        $this->line("
===================================================================
       YAYASAN PONDOK PESANTREN QOMARUDDIN SAMPURNAN BUNGAH
               MODUL DEDUKPLIKASI DATA SANTRI PONDOK
===================================================================
        ");
    }
}
