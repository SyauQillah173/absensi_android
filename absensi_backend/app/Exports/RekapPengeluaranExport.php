<?php

namespace App\Exports;

use App\Models\DocumentSetting;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class RekapPengeluaranExport implements WithMultipleSheets
{
    use Exportable;

    public function __construct(
        private readonly Collection $pengeluaran,
        private readonly array $filters = [],
        private readonly ?DocumentSetting $docSetting = null,
    ) {
    }

    public function sheets(): array
    {
        return [
            new RekapPengeluaranDetailSheet($this->pengeluaran, $this->filters, $this->docSetting),
            new RekapPengeluaranKategoriSheet($this->pengeluaran, $this->filters),
            new RekapPengeluaranBulananSheet($this->pengeluaran, $this->filters),
        ];
    }
}
