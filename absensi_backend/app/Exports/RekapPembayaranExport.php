<?php

namespace App\Exports;

use App\Models\DocumentSetting;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class RekapPembayaranExport implements WithMultipleSheets
{
    use Exportable;

    public function __construct(
        private readonly Collection $transactions,
        private readonly array $filters = [],
        private readonly ?DocumentSetting $docSetting = null,
    ) {
    }

    public function sheets(): array
    {
        return [
            new RekapTransaksiSheet($this->transactions, $this->filters, $this->docSetting),
            new RekapPerSantriSheet($this->transactions, $this->filters),
            new RekapPerTipeSheet($this->transactions, $this->filters),
        ];
    }
}
