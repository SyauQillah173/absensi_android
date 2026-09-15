<?php

namespace App\Imports;

use App\Models\BoardingComplex;
use App\Models\BoardingRoom;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class BoardingRoomImport implements ToCollection, WithHeadingRow
{
    private int $importedCount = 0;
    private int $updatedCount = 0;

    public function collection(Collection $rows)
    {
        foreach ($rows as $row) {
            $namaKamar = trim((string)($row['nama_kamar'] ?? $row['kamar'] ?? ''));
            if (empty($namaKamar)) continue;

            $namaKomplek = trim((string)($row['komplek_asrama'] ?? $row['komplek'] ?? ''));
            $complex = null;
            if (!empty($namaKomplek)) {
                $complex = BoardingComplex::firstOrCreate(
                    ['name' => $namaKomplek],
                    ['gender' => 'Putra', 'is_active' => true]
                );
            }

            $capacity = !empty($row['kapasitas']) && is_numeric($row['kapasitas']) ? (int)$row['kapasitas'] : null;
            $description = trim((string)($row['keterangan'] ?? $row['deskripsi'] ?? ''));
            $statusRaw = strtolower(trim((string)($row['status'] ?? 'aktif')));
            $isActive = !in_array($statusRaw, ['nonaktif', '0', 'false', 'inactive']);

            $existing = BoardingRoom::where('name', $namaKamar)
                ->when($complex, fn($q) => $q->where('boarding_complex_id', $complex->id))
                ->first();

            if ($existing) {
                $existing->update([
                    'boarding_complex_id' => $complex?->id ?? $existing->boarding_complex_id,
                    'capacity' => $capacity ?? $existing->capacity,
                    'description' => !empty($description) ? $description : $existing->description,
                    'is_active' => $isActive,
                ]);
                $this->updatedCount++;
            } else {
                BoardingRoom::create([
                    'boarding_complex_id' => $complex?->id,
                    'name' => $namaKamar,
                    'capacity' => $capacity,
                    'description' => $description,
                    'is_active' => $isActive,
                ]);
                $this->importedCount++;
            }
        }
    }

    public function getImportedCount(): int
    {
        return $this->importedCount;
    }

    public function getUpdatedCount(): int
    {
        return $this->updatedCount;
    }
}
