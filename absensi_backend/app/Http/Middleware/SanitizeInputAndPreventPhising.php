<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SanitizeInputAndPreventPhising
{
    /**
     * Pattern berbahaya yang biasa digunakan untuk XSS, Phising Injection, dan RCE.
     */
    protected array $dangerousPatterns = [
        '/<script\b[^>]*>(.*?)<\/script>/is',
        '/<iframe\b[^>]*>(.*?)<\/iframe>/is',
        '/<embed\b[^>]*>(.*?)<\/embed>/is',
        '/<object\b[^>]*>(.*?)<\/object>/is',
        '/javascript\s*:/i',
        '/vbscript\s*:/i',
        '/data\s*:\s*text\/html/i',
        '/onload\s*=\s*[\'"][^\'"]*[\'"]/i',
        '/onerror\s*=\s*[\'"][^\'"]*[\'"]/i',
        '/onclick\s*=\s*[\'"][^\'"]*[\'"]/i',
        '/onmouseover\s*=\s*[\'"][^\'"]*[\'"]/i',
        '/onfocus\s*=\s*[\'"][^\'"]*[\'"]/i',
    ];

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Bersihkan seluruh input request dari script jahat dan injection
        $input = $request->all();

        if (!empty($input)) {
            $sanitized = $this->cleanArray($input);
            $request->replace($sanitized);
        }

        return $next($request);
    }

    /**
     * Recursively sanitize all array values.
     */
    protected function cleanArray(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = $this->cleanArray($value);
            } elseif (is_string($value)) {
                $data[$key] = $this->cleanString($value, $key);
            }
        }

        return $data;
    }

    /**
     * Clean individual string value from phising and XSS payloads.
     */
    protected function cleanString(string $value, string $key): string
    {
        // Jangan bersihkan field password agar karakter password acak tidak berubah
        if (str_contains(strtolower($key), 'password')) {
            return $value;
        }

        // Hapus tag HTML berbahaya & script
        $cleaned = $value;
        foreach ($this->dangerousPatterns as $pattern) {
            $cleaned = preg_replace($pattern, '', $cleaned);
        }

        // Strip tag berbahaya tetapi tetap memperbolehkan teks normal
        $cleaned = strip_tags($cleaned, '<b><strong><i><em><u><p><br><ul><ol><li>');

        // Mencegah path traversal sederhana pada string
        if (str_contains($cleaned, '../') || str_contains($cleaned, '..\\')) {
            $cleaned = str_replace(['../', '..\\'], '', $cleaned);
        }

        return trim($cleaned);
    }
}
