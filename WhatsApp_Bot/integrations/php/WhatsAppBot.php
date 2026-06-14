<?php

/**
 * ============================================
 * WhatsApp Bot — PHP Integration Class
 * Pondok Pesantren Qomaruddin
 * ============================================
 *
 * Class PHP untuk memanggil API bot WhatsApp.
 * Bisa dipakai di Laravel, CodeIgniter, atau PHP native.
 *
 * Contoh pemakaian:
 *   $bot = new WhatsAppBot('http://localhost:3001', 'secret_key_kamu');
 *   $bot->kirim('6281234567890', 'Halo dari PHP!');
 */

class WhatsAppBot
{
    private string $baseUrl;
    private string $secret;
    private int $timeout;

    /**
     * @param string $baseUrl  URL bot WhatsApp (contoh: http://localhost:3001)
     * @param string $secret   Secret key dari file .env bot
     * @param int    $timeout  Timeout HTTP dalam detik (default 30)
     */
    public function __construct(string $baseUrl = 'http://localhost:3001', string $secret = '', int $timeout = 30)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->secret  = $secret;
        $this->timeout = $timeout;
    }

    // ──────────────────────────────────────
    // Method Utama
    // ──────────────────────────────────────

    /**
     * Kirim pesan ke satu nomor.
     *
     * @param  string $nomor  Nomor tujuan (format 62xxx)
     * @param  string $pesan  Isi pesan (mendukung WhatsApp markdown)
     * @return array          ['sukses' => bool, 'data' => ..., 'pesan' => ...]
     */
    public function kirim(string $nomor, string $pesan): array
    {
        return $this->post('/kirim', [
            'nomor' => $nomor,
            'pesan' => $pesan,
        ]);
    }

    /**
     * Kirim pesan ke banyak nomor sekaligus.
     *
     * @param  array  $arrayNomor  Daftar nomor tujuan
     * @param  string $pesan       Isi pesan
     * @return array               Hasil per nomor
     */
    public function kirimBulk(array $arrayNomor, string $pesan): array
    {
        return $this->post('/kirim-bulk', [
            'nomor' => $arrayNomor,
            'pesan' => $pesan,
        ]);
    }

    /**
     * Cek apakah bot aktif dan siap kirim pesan.
     *
     * @return bool
     */
    public function cekStatus(): bool
    {
        try {
            $result = $this->get('/health');
            return isset($result['data']['status']) && $result['data']['status'] === 'aktif';
        } catch (\Exception $e) {
            return false;
        }
    }

    // ──────────────────────────────────────
    // Template Pesan Siap Pakai
    // ──────────────────────────────────────

    /**
     * Skenario 1: Notifikasi tagihan pembayaran baru.
     */
    public function notifTagihanBaru(string $nomor, array $data): array
    {
        $pesan = "*📋 TAGIHAN BARU*\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "Santri: *{$data['nama_santri']}*\n"
            . "Kelas: {$data['kelas']}\n"
            . "Jenis: {$data['jenis_tagihan']}\n"
            . "Nominal: *Rp " . number_format($data['nominal'], 0, ',', '.') . "*\n"
            . "Jatuh Tempo: {$data['jatuh_tempo']}\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "_Silakan lakukan pembayaran sebelum jatuh tempo._\n"
            . "\nPondok Pesantren Qomaruddin";

        return $this->kirim($nomor, $pesan);
    }

    /**
     * Skenario 2: Konfirmasi pembayaran berhasil.
     */
    public function notifPembayaranBerhasil(string $nomor, array $data): array
    {
        $pesan = "*✅ PEMBAYARAN DITERIMA*\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "Santri: *{$data['nama_santri']}*\n"
            . "Jenis: {$data['jenis_pembayaran']}\n"
            . "Nominal: *Rp " . number_format($data['nominal'], 0, ',', '.') . "*\n"
            . "Via: {$data['metode']}\n"
            . "Tanggal: {$data['tanggal']}\n"
            . "No. Transaksi: {$data['kode_transaksi']}\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "_Terima kasih atas pembayarannya._ 🙏\n"
            . "\nPondok Pesantren Qomaruddin";

        return $this->kirim($nomor, $pesan);
    }

    /**
     * Skenario 3: Notifikasi admin saat ada error/exception.
     */
    public function notifErrorAdmin(string $nomorAdmin, string $pesan): array
    {
        $waktu = date('d/m/Y H:i:s');
        $pesanFormatted = "⚠️ *ALERT SISTEM*\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "Waktu: {$waktu}\n"
            . "Pesan: _{$pesan}_\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "Segera periksa sistem.";

        return $this->kirim($nomorAdmin, $pesanFormatted);
    }

    /**
     * Skenario 4: Reminder tagihan H-1 jatuh tempo.
     */
    public function notifReminderTagihan(string $nomor, array $data): array
    {
        $pesan = "🔔 *PENGINGAT TAGIHAN*\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "Assalamu'alaikum,\n\n"
            . "Mengingatkan bahwa tagihan *{$data['jenis_tagihan']}* "
            . "untuk santri *{$data['nama_santri']}* "
            . "sebesar *Rp " . number_format($data['nominal'], 0, ',', '.') . "* "
            . "akan jatuh tempo *besok ({$data['jatuh_tempo']})*.\n\n"
            . "_Mohon segera melakukan pembayaran agar tidak terlambat._\n"
            . "\nJazakumullahu khairan.\n"
            . "Pondok Pesantren Qomaruddin";

        return $this->kirim($nomor, $pesan);
    }

    /**
     * Notifikasi absensi harian ke wali.
     */
    public function notifAbsensiHarian(string $nomor, array $data): array
    {
        $pesan = "📝 *LAPORAN ABSENSI*\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "Santri: *{$data['nama_santri']}*\n"
            . "Kelas: {$data['kelas']}\n"
            . "Tanggal: {$data['tanggal']}\n\n";

        if (!empty($data['detail_mapel'])) {
            foreach ($data['detail_mapel'] as $item) {
                $emoji = $item['status'] === 'Hadir' ? '✅' : ($item['status'] === 'Sakit' ? '🤒' : ($item['status'] === 'Izin' ? '📝' : '❌'));
                $pesan .= "{$emoji} {$item['mapel']}: *{$item['status']}*\n";
            }
        }

        $pesan .= "━━━━━━━━━━━━━━━━━━\n"
            . "Pondok Pesantren Qomaruddin";

        return $this->kirim($nomor, $pesan);
    }

    // ──────────────────────────────────────
    // HTTP Helpers (cURL)
    // ──────────────────────────────────────

    private function post(string $endpoint, array $body): array
    {
        $ch = curl_init($this->baseUrl . $endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $this->timeout,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'x-bot-secret: ' . $this->secret,
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['sukses' => false, 'data' => null, 'pesan' => 'cURL error: ' . $error];
        }

        $result = json_decode($response, true);
        return $result ?: ['sukses' => false, 'data' => null, 'pesan' => "HTTP {$httpCode} — response kosong"];
    }

    private function get(string $endpoint): array
    {
        $ch = curl_init($this->baseUrl . $endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $this->timeout,
            CURLOPT_HTTPHEADER     => [
                'x-bot-secret: ' . $this->secret,
            ],
        ]);

        $response = curl_exec($ch);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \Exception('cURL error: ' . $error);
        }

        return json_decode($response, true) ?: [];
    }
}


// ══════════════════════════════════════
// CONTOH PEMAKAIAN
// ══════════════════════════════════════

/*
// Inisialisasi
$bot = new WhatsAppBot('http://localhost:3001', 'rahasia_bot_qomaruddin_2026');

// Cek status
if ($bot->cekStatus()) {
    echo "Bot aktif!\n";
} else {
    echo "Bot tidak aktif.\n";
}

// Kirim pesan biasa
$hasil = $bot->kirim('6281234567890', 'Halo dari Laravel!');
print_r($hasil);

// Kirim bulk
$hasil = $bot->kirimBulk(
    ['6281234567890', '6289876543210'],
    'Pengumuman untuk semua wali santri.'
);
print_r($hasil);

// Notifikasi tagihan baru
$bot->notifTagihanBaru('6281234567890', [
    'nama_santri'    => 'Ahmad Fauzi',
    'kelas'          => 'Sifir Awal A',
    'jenis_tagihan'  => 'SPP Bulanan',
    'nominal'        => 350000,
    'jatuh_tempo'    => '15 Juli 2026',
]);

// Konfirmasi pembayaran
$bot->notifPembayaranBerhasil('6281234567890', [
    'nama_santri'       => 'Ahmad Fauzi',
    'jenis_pembayaran'  => 'SPP Bulanan - Juli 2026',
    'nominal'           => 350000,
    'metode'            => 'Transfer Bank',
    'tanggal'           => '10 Juli 2026',
    'kode_transaksi'    => 'TRX-20260710-001',
]);

// Alert admin
$bot->notifErrorAdmin('6289876543210', 'Database connection timeout pada 10:30 WIB');

// Reminder H-1
$bot->notifReminderTagihan('6281234567890', [
    'nama_santri'    => 'Ahmad Fauzi',
    'jenis_tagihan'  => 'SPP Bulanan Agustus',
    'nominal'        => 350000,
    'jatuh_tempo'    => '15 Agustus 2026',
]);

// Notifikasi absensi harian
$bot->notifAbsensiHarian('6281234567890', [
    'nama_santri' => 'Ahmad Fauzi',
    'kelas'       => 'Sifir Awal A',
    'tanggal'     => '10 Juli 2026',
    'detail_mapel' => [
        ['mapel' => 'Akhlaq',   'status' => 'Hadir'],
        ['mapel' => 'Fiqih',    'status' => 'Hadir'],
        ['mapel' => 'Nahwu',    'status' => 'Izin'],
    ],
]);
*/
