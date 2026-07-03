<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\Absensi;
use App\Services\BoardingExcelImportService;
use App\Services\PaymentBillService;
use App\Services\RegionSyncService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command(
    'regions:sync {--level=all : province|city|district|village|all} {--province= : Kode provinsi, contoh 35} {--city= : Kode kab/kota, contoh 35.25} {--district= : Kode kecamatan, contoh 35.25.01} {--timeout=20 : Timeout HTTP per request} {--sleep=0 : Jeda antar request dalam milidetik}',
    function () {
        $service = new RegionSyncService(
            timeout: (int) $this->option('timeout'),
            sleepMs: (int) $this->option('sleep'),
        );

        $stats = $service->sync(
            level: (string) $this->option('level'),
            provinceCode: $this->option('province') ?: null,
            cityCode: $this->option('city') ?: null,
            districtCode: $this->option('district') ?: null,
            console: $this,
        );

        $this->newLine();
        $this->info('Sinkron wilayah selesai.');
        $this->table(
            ['Tingkat', 'Jumlah'],
            collect($stats)->map(fn ($count, $level) => [$level, $count])->values()->all()
        );
    }
)->purpose('Sinkron master wilayah Indonesia dari wilayah.id ke tabel provinces/cities/districts/villages');

Artisan::command(
    'regions:import-sql {file? : Path file db/wilayah.sql dari cahyadsn/wilayah} {--url=https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql : URL sumber jika file tidak diisi}',
    function () {
        $path = $this->argument('file');

        if (!$path) {
            $path = storage_path('app/imports/wilayah.sql');
            File::ensureDirectoryExists(dirname($path));

            $this->info('Mengunduh file wilayah resmi...');
            $response = Http::timeout(120)->retry(3, 1000)->get((string) $this->option('url'));
            $response->throw();
            File::put($path, $response->body());
        }

        $stats = app(RegionSyncService::class)->importSqlFile($path, $this);

        $this->table(
            ['Tingkat', 'Jumlah'],
            collect($stats)->map(fn ($count, $level) => [$level, $count])->values()->all()
        );
    }
)->purpose('Import master wilayah Indonesia lengkap dari file SQL cahyadsn/wilayah');

Artisan::command(
    'regions:sync-postal-codes {file? : Path CSV kode pos} {--url=https://raw.githubusercontent.com/pentagonal/Indonesia-Postal-Code/master/Csv/Comma/first_row_header_db_postal_code_data.csv : URL CSV kode pos} {--refresh : Unduh ulang CSV walau cache lokal sudah ada} {--overwrite : Timpa postal_code yang sudah ada} {--dry-run : Hitung calon update tanpa menyimpan}',
    function () {
        if (!Schema::hasTable('villages') || !Schema::hasColumn('villages', 'postal_code')) {
            $this->warn('Kolom villages.postal_code belum tersedia. Jalankan migrate lebih dulu.');
            return 1;
        }

        $path = $this->argument('file');
        if (!$path) {
            $path = storage_path('app/imports/kodepos_indonesia.csv');
            File::ensureDirectoryExists(dirname($path));

            if (!File::exists($path) || $this->option('refresh')) {
                $this->info('Mengunduh CSV kode pos Indonesia...');
                $response = Http::timeout(120)->retry(3, 1000)->get((string) $this->option('url'));
                $response->throw();
                File::put($path, $response->body());
            }
        }

        if (!File::exists($path)) {
            $this->error("File kode pos tidak ditemukan: {$path}");
            return 1;
        }

        $normalize = function (?string $value): string {
            $value = Str::lower(Str::ascii((string) ($value ?? '')));
            $value = preg_replace('/\([^)]*\)/', ' ', $value) ?? $value;
            $value = preg_replace('/\b(kabupaten|kab|kota administrasi|kota|administrasi)\b/', ' ', $value) ?? $value;
            $value = preg_replace('/[^a-z0-9]+/', ' ', $value) ?? $value;
            return trim(preg_replace('/\s+/', ' ', $value) ?? $value);
        };

        $villages = DB::table('villages')
            ->join('districts', 'districts.id', '=', 'villages.district_id')
            ->join('cities', 'cities.id', '=', 'districts.city_id')
            ->join('provinces', 'provinces.id', '=', 'cities.province_id')
            ->select(
                'villages.id',
                'villages.name as village_name',
                'villages.postal_code',
                'districts.name as district_name',
                'cities.name as city_name',
                'provinces.external_code as province_code'
            )
            ->get();

        $fullMap = [];
        $looseMap = [];
        foreach ($villages as $village) {
            $fullKey = implode('|', [
                $village->province_code,
                $normalize($village->city_name),
                $normalize($village->district_name),
                $normalize($village->village_name),
            ]);
            $looseKey = implode('|', [
                $village->province_code,
                $normalize($village->district_name),
                $normalize($village->village_name),
            ]);
            $fullMap[$fullKey][] = $village;
            $looseMap[$looseKey][] = $village;
        }

        $handle = fopen($path, 'rb');
        if (!$handle) {
            $this->error("File kode pos tidak dapat dibuka: {$path}");
            return 1;
        }

        $header = fgetcsv($handle);
        if (!$header) {
            fclose($handle);
            $this->error('CSV kode pos kosong.');
            return 1;
        }

        $indexes = array_flip(array_map(fn ($item) => trim((string) $item), $header));
        foreach (['urban', 'sub_district', 'city', 'province_code', 'postal_code'] as $column) {
            if (!array_key_exists($column, $indexes)) {
                fclose($handle);
                $this->error("Kolom CSV {$column} tidak ditemukan.");
                return 1;
            }
        }

        $updated = 0;
        $matched = 0;
        $skippedExisting = 0;
        $unmatched = 0;
        $ambiguous = 0;

        while (($row = fgetcsv($handle)) !== false) {
            $postalCode = trim((string) ($row[$indexes['postal_code']] ?? ''));
            if (!preg_match('/^\d{5}$/', $postalCode)) {
                continue;
            }

            $provinceCode = trim((string) ($row[$indexes['province_code']] ?? ''));
            $fullKey = implode('|', [
                $provinceCode,
                $normalize($row[$indexes['city']] ?? ''),
                $normalize($row[$indexes['sub_district']] ?? ''),
                $normalize($row[$indexes['urban']] ?? ''),
            ]);
            $looseKey = implode('|', [
                $provinceCode,
                $normalize($row[$indexes['sub_district']] ?? ''),
                $normalize($row[$indexes['urban']] ?? ''),
            ]);

            $candidates = $fullMap[$fullKey] ?? null;
            if (!$candidates || count($candidates) !== 1) {
                $candidates = $looseMap[$looseKey] ?? null;
            }

            if (!$candidates) {
                $unmatched++;
                continue;
            }

            if (count($candidates) !== 1) {
                $ambiguous++;
                continue;
            }

            $village = $candidates[0];
            $matched++;

            if (!$this->option('overwrite') && !empty($village->postal_code)) {
                $skippedExisting++;
                continue;
            }

            if (!$this->option('dry-run')) {
                DB::table('villages')
                    ->where('id', $village->id)
                    ->update([
                        'postal_code' => $postalCode,
                        'updated_at' => now(),
                    ]);
            }
            $updated++;
        }

        fclose($handle);

        $this->table(
            ['Metric', 'Jumlah'],
            [
                ['matched', $matched],
                ['updated', $updated],
                ['skipped_existing', $skippedExisting],
                ['unmatched', $unmatched],
                ['ambiguous', $ambiguous],
            ]
        );

        $this->info($this->option('dry-run') ? 'Dry-run sync kode pos selesai.' : 'Sync kode pos selesai.');
        return 0;
    }
)->purpose('Backfill postal_code desa/kelurahan dari CSV kode pos Indonesia');

Artisan::command(
    'attendance:repair-duplicates {--dry-run : Hanya tampilkan duplikat tanpa menghapus} {--apply : Hapus duplikat dan isi attendance_key}',
    function () {
        $dryRun = (bool) $this->option('dry-run');
        $apply = (bool) $this->option('apply');

        if (!$dryRun && !$apply) {
            $this->warn('Pilih salah satu: --dry-run atau --apply');
            return 1;
        }

        $rows = Absensi::query()
            ->whereNotNull('tanggal')
            ->whereNotNull('class_id')
            ->whereNotNull('mapel_id')
            ->whereNotNull('jadwal_id')
            ->whereNotNull('siswa_id')
            ->orderBy('id')
            ->get();

        $groups = $rows
            ->groupBy(fn (Absensi $row) => Absensi::buildAttendanceKey(
                $row->tanggal?->format('Y-m-d') ?? $row->tanggal,
                $row->class_id,
                $row->mapel_id,
                $row->jadwal_id,
                $row->siswa_id,
            ))
            ->filter(fn ($items, $key) => $key && $items->count() > 1);

        $summary = [];
        $deleted = 0;

        DB::transaction(function () use ($groups, $apply, &$summary, &$deleted) {
            foreach ($groups as $key => $items) {
                $keep = $items->sortByDesc('updated_at')->sortByDesc('id')->first();
                $duplicates = $items->where('id', '!=', $keep->id)->pluck('id')->values()->all();

                $summary[] = [
                    'attendance_key' => $key,
                    'keep_id' => $keep->id,
                    'duplicate_ids' => implode(',', $duplicates),
                ];

                if ($apply) {
                    Absensi::query()
                        ->whereIn('id', $duplicates)
                        ->delete();
                    $deleted += count($duplicates);
                }
            }

            if ($apply) {
                Absensi::query()
                    ->whereNotNull('tanggal')
                    ->whereNotNull('class_id')
                    ->whereNotNull('mapel_id')
                    ->whereNotNull('jadwal_id')
                    ->whereNotNull('siswa_id')
                    ->orderBy('id')
                    ->chunkById(100, function ($chunk) {
                        foreach ($chunk as $row) {
                            $row->attendance_key = Absensi::buildAttendanceKey(
                                $row->tanggal?->format('Y-m-d') ?? $row->tanggal,
                                $row->class_id,
                                $row->mapel_id,
                                $row->jadwal_id,
                                $row->siswa_id,
                            );
                            $row->save();
                        }
                    });
                DB::statement('DROP INDEX IF EXISTS absensi_attendance_key_index');
                DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS absensi_attendance_key_unique ON absensi (attendance_key) WHERE attendance_key IS NOT NULL');
            }
        });

        $this->info('Grup duplikat ditemukan: ' . count($summary));
        if ($summary) {
            $this->table(['attendance_key', 'keep_id', 'duplicate_ids'], $summary);
        }
        if ($apply) {
            $this->info("Duplikat dihapus: {$deleted}");
        }

        return 0;
    }
)->purpose('Repair duplicate absensi berdasarkan attendance_key stabil');

Artisan::command(
    'boarding:import-excel {file : Path file Excel absensi jamaah sholat} {--show-warnings : Tampilkan warning data santri yang tidak cocok}',
    function () {
        $stats = app(BoardingExcelImportService::class)->import((string) $this->argument('file'), $this);

        $this->info('Import kamar/komplek selesai.');
        $this->table(
            ['Metrik', 'Jumlah'],
            [
                ['Baris Excel', $stats['total_rows']],
                ['Santri cocok', $stats['matched']],
                ['Tidak ditemukan', $stats['not_found']],
                ['Ambigu', $stats['ambiguous']],
                ['Kamar dibuat/dipakai', $stats['rooms']],
            ],
        );

        if ($this->option('show-warnings') && !empty($stats['warnings'])) {
            $this->table(['Komplek', 'Kamar', 'Nama', 'Kelas', 'Catatan'], collect($stats['warnings'])->map(fn ($row) => [
                $row['komplek'],
                $row['kamar'],
                $row['nama'],
                $row['kelas'],
                $row['message'],
            ])->all());
        }

        return 0;
    }
)->purpose('Import data komplek/kamar santri dari template Excel absensi jamaah sholat');

Artisan::command(
    'payments:generate-bills {--through= : Tanggal batas generate, default hari ini} {--rule= : ID aturan tagihan tertentu}',
    function () {
        $through = $this->option('through') ? \Carbon\Carbon::parse((string) $this->option('through')) : null;
        $ruleId = $this->option('rule') ? (int) $this->option('rule') : null;
        $count = app(PaymentBillService::class)->generateDueBills($through, $ruleId);
        app(PaymentBillService::class)->refreshOverdue();

        $this->info("Generate tagihan selesai. Baris dibuat/diperbarui: {$count}");
        return 0;
    }
)->purpose('Generate tagihan otomatis pembayaran secara idempotent');
