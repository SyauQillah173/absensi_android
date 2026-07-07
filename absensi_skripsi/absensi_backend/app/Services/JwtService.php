<?php

namespace App\Services;

use Illuminate\Support\Str;
use RuntimeException;

class JwtService
{
    public function issue(int $userId, string $role): string
    {
        $now = now()->timestamp;

        return $this->encode([
            'iss' => config('app.url'),
            'sub' => (string) $userId,
            'role' => $role,
            'iat' => $now,
            'exp' => $now + 86400,
            'jti' => (string) Str::uuid(),
        ]);
    }

    public function decode(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new RuntimeException('Format JWT tidak valid.');
        }

        [$header, $payload, $signature] = $parts;
        $expected = $this->base64Url(hash_hmac('sha256', "{$header}.{$payload}", $this->secret(), true));
        if (!hash_equals($expected, $signature)) {
            throw new RuntimeException('Tanda tangan JWT tidak valid.');
        }

        $claims = json_decode($this->base64UrlDecode($payload), true, flags: JSON_THROW_ON_ERROR);
        if (($claims['exp'] ?? 0) < now()->timestamp) {
            throw new RuntimeException('JWT sudah kedaluwarsa.');
        }

        return $claims;
    }

    private function encode(array $claims): string
    {
        $header = $this->base64Url(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $payload = $this->base64Url(json_encode($claims, JSON_THROW_ON_ERROR));
        $signature = $this->base64Url(hash_hmac('sha256', "{$header}.{$payload}", $this->secret(), true));

        return "{$header}.{$payload}.{$signature}";
    }

    private function secret(): string
    {
        $secret = (string) config('app.key');
        if (str_starts_with($secret, 'base64:')) {
            $secret = base64_decode(substr($secret, 7), true) ?: $secret;
        }

        return $secret;
    }

    private function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $value): string
    {
        return base64_decode(strtr($value, '-_', '+/')) ?: '';
    }
}
