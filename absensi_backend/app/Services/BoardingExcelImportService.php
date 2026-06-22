<?php

namespace App\Services;

use App\Models\BoardingComplex;
use App\Models\BoardingRoom;
use App\Models\Siswa;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use ZipArchive;

class BoardingExcelImportService
{
    public function import(string $path, ?Command $console = null): array
    {
        if (!class_exists(ZipArchive::class)) {
            throw new RuntimeException('Ekstensi PHP zip belum aktif, tidak bisa membaca file .xlsx.');
        }
        if (!is_file($path)) {
            throw new RuntimeException("File Excel tidak ditemukan: {$path}");
        }

        $rows = $this->readRows($path);
        $stats = [
            'total_rows' => count($rows),
            'matched' => 0,
            'not_found' => 0,
            'ambiguous' => 0,
            'rooms' => 0,
            'warnings' => [],
        ];

        DB::transaction(function () use ($rows, $console, &$stats) {
            $roomCache = [];

            foreach ($rows as $row) {
                $complex = BoardingComplex::firstOrCreate(
                    ['name' => $row['komplek']],
                    ['sort_order' => count($roomCache), 'is_active' => true],
                );
                $roomKey = $complex->id . '|' . $row['kamar'];
                $room = $roomCache[$roomKey] ?? BoardingRoom::firstOrCreate(
                    ['boarding_complex_id' => $complex->id, 'name' => $row['kamar']],
                    ['sort_order' => count($roomCache), 'is_active' => true],
                );
                $roomCache[$roomKey] = $room;

                $matches = $this->matchStudent($row);
                if ($matches->count() === 1) {
                    $siswa = $matches->first();
                    $siswa->update([
                        'boarding_room_id' => $room->id,
                        'komplek' => $complex->name,
                        'kamar' => $room->name,
                        'status_mondok' => 'mondok',
                    ]);
                    $stats['matched']++;
                } elseif ($matches->count() > 1) {
                    $stats['ambiguous']++;
                    $stats['warnings'][] = $this->warning($row, 'Nama cocok lebih dari satu santri.');
                } else {
                    $stats['not_found']++;
                    $stats['warnings'][] = $this->warning($row, 'Santri tidak ditemukan di database.');
                }

                if ($console && ($stats['matched'] + $stats['not_found'] + $stats['ambiguous']) % 50 === 0) {
                    $console->line('Diproses: ' . ($stats['matched'] + $stats['not_found'] + $stats['ambiguous']));
                }
            }

            $stats['rooms'] = count($roomCache);
        });

        return $stats;
    }

    private function matchStudent(array $row)
    {
        $targetName = $this->normalize($row['nama']);
        $targetClass = $this->normalize($row['kelas']);

        $firstToken = strtok($row['nama'], ' ') ?: $row['nama'];

        return Siswa::query()
            ->where('nama', 'ilike', '%' . $firstToken . '%')
            ->get()
            ->filter(function (Siswa $siswa) use ($targetName, $targetClass) {
                if ($this->normalize($siswa->nama) !== $targetName) {
                    return false;
                }
                if ($targetClass === '') {
                    return true;
                }
                return $this->normalize($siswa->kelas) === $targetClass;
            })
            ->values();
    }

    private function readRows(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new RuntimeException('File Excel gagal dibuka.');
        }

        try {
            $shared = $this->sharedStrings($zip);
            $workbook = simplexml_load_string($zip->getFromName('xl/workbook.xml'));
            $rels = simplexml_load_string($zip->getFromName('xl/_rels/workbook.xml.rels'));
            $relsById = [];
            foreach ($rels->Relationship as $rel) {
                $attrs = $rel->attributes();
                $relsById[(string) $attrs['Id']] = (string) $attrs['Target'];
            }

            $rows = [];
            foreach ($workbook->sheets->sheet as $sheet) {
                $attrs = $sheet->attributes();
                $sheetName = (string) $attrs['name'];
                if (!str_starts_with($sheetName, 'KOMPLEK')) {
                    continue;
                }
                $relAttrs = $sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships');
                $target = $relsById[(string) $relAttrs['id']] ?? null;
                if (!$target) {
                    continue;
                }

                $worksheetPath = 'xl/' . ltrim($target, '/');
                if (!str_starts_with($worksheetPath, 'xl/worksheets/')) {
                    $worksheetPath = 'xl/worksheets/' . basename($target);
                }
                $xml = simplexml_load_string($zip->getFromName($worksheetPath));
                $currentRoom = null;

                foreach ($xml->sheetData->row as $rowNode) {
                    $rowIndex = (int) $rowNode->attributes()['r'];
                    if ($rowIndex < 8) {
                        continue;
                    }

                    $cells = [];
                    foreach ($rowNode->c as $cell) {
                        $ref = (string) $cell->attributes()['r'];
                        $col = preg_replace('/\d+/', '', $ref);
                        $cells[$col] = $this->cellValue($cell, $shared);
                    }

                    if (!empty($cells['A'])) {
                        $currentRoom = trim($cells['A']);
                    }
                    $name = trim($cells['C'] ?? '');
                    if (!$currentRoom || $name === '') {
                        continue;
                    }

                    $rows[] = [
                        'komplek' => $sheetName,
                        'kamar' => $currentRoom,
                        'no' => trim($cells['B'] ?? ''),
                        'nama' => $name,
                        'kelas' => trim($cells['D'] ?? ''),
                    ];
                }
            }

            return $rows;
        } finally {
            $zip->close();
        }
    }

    private function sharedStrings(ZipArchive $zip): array
    {
        $content = $zip->getFromName('xl/sharedStrings.xml');
        if ($content === false) {
            return [];
        }

        $xml = simplexml_load_string($content);
        $strings = [];
        foreach ($xml->si as $item) {
            $texts = [];
            if (isset($item->t)) {
                $texts[] = (string) $item->t;
            }
            foreach ($item->r ?? [] as $run) {
                $texts[] = (string) $run->t;
            }
            $strings[] = implode('', $texts);
        }

        return $strings;
    }

    private function cellValue(\SimpleXMLElement $cell, array $shared): string
    {
        $attrs = $cell->attributes();
        $value = (string) ($cell->v ?? '');
        if ((string) ($attrs['t'] ?? '') === 's') {
            return $shared[(int) $value] ?? '';
        }

        return $value;
    }

    private function normalize(?string $value): string
    {
        $upper = mb_strtoupper(trim((string) $value));
        $upper = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $upper) ?? $upper;
        return trim(preg_replace('/\s+/', ' ', $upper) ?? $upper);
    }

    private function warning(array $row, string $message): array
    {
        return [
            'komplek' => $row['komplek'],
            'kamar' => $row['kamar'],
            'nama' => $row['nama'],
            'kelas' => $row['kelas'],
            'message' => $message,
        ];
    }
}
