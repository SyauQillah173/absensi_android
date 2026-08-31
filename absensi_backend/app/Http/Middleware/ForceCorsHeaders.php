<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForceCorsHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('OPTIONS')) {
            return $this->applySecurityAndCorsHeaders(response('', 204), $request);
        }

        /** @var Response $response */
        $response = $next($request);

        return $this->applySecurityAndCorsHeaders($response, $request);
    }

    private function applySecurityAndCorsHeaders(Response $response, Request $request): Response
    {
        $origin = $request->headers->get('Origin');
        
        $allowedOrigins = [
            'https://absensi-android.vercel.app',
            'https://sisteminformasipondok.my.id',
            'https://www.sisteminformasipondok.my.id',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://43.156.154.97:3000',
            'https://ppqomaruddin.itqom.net'
        ];

        // 1. CORS Headers (Strict Mode)
        if ($origin && in_array($origin, $allowedOrigins)) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
        }
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-TOKEN');
        $response->headers->set('Access-Control-Max-Age', '86400');
        $response->headers->set('Vary', 'Origin');

        // 2. OWASP Standard HTTP Security Headers (Protection Shield)
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Content-Security-Policy', "frame-ancestors 'self'");
        
        // Sembunyikan versi PHP
        header_remove('X-Powered-By');
        
        if ($request->isSecure() || app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        return $response;
    }
}
