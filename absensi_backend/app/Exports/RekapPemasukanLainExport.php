<?php

namespace App\Exports;

use App\Models\DocumentSetting;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class RekapPemasukanLainExport implements WithMultipleSheets
{
    use Exportable;

    public function __construct(
        private readonly Collection $pemasukan,
        private readonly array $filters = [],
        private readonly ?DocumentSetting $docSetting = null,
    ) {
    }

    public function sheets(): array
    {
        return [
            new RekapPemasukanLainDetailSheet($this->pemasukan, $this->filters, $this->docSetting),
            new RekapPemasukanLainKategoriSheet($this->pemasukan, $this->filters),
            new RekapPemasukanLainBulananSheet($this->pemasukan, $this->filters),
        ];
    }
}
