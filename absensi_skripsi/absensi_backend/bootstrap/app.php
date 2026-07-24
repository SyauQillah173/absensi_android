<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(\App\Http\Middleware\ForceCorsHeaders::class);
        $middleware->alias([
            'api.auth' => \App\Http\Middleware\AuthenticateApiToken::class,
            'role' => \App\Http\Middleware\EnsureApiRole::class,
            'permission' => \App\Http\Middleware\EnsureMenuPermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $e) => true);
        $exceptions->render(function (Throwable $e, Request $request) {
            $statusCode = 500;
            if ($e instanceof ValidationException) {
                $statusCode = 422;
            } elseif ($e instanceof HttpExceptionInterface) {
                $statusCode = $e->getStatusCode();
            }

            $payload = [
                'success' => false,
                'message' => $e instanceof ValidationException
                    ? 'Validasi gagal: ' . collect($e->errors())->flatten()->first()
                    : ($statusCode >= 500 && !config('app.debug') ? 'Terjadi kesalahan server' : $e->getMessage()),
            ];

            if ($e instanceof ValidationException) {
                $payload['errors'] = $e->errors();
            }

            if (config('app.debug')) {
                $payload['exception'] = get_class($e);
                $payload['file'] = basename($e->getFile());
                $payload['line'] = $e->getLine();
            }

            return new JsonResponse($payload, $statusCode);
        });
    })->create();
