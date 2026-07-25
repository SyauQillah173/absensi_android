<?php
use App\Models\User;
use Illuminate\Support\Facades\Hash;

$user = User::updateOrCreate(
    ['username' => 'kepsek'],
    [
        'name' => 'Imam Bashori',
        'email' => 'kepsek@skripsi.local',
        'password' => Hash::make('skripsi123'),
        'password_hash' => Hash::make('skripsi123'),
        'role' => 'kepala_sekolah',
        'status' => 'Aktif',
        'status_aktif' => true,
    ]
);
echo "User inserted: " . $user->username . " with role: " . $user->role . "\n";
