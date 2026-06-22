<?php

namespace App\Services;

use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class RegionSyncService
{
    public function __construct(
        private readonly string $baseUrl = 'https://wilayah.id/api',
        private readonly int $timeout = 20,
        private readonly int $sleepMs = 0,
    ) {
    }

    public function sync(
        string $level = 'all',
        ?string $provinceCode = null,
        ?string $cityCode = null,
        ?string $districtCode = null,
        ?Command $console = null,
    ): array {
        $level = Str::lower($level);
        $stats = [
            'provinces' => 0,
            'cities' => 0,
            'districts' => 0,
            'villages' => 0,
        ];

        if (in_array($level, ['all', 'province', 'provinces'], true)) {
            $stats['provinces'] = $this->syncProvinces($console);
        }

        if (in_array($level, ['all', 'city', 'cities', 'regency', 'regencies'], true)) {
            $stats['cities'] = $this->syncCities($provinceCode, $console);
        }

        if (in_array($level, ['all', 'district', 'districts'], true)) {
            $stats['districts'] = $this->syncDistricts($provinceCode, $cityCode, $console);
        }

        if (in_array($level, ['all', 'village', 'villages'], true)) {
            $stats['villages'] = $this->syncVillages($provinceCode, $cityCode, $districtCode, $console);
        }

        return $stats;
    }

    public function importSqlFile(string $path, ?Command $console = null): array
    {
        if (!File::exists($path)) {
            throw new \InvalidArgumentException("File wilayah tidak ditemukan: {$path}");
        }

        $rows = [
            'provinces' => [],
            'cities' => [],
            'districts' => [],
            'villages' => [],
        ];
        $timestamp = now()->toDateTimeString();

        $handle = fopen($path, 'rb');
        if (!$handle) {
            throw new \RuntimeException("File wilayah tidak dapat dibuka: {$path}");
        }

        while (($line = fgets($handle)) !== false) {
            if (!preg_match("/\\('([^']+)'\\s*,\\s*'((?:\\\\.|''|[^'])*)'\\)/", $line, $matches)) {
                continue;
            }

            $code = trim($matches[1]);
            $name = trim(str_replace("''", "'", stripcslashes($matches[2])));
            if ($code === '' || $name === '') {
                continue;
            }

            $segments = explode('.', $code);
            $level = count($segments);

            if ($level === 1) {
                $rows['provinces'][] = [
                    'external_code' => $code,
                    'name' => $name,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];
            } elseif ($level === 2) {
                $rows['cities'][] = [
                    'province_code' => $segments[0],
                    'external_code' => $code,
                    'name' => $name,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];
            } elseif ($level === 3) {
                $rows['districts'][] = [
                    'city_code' => implode('.', array_slice($segments, 0, 2)),
                    'external_code' => $code,
                    'name' => $name,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];
            } elseif ($level === 4) {
                $rows['villages'][] = [
                    'district_code' => implode('.', array_slice($segments, 0, 3)),
                    'external_code' => $code,
                    'name' => $name,
                    'postal_code' => null,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];
            }
        }

        fclose($handle);

        DB::transaction(function () use ($rows): void {
            $this->upsert('provinces', collect($rows['provinces']), ['external_code'], ['name', 'updated_at']);

            $provinceIds = DB::table('provinces')->pluck('id', 'external_code');
            $cities = collect($rows['cities'])
                ->map(function (array $row) use ($provinceIds) {
                    $row['province_id'] = $provinceIds[$row['province_code']] ?? null;
                    unset($row['province_code']);
                    return $row;
                })
                ->filter(fn (array $row) => $row['province_id']);
            $this->upsert('cities', $cities, ['external_code'], ['province_id', 'name', 'updated_at']);

            $cityIds = DB::table('cities')->pluck('id', 'external_code');
            $districts = collect($rows['districts'])
                ->map(function (array $row) use ($cityIds) {
                    $row['city_id'] = $cityIds[$row['city_code']] ?? null;
                    unset($row['city_code']);
                    return $row;
                })
                ->filter(fn (array $row) => $row['city_id']);
            $this->upsert('districts', $districts, ['external_code'], ['city_id', 'name', 'updated_at']);

            $districtIds = DB::table('districts')->pluck('id', 'external_code');
            $villages = collect($rows['villages'])
                ->map(function (array $row) use ($districtIds) {
                    $row['district_id'] = $districtIds[$row['district_code']] ?? null;
                    unset($row['district_code']);
                    return $row;
                })
                ->filter(fn (array $row) => $row['district_id']);
            $this->upsert('villages', $villages, ['external_code'], ['district_id', 'name', 'postal_code', 'updated_at']);
        });

        $stats = [
            'provinces' => count($rows['provinces']),
            'cities' => count($rows['cities']),
            'districts' => count($rows['districts']),
            'villages' => count($rows['villages']),
        ];

        $console?->info('Import file wilayah selesai.');
        return $stats;
    }

    private function syncProvinces(?Command $console = null): int
    {
        $rows = $this->fetchData('/provinces.json');
        $payload = collect($rows)
            ->map(fn (array $row) => [
                'external_code' => $this->code($row),
                'name' => $this->name($row),
                'created_at' => now(),
                'updated_at' => now(),
            ])
            ->filter(fn (array $row) => $row['external_code'] !== '' && $row['name'] !== '')
            ->values();

        $this->upsert('provinces', $payload, ['external_code'], ['name', 'updated_at']);
        $console?->info("Provinsi tersinkron: {$payload->count()}");

        return $payload->count();
    }

    private function syncCities(?string $provinceCode = null, ?Command $console = null): int
    {
        $provinces = $this->provinceQuery($provinceCode)->get();
        $total = 0;

        foreach ($provinces as $province) {
            $rows = $this->fetchData("/regencies/{$province->external_code}.json");
            $payload = collect($rows)
                ->map(fn (array $row) => [
                    'province_id' => $province->id,
                    'external_code' => $this->code($row),
                    'name' => $this->name($row),
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
                ->filter(fn (array $row) => $row['external_code'] !== '' && $row['name'] !== '')
                ->values();

            $this->upsert('cities', $payload, ['external_code'], ['province_id', 'name', 'updated_at']);
            $total += $payload->count();
            $this->detail($console, "Kab/kota {$province->name}: {$payload->count()}");
            $this->rest();
        }

        $console?->info("Kabupaten/kota tersinkron: {$total}");
        return $total;
    }

    private function syncDistricts(?string $provinceCode = null, ?string $cityCode = null, ?Command $console = null): int
    {
        $cities = $this->cityQuery($provinceCode, $cityCode)->get();
        $total = 0;

        foreach ($cities as $city) {
            $rows = $this->fetchData("/districts/{$city->external_code}.json");
            $payload = collect($rows)
                ->map(fn (array $row) => [
                    'city_id' => $city->id,
                    'external_code' => $this->code($row),
                    'name' => $this->name($row),
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
                ->filter(fn (array $row) => $row['external_code'] !== '' && $row['name'] !== '')
                ->values();

            $this->upsert('districts', $payload, ['external_code'], ['city_id', 'name', 'updated_at']);
            $total += $payload->count();
            $this->detail($console, "Kecamatan {$city->name}: {$payload->count()}");
            $this->rest();
        }

        $console?->info("Kecamatan tersinkron: {$total}");
        return $total;
    }

    private function syncVillages(
        ?string $provinceCode = null,
        ?string $cityCode = null,
        ?string $districtCode = null,
        ?Command $console = null,
    ): int {
        $districts = $this->districtQuery($provinceCode, $cityCode, $districtCode)->get();
        $total = 0;

        foreach ($districts as $district) {
            $rows = $this->fetchData("/villages/{$district->external_code}.json");
            $payload = collect($rows)
                ->map(fn (array $row) => [
                    'district_id' => $district->id,
                    'external_code' => $this->code($row),
                    'name' => $this->name($row),
                    'postal_code' => $row['postal_code'] ?? $row['postalCode'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
                ->filter(fn (array $row) => $row['external_code'] !== '' && $row['name'] !== '')
                ->values();

            $this->upsert(
                'villages',
                $payload,
                ['external_code'],
                ['district_id', 'name', 'postal_code', 'updated_at']
            );
            $total += $payload->count();
            $this->detail($console, "Desa/kelurahan {$district->name}: {$payload->count()}");
            $this->rest();
        }

        $console?->info("Desa/kelurahan tersinkron: {$total}");
        return $total;
    }

    private function fetchData(string $path): array
    {
        $response = Http::acceptJson()
            ->timeout($this->timeout)
            ->retry(3, 500)
            ->get(rtrim($this->baseUrl, '/') . $path);

        $response->throw();
        $json = $response->json();

        return is_array($json['data'] ?? null) ? $json['data'] : [];
    }

    private function upsert(string $table, Collection $rows, array $uniqueBy, array $updateColumns): void
    {
        $rows->chunk(500)->each(function (Collection $chunk) use ($table, $uniqueBy, $updateColumns) {
            if ($chunk->isNotEmpty()) {
                DB::table($table)->upsert($chunk->all(), $uniqueBy, $updateColumns);
            }
        });
    }

    private function provinceQuery(?string $provinceCode)
    {
        return DB::table('provinces')
            ->when($provinceCode, fn ($query) => $query->where('external_code', $provinceCode))
            ->orderBy('external_code');
    }

    private function cityQuery(?string $provinceCode, ?string $cityCode)
    {
        return DB::table('cities')
            ->join('provinces', 'provinces.id', '=', 'cities.province_id')
            ->select('cities.*')
            ->when($provinceCode, fn ($query) => $query->where('provinces.external_code', $provinceCode))
            ->when($cityCode, fn ($query) => $query->where('cities.external_code', $cityCode))
            ->orderBy('cities.external_code');
    }

    private function districtQuery(?string $provinceCode, ?string $cityCode, ?string $districtCode)
    {
        return DB::table('districts')
            ->join('cities', 'cities.id', '=', 'districts.city_id')
            ->join('provinces', 'provinces.id', '=', 'cities.province_id')
            ->select('districts.*')
            ->when($provinceCode, fn ($query) => $query->where('provinces.external_code', $provinceCode))
            ->when($cityCode, fn ($query) => $query->where('cities.external_code', $cityCode))
            ->when($districtCode, fn ($query) => $query->where('districts.external_code', $districtCode))
            ->orderBy('districts.external_code');
    }

    private function code(array $row): string
    {
        return trim((string) ($row['code'] ?? $row['id'] ?? ''));
    }

    private function name(array $row): string
    {
        return trim((string) ($row['name'] ?? $row['nama'] ?? ''));
    }

    private function rest(): void
    {
        if ($this->sleepMs > 0) {
            usleep($this->sleepMs * 1000);
        }
    }

    private function detail(?Command $console, string $message): void
    {
        if ($console && $console->getOutput()->isVerbose()) {
            $console->line($message);
        }
    }
}
