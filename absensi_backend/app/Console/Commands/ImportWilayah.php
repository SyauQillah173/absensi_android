<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportWilayah extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:import-wilayah';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import data master wilayah dari file SQL ke database';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $path = database_path('data/wilayah.sql');

        if (!file_exists($path)) {
            $this->error("File SQL tidak ditemukan di: {$path}");
            return 1;
        }

        $this->info("Membaca file SQL dari: {$path} ...");
        
        try {
            $sql = file_get_contents($path);
            
            $this->info("Menjalankan script SQL (ini mungkin butuh beberapa saat karena datanya besar) ...");
            DB::unprepared($sql);
            
            $this->info("Berhasil! Data wilayah sukses di-import ke database.");
            return 0;
        } catch (\Exception $e) {
            $this->error("Gagal import data wilayah: " . $e->getMessage());
            return 1;
        }
    }
}
