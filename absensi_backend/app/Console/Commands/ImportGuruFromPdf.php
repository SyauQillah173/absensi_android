<?php

namespace App\Console\Commands;

use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class ImportGuruFromPdf extends Command
{
    protected $signature = 'guru:import-pdf {--force : Timpa data/password dengan default admin123 jika akun sudah ada}';
    protected $description = 'Import data master guru resmi Pesantren Qomaruddin dari DAFTAR GURU.pdf';

    public function handle(): int
    {
        $this->info('=================================================================');
        $this->info('     MIGRASI DATA GURU REAL PESANTREN QOMARUDDIN 2025/2026       ');
        $this->info('=================================================================');

        $guruList = $this->getDaftarGuru();
        $total = count($guruList);
        $this->info("Total data guru resmi dari PDF: {$total} Guru/Pengajar.\n");

        $defaultPassword = 'admin123';
        $hashedPassword = Hash::make($defaultPassword);
        $encryptedPassword = Crypt::encryptString($defaultPassword);

        $inserted = 0;
        $updated = 0;

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        DB::beginTransaction();
        try {
            foreach ($guruList as $item) {
                $code = strtoupper(trim($item['code']));
                $name = trim($item['name']);
                $gender = $item['gender'];

                // Check existing user by kode_guru or name
                $user = User::where('kode_guru', $code)
                    ->orWhereRaw('LOWER(name) = ?', [strtolower($name)])
                    ->first();

                if (!$user) {
                    $user = new User();
                    $user->password = $hashedPassword;
                    $user->password_default_encrypted = $encryptedPassword;
                    $user->password_current_encrypted = $encryptedPassword;
                    $user->password_changed_at = null;
                    $inserted++;
                } else {
                    if ($this->option('force') || empty($user->password_default_encrypted)) {
                        $user->password = $hashedPassword;
                        $user->password_default_encrypted = $encryptedPassword;
                        $user->password_current_encrypted = $encryptedPassword;
                        $user->password_changed_at = null;
                    }
                    $updated++;
                }

                $user->name = $name;
                $user->kode_guru = $code;
                $user->email = null; // Email dikosongkan sesuai permintaan
                $user->role = 'guru';
                $user->role_id = 2;
                $user->jenis_kelamin = $gender;
                $user->status = 'aktif';
                $user->user_status_id = 1;
                $user->unit_kerja = 'Madrasah Diniyah Pondok Pesantren Qomaruddin';
                $user->kategori_guru = 'guru';
                $user->save();

                // Sync TeacherProfile
                if (Schema::hasTable('teacher_profiles')) {
                    TeacherProfile::updateOrCreate(
                        ['user_id' => $user->id],
                        ['teacher_code' => $code]
                    );
                }

                $bar->advance();
            }

            DB::commit();
            $bar->finish();
            $this->newLine(2);

            $this->info("✓ BERHASIL MEMIGRASIKAN DATA GURU:");
            $this->info("   • Guru baru ditambahkan : {$inserted}");
            $this->info("   • Guru diperbarui       : {$updated}");
            $this->info("   • Total guru aktif      : {$total}");
            $this->info("   • Email Login           : Dikosongkan (null)");
            $this->info("   • Username Login        : Kode Guru (misal: AL, AT, AA, NM) atau Nama Lengkap Guru");
            $this->info("   • Password Login Awal   : {$defaultPassword}");
            $this->info('=================================================================');

            return 0;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->newLine();
            $this->error('Gagal import guru: ' . $e->getMessage());
            return 1;
        }
    }

    private function getDaftarGuru(): array
    {
        return [
            // Page 1 (43 Guru)
            ['code' => 'AL', 'name' => "K H. MUH. ALA'UDDIN", 'gender' => 'L'],
            ['code' => 'AT', 'name' => 'KH. ALI MUSTHOFA', 'gender' => 'L'],
            ['code' => 'AA', 'name' => 'KH. ASNAFI ARIF', 'gender' => 'L'],
            ['code' => 'AN', 'name' => 'KH. ABDUL QODIR', 'gender' => 'L'],
            ['code' => 'NW', 'name' => 'KH. NAWAWI SHOLIH', 'gender' => 'L'],
            ['code' => 'AW', 'name' => 'UST. ABD. WAJID', 'gender' => 'L'],
            ['code' => 'IM', 'name' => 'UST. IMAM BASHORI', 'gender' => 'L'],
            ['code' => 'IS', 'name' => 'UST. AHMAD ISA', 'gender' => 'L'],
            ['code' => 'RH', 'name' => 'UST. ABD. RAHMAN', 'gender' => 'L'],
            ['code' => 'NI', 'name' => "UST. H. AINUN NI'AM", 'gender' => 'L'],
            ['code' => 'MH', 'name' => 'UST. H. MASYKURI HASAN', 'gender' => 'L'],
            ['code' => 'MS', 'name' => 'UST. H. MUKHLAS FADLI', 'gender' => 'L'],
            ['code' => 'JB', 'name' => 'UST. AHMAD DJABIR', 'gender' => 'L'],
            ['code' => 'MU', 'name' => 'UST. MUDHOFAR USMAN', 'gender' => 'L'],
            ['code' => 'IK', 'name' => 'UST. ISMAIL KHOLILUR ROHMAN', 'gender' => 'L'],
            ['code' => 'LH', 'name' => 'UST. H. LUTFI HAKIM', 'gender' => 'L'],
            ['code' => 'SY', 'name' => 'UST. SYAMSUL ARIFIN', 'gender' => 'L'],
            ['code' => 'NJ', 'name' => 'UST. MOH. NAJIB MUJADID', 'gender' => 'L'],
            ['code' => 'RS', 'name' => 'UST. H. MOH.RUSYDI', 'gender' => 'L'],
            ['code' => 'AB', 'name' => 'UST. H. ABDULLAH', 'gender' => 'L'],
            ['code' => 'NS', 'name' => 'UST. AHMAD NASIKH', 'gender' => 'L'],
            ['code' => 'FR', 'name' => 'UST. FATHUR ROHMAN', 'gender' => 'L'],
            ['code' => 'SH', 'name' => 'UST. H. A. SHOLIHAN', 'gender' => 'L'],
            ['code' => 'AD', 'name' => 'UST. AHMAD MUSADDAD ADIB', 'gender' => 'L'],
            ['code' => 'AK', 'name' => "UST. ABDUL KHOLIQ NU'MAN", 'gender' => 'L'],
            ['code' => 'NH', 'name' => 'UST. NUR HAMID', 'gender' => 'L'],
            ['code' => 'ID', 'name' => 'UST. ISLAHUDDIN', 'gender' => 'L'],
            ['code' => 'SM', 'name' => "UST. M.SYAIKHU MU'MIN", 'gender' => 'L'],
            ['code' => 'SL', 'name' => 'UST. H. MOH. SALIM', 'gender' => 'L'],
            ['code' => 'MA', 'name' => 'UST. H. AHMAD MAHDI', 'gender' => 'L'],
            ['code' => 'HA', 'name' => 'UST. HASYIM ASYARI', 'gender' => 'L'],
            ['code' => 'IH', 'name' => 'UST. MOH. IHSANUL KIROM', 'gender' => 'L'],
            ['code' => 'AH', 'name' => 'UST. AHMAD SYAIKHU', 'gender' => 'L'],
            ['code' => 'MZ', 'name' => 'UST. MOH.ZAINUDDIN', 'gender' => 'L'],
            ['code' => 'SA', 'name' => 'UST. H. SENIDI ARIF', 'gender' => 'L'],
            ['code' => 'WS', 'name' => 'UST. AHMAD WASIL', 'gender' => 'L'],
            ['code' => 'ZA', 'name' => 'UST. ZAINUL ARIFIN', 'gender' => 'L'],
            ['code' => 'KH', 'name' => 'UST. KHOIRUL HUDA', 'gender' => 'L'],
            ['code' => 'KR', 'name' => 'UST. KHOLILUR ROHMAN', 'gender' => 'L'],
            ['code' => 'MM', 'name' => 'UST. AHMAD MUAD', 'gender' => 'L'],
            ['code' => 'SF', 'name' => "UST. SYAFI'UDDIN", 'gender' => 'L'],
            ['code' => 'SO', 'name' => 'UST. FAISHOL AMIN', 'gender' => 'L'],
            ['code' => 'HH', 'name' => 'UST. HAMAM HIDYATULLAH', 'gender' => 'L'],

            // Page 2 (44 Guru)
            ['code' => 'LA', 'name' => 'UST. AHMAD ADLAN ARIEF', 'gender' => 'L'],
            ['code' => 'AG', 'name' => 'UST. AGIL MUHAMMAD', 'gender' => 'L'],
            ['code' => 'BZ', 'name' => 'UST. AHMAD BAZI', 'gender' => 'L'],
            ['code' => 'AM', 'name' => 'UST. AHMAD MAIMUN ZUBER', 'gender' => 'L'],
            ['code' => 'RF', 'name' => 'UST. AHMAD ROFII', 'gender' => 'L'],
            ['code' => 'AX', 'name' => 'UST. ALEK SALIM', 'gender' => 'L'],
            ['code' => 'NN', 'name' => 'UST. ANWARIL YUNUS', 'gender' => 'L'],
            ['code' => 'DI', 'name' => 'UST. MUHAMMAD SHOLICHU DINIK', 'gender' => 'L'],
            ['code' => 'RN', 'name' => 'UST. M.SHOLIHUDDIN NURAINI', 'gender' => 'L'],
            ['code' => 'MR', 'name' => 'UST. MAKRUS', 'gender' => 'L'],
            ['code' => 'MN', 'name' => "UST. MIFTAHUN NA'IM", 'gender' => 'L'],
            ['code' => 'AQ', 'name' => 'UST. MUHAMMAD ATIQ MUJAHID', 'gender' => 'L'],
            ['code' => 'MQ', 'name' => 'UST. MUSTAQIM', 'gender' => 'L'],
            ['code' => 'NF', 'name' => 'UST. NANANG FATHUR ROZI', 'gender' => 'L'],
            ['code' => 'ND', 'name' => 'UST. NANDO QOMARUDDIN', 'gender' => 'L'],
            ['code' => 'NR', 'name' => 'UST. NASIRUDDIN', 'gender' => 'L'],
            ['code' => 'AZ', 'name' => 'UST. AHMAD ZAKI', 'gender' => 'L'],
            ['code' => 'RQ', 'name' => 'UST. RIFQI', 'gender' => 'L'],
            ['code' => 'SP', 'name' => 'UST. SUFYAN HADI', 'gender' => 'L'],
            ['code' => 'ST', 'name' => 'UST. SULTON JUNAIDI', 'gender' => 'L'],
            ['code' => 'UL', 'name' => 'UST. ULUL AZMI', 'gender' => 'L'],
            ['code' => 'WY', 'name' => 'UST. M. WAHYU AMRULLOH', 'gender' => 'L'],
            ['code' => 'IZ', 'name' => 'UST. FADLU AINUL IZZI', 'gender' => 'L'],
            ['code' => 'QT', 'name' => 'UST. MUHAMMAD QUTHUB', 'gender' => 'L'],
            ['code' => 'HM', 'name' => 'UST. H. HASAN MAHFUDZ', 'gender' => 'L'],
            ['code' => 'IT', 'name' => 'UST. IQBAL THORIQ', 'gender' => 'L'],
            ['code' => 'NB', 'name' => 'UST. AHMAD NAJIB', 'gender' => 'L'],
            ['code' => 'TS', 'name' => 'UST. TSALIS FAHMI', 'gender' => 'L'],
            ['code' => 'BM', 'name' => 'UST. ALBAB MAHERA', 'gender' => 'L'],
            ['code' => 'DL', 'name' => 'UST. DLIYAUL ATQON', 'gender' => 'L'],
            ['code' => 'MT', 'name' => 'USTD. MUMTAZZAH MINHATUL MAULA', 'gender' => 'P'],
            ['code' => 'FA', 'name' => 'USTD. HJ MAS FAUZIAH', 'gender' => 'P'],
            ['code' => 'HS', 'name' => "BU NYAI HJ. HALIMATUS SA'DIYAH", 'gender' => 'P'],
            ['code' => 'IR', 'name' => 'USTD. IDA RAHAYU', 'gender' => 'P'],
            ['code' => 'IL', 'name' => 'USTD. ILMIYAH', 'gender' => 'P'],
            ['code' => 'LZ', 'name' => 'USTD. LILIK ZULIYATIN', 'gender' => 'P'],
            ['code' => 'MC', 'name' => 'USTD. MARCHUMA', 'gender' => 'P'],
            ['code' => 'MF', 'name' => 'USTD. NURUL MUFIDAH', 'gender' => 'P'],
            ['code' => 'QR', 'name' => "USTD. QORRY 'AINA", 'gender' => 'P'],
            ['code' => 'SI', 'name' => 'USTD. SALWA IBRAHIM', 'gender' => 'P'],
            ['code' => 'AY', 'name' => 'USTD. SITI AISAH', 'gender' => 'P'],
            ['code' => 'SN', 'name' => "USTD. SITI MAF'UDAH", 'gender' => 'P'],
            ['code' => 'TB', 'name' => 'USTD. THOYYIBAH BINASRILLAH', 'gender' => 'P'],
            ['code' => 'US', 'name' => 'USTD. UHKUWA SAHAMA', 'gender' => 'P'],

            // Page 3 (3 Guru)
            ['code' => 'NM', 'name' => 'USTD. NURUL MASRIFAH', 'gender' => 'P'],
            ['code' => 'DN', 'name' => 'USTD. DINA', 'gender' => 'P'],
            ['code' => 'DA', 'name' => 'USTD. DWI AMNI', 'gender' => 'P'],
        ];
    }
}
