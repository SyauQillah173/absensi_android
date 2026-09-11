<?php

namespace App\Services;

use Illuminate\Http\Request;

class DeviceDetectorService
{
    /**
     * Mendeteksi informasi perangkat, browser, sistem operasi, IP, dan lokasi dari HTTP Request
     */
    public static function detect(Request $request): array
    {
        $userAgent = (string) ($request->userAgent() ?? '');
        $ip = self::resolveIp($request);
        $location = self::resolveLocation($request, $ip);

        $deviceType = self::detectDeviceType($userAgent);
        $platform = self::detectPlatform($userAgent);
        $browser = self::detectBrowser($userAgent);
        $deviceName = self::detectDeviceName($userAgent, $deviceType, $platform);

        return [
            'device_type' => $deviceType,
            'device_name' => $deviceName,
            'platform'    => $platform,
            'browser'     => $browser,
            'ip_address'  => $ip,
            'location'    => $location,
            'user_agent'  => substr($userAgent, 0, 500),
        ];
    }

    /**
     * Mendapatkan alamat IP asli client (mendukung Cloudflare Proxy & Reverse Proxy)
     */
    public static function resolveIp(Request $request): string
    {
        $headers = [
            'CF-Connecting-IP',
            'True-Client-IP',
            'X-Forwarded-For',
            'X-Real-IP',
        ];

        foreach ($headers as $header) {
            $val = $request->header($header);
            if ($val) {
                // Jika X-Forwarded-For berisi rantai IP, ambil IP pertama (client asli)
                if (str_contains($val, ',')) {
                    $val = trim(explode(',', $val)[0]);
                }
                if (filter_var($val, FILTER_VALIDATE_IP)) {
                    return $val;
                }
            }
        }

        return $request->ip() ?: '127.0.0.1';
    }

    /**
     * Memperkirakan lokasi berdasarkan IP / Header Cloudflare
     */
    public static function resolveLocation(Request $request, string $ip): string
    {
        // 1. Jika melalui Cloudflare
        $cfCity = $request->header('CF-IPCity');
        $cfCountry = $request->header('CF-IPCountry');
        if ($cfCity || $cfCountry) {
            $parts = array_filter([$cfCity, $cfCountry]);
            return implode(', ', $parts);
        }

        // 2. Cek apakah IP Lokal / Private LAN Pesantren
        if (
            $ip === '127.0.0.1' ||
            $ip === '::1' ||
            str_starts_with($ip, '192.168.') ||
            str_starts_with($ip, '10.') ||
            preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $ip)
        ) {
            return 'Jaringan Lokal Pesantren (LAN/Wi-Fi)';
        }

        // 3. Fallback format informatif untuk IP Publik Indonesia
        return 'Indonesia (IP Publik)';
    }

    /**
     * Mendeteksi jenis perangkat: mobile, tablet, desktop, atau bot
     */
    public static function detectDeviceType(string $ua): string
    {
        if (preg_match('/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i', $ua)) {
            return 'tablet';
        }

        if (preg_match('/(mobile|iphone|ipod|blackberry|opera mini|opera mobi|iemobile|wpdesktop)/i', $ua)) {
            return 'mobile';
        }

        if (str_contains($ua, 'Dart') || str_contains($ua, 'Flutter')) {
            return 'mobile';
        }

        return 'desktop';
    }

    /**
     * Mendeteksi Platform / Sistem Operasi
     */
    public static function detectPlatform(string $ua): string
    {
        if (preg_match('/android/i', $ua)) {
            if (preg_match('/android\s+([0-9\.]+)/i', $ua, $matches)) {
                return 'Android ' . $matches[1];
            }
            return 'Android';
        }

        if (preg_match('/iphone/i', $ua)) {
            if (preg_match('/os\s+([0-9_]+)/i', $ua, $matches)) {
                return 'iOS ' . str_replace('_', '.', $matches[1]);
            }
            return 'iOS (iPhone)';
        }

        if (preg_match('/ipad/i', $ua)) {
            return 'iPadOS';
        }

        if (preg_match('/windows nt 10\.0/i', $ua)) {
            return 'Windows 10 / 11';
        }

        if (preg_match('/windows nt 6\.3/i', $ua)) {
            return 'Windows 8.1';
        }

        if (preg_match('/windows nt 6\.1/i', $ua)) {
            return 'Windows 7';
        }

        if (preg_match('/macintosh|mac os x/i', $ua)) {
            return 'macOS';
        }

        if (preg_match('/linux/i', $ua)) {
            return 'Linux';
        }

        if (preg_match('/cros/i', $ua)) {
            return 'Chrome OS';
        }

        return 'Unknown OS';
    }

    /**
     * Mendeteksi Browser / Client
     */
    public static function detectBrowser(string $ua): string
    {
        if (str_contains($ua, 'Dart') || str_contains($ua, 'Flutter')) {
            return 'Aplikasi Mobile Pesantren';
        }

        if (preg_match('/edg\/([0-9\.]+)/i', $ua, $m)) {
            return 'Microsoft Edge ' . explode('.', $m[1])[0];
        }

        if (preg_match('/samsungbrowser\/([0-9\.]+)/i', $ua, $m)) {
            return 'Samsung Internet ' . explode('.', $m[1])[0];
        }

        if (preg_match('/opr\/([0-9\.]+)|opera/i', $ua, $m)) {
            return 'Opera';
        }

        if (preg_match('/chrome\/([0-9\.]+)/i', $ua, $m)) {
            return 'Chrome ' . explode('.', $m[1])[0];
        }

        if (preg_match('/firefox\/([0-9\.]+)/i', $ua, $m)) {
            return 'Firefox ' . explode('.', $m[1])[0];
        }

        if (preg_match('/safari/i', $ua) && !preg_match('/chrome/i', $ua)) {
            return 'Safari';
        }

        return 'Web Browser';
    }

    /**
     * Mendeteksi Nama Brand / Model Perangkat
     */
    public static function detectDeviceName(string $ua, string $deviceType, string $platform): string
    {
        // 1. Apple Devices
        if (preg_match('/iphone/i', $ua)) {
            return 'Apple iPhone';
        }
        if (preg_match('/ipad/i', $ua)) {
            return 'Apple iPad';
        }
        if (preg_match('/macintosh|mac os x/i', $ua)) {
            return 'Apple MacBook / iMac';
        }

        // 2. Android Brand Detection
        if (preg_match('/(samsung|sm-[a-z0-9]+)/i', $ua)) {
            return 'Samsung Galaxy';
        }
        if (preg_match('/(redmi|m2[0-9]+|xiaomi|poco)/i', $ua)) {
            return 'Xiaomi / Redmi';
        }
        if (preg_match('/(oppo|cph[0-9]+)/i', $ua)) {
            return 'Oppo Smartphone';
        }
        if (preg_match('/(vivo|v2[0-9]+)/i', $ua)) {
            return 'Vivo Smartphone';
        }
        if (preg_match('/(realme|rmx[0-9]+)/i', $ua)) {
            return 'Realme Smartphone';
        }
        if (preg_match('/infinix/i', $ua)) {
            return 'Infinix Smartphone';
        }

        // 3. Desktop
        if ($deviceType === 'desktop') {
            if (str_contains($platform, 'Windows')) {
                return 'Laptop / Komputer Windows';
            }
            if (str_contains($platform, 'Linux')) {
                return 'Linux Workstation';
            }
            return 'Desktop Computer';
        }

        // 4. Fallback
        return $deviceType === 'mobile' ? 'Smartphone Android' : 'Perangkat Terhubung';
    }
}
