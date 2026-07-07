<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        $keep = [
            'migrations',
            'users',
            'api_access_tokens',
            'guru',
            'kelas',
            'santri',
            'presensi',
            'detail_presensi',
            'sync_operations',
            'whatsapp_message_logs',
            'audit_logs',
        ];

        Schema::disableForeignKeyConstraints();
        foreach ($this->tables() as $table) {
            if (!in_array($table, $keep, true)) {
                $this->dropTable($table);
            }
        }
        Schema::enableForeignKeyConstraints();

        DB::table('users')->whereNotIn('role', ['admin', 'guru'])->delete();
    }

    private function tables(): array
    {
        return match (DB::getDriverName()) {
            'pgsql' => DB::table('information_schema.tables')
                ->where('table_schema', 'public')
                ->where('table_type', 'BASE TABLE')
                ->pluck('table_name')
                ->all(),
            'mysql', 'mariadb' => DB::table('information_schema.tables')
                ->where('table_schema', DB::getDatabaseName())
                ->where('table_type', 'BASE TABLE')
                ->pluck('table_name')
                ->all(),
            default => collect(DB::select("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"))
                ->pluck('name')
                ->all(),
        };
    }

    private function dropTable(string $table): void
    {
        $driver = DB::getDriverName();
        $quoted = str_replace('"', '""', $table);

        if ($driver === 'pgsql') {
            DB::statement('drop table if exists "'.$quoted.'" cascade');
            return;
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement('drop table if exists `'.str_replace('`', '``', $table).'`');
            return;
        }

        DB::statement('drop table if exists "'.$quoted.'"');
    }

    public function down(): void
    {
        // Tabel di luar BAB 1-3 sengaja tidak dibuat ulang.
    }
};
