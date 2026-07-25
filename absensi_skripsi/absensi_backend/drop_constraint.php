<?php
use Illuminate\Support\Facades\DB;

$constraints = DB::select("SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'");
foreach ($constraints as $c) {
    DB::statement("ALTER TABLE users DROP CONSTRAINT " . $c->conname);
}
echo "Dropped constraints.\n";
