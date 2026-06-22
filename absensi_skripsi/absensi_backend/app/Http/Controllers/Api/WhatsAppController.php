<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationSetting;
use App\Models\WhatsAppConnectedClient;
use App\Models\WhatsAppMessageLog;
use App\Models\WhatsAppTemplate;
use App\Services\ActorResolver;
use App\Services\WhatsAppBotService;
use App\Services\WhatsAppNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WhatsAppController extends Controller
{
    public function __construct(
        private readonly WhatsAppBotService $bot,
        private readonly WhatsAppNotificationService $notifications,
    ) {
    }

    public function status(Request $request)
    {
        $this->touchClient($request);
        $health = $this->bot->health();
        $sessions = $this->bot->syncSessions();

        return response()->json([
            'success' => true,
            'data' => [
                'configured' => $this->bot->configured(),
                'bot' => $health,
                'sessions' => $sessions,
                'clients' => WhatsAppConnectedClient::query()->latest('last_seen_at')->limit(20)->get(),
                'message_counts' => WhatsAppMessageLog::query()
                    ->select('status', DB::raw('count(*) as total'))
                    ->groupBy('status')
                    ->pluck('total', 'status'),
                'recent_messages' => $this->messageQuery($request)->limit(20)->get(),
            ],
        ]);
    }

    public function connect(Request $request)
    {
        $validated = $request->validate([
            'client_id' => 'nullable|string|max:80',
            'client_name' => 'nullable|string|max:120',
        ]);

        $clientId = $validated['client_id'] ?? 'qomaruddin_main';
        $response = $this->bot->createSession($clientId, $validated['client_name'] ?? 'Qomaruddin Utama');
        $this->bot->syncSessions();

        return response()->json([
            'success' => $response['success'] ?? false,
            'message' => $response['message'] ?? 'Permintaan koneksi WhatsApp dikirim',
            'data' => $response['data'] ?? null,
        ], ($response['success'] ?? false) ? 200 : 422);
    }

    public function qr(Request $request)
    {
        $clientId = $request->query('client_id');
        $sessions = $this->bot->syncSessions();
        $session = collect($sessions)->first(function ($item) use ($clientId) {
            return !$clientId || $item->client_id === $clientId;
        });

        return response()->json([
            'success' => true,
            'data' => [
                'client_id' => $session?->client_id,
                'status' => $session?->status,
                'qr_code' => $session?->qr_code,
            ],
        ]);
    }

    public function reconnect(Request $request)
    {
        $validated = $request->validate(['client_id' => 'required|string|max:80']);
        $response = $this->bot->reconnectSession($validated['client_id']);
        $this->bot->syncSessions();

        return response()->json([
            'success' => $response['success'] ?? false,
            'message' => $response['message'] ?? 'Permintaan reconnect dikirim',
            'data' => $response['data'] ?? null,
        ], ($response['success'] ?? false) ? 200 : 422);
    }

    public function logout(Request $request)
    {
        $validated = $request->validate(['client_id' => 'required|string|max:80']);
        $response = $this->bot->deleteSession($validated['client_id']);
        $this->bot->syncSessions();

        return response()->json([
            'success' => $response['success'] ?? false,
            'message' => $response['message'] ?? 'Sesi WhatsApp dimatikan',
            'data' => $response['data'] ?? null,
        ], ($response['success'] ?? false) ? 200 : 422);
    }

    public function send(Request $request)
    {
        $validated = $request->validate([
            'phone_number' => 'required|string|max:40',
            'message' => 'required|string|max:4000',
        ]);

        $actor = app(ActorResolver::class)->active($request);
        $log = $this->notifications->queueManual($validated['phone_number'], $validated['message'], $actor?->id);

        return response()->json([
            'success' => $log->status !== 'failed',
            'message' => $log->status === 'failed' ? $log->error_message : 'Pesan WhatsApp masuk antrian',
            'data' => $log,
        ], $log->status === 'failed' ? 422 : 200);
    }

    public function messages(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => $this->messageQuery($request)
                ->paginate(min(max($request->integer('limit', 30), 1), 100)),
        ]);
    }

    public function retry(WhatsAppMessageLog $message)
    {
        return response()->json([
            'success' => true,
            'message' => 'Pesan WhatsApp masuk antrian ulang',
            'data' => $this->notifications->retryLog($message),
        ]);
    }

    public function templates()
    {
        return response()->json([
            'success' => true,
            'data' => WhatsAppTemplate::query()->orderBy('module')->orderBy('name')->get(),
        ]);
    }

    public function storeTemplate(Request $request)
    {
        $validated = $this->validateTemplate($request);
        $actor = app(ActorResolver::class)->active($request);

        $template = WhatsAppTemplate::query()->create($validated + ['created_by' => $actor?->id]);

        return response()->json(['success' => true, 'data' => $template], 201);
    }

    public function updateTemplate(Request $request, WhatsAppTemplate $template)
    {
        $template->update($this->validateTemplate($request, $template->id));

        return response()->json(['success' => true, 'data' => $template->refresh()]);
    }

    public function deleteTemplate(WhatsAppTemplate $template)
    {
        $template->delete();

        return response()->json(['success' => true, 'message' => 'Template WhatsApp dihapus']);
    }

    public function settings()
    {
        return response()->json([
            'success' => true,
            'data' => NotificationSetting::query()->with('template')->orderBy('module')->get(),
        ]);
    }

    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.module' => 'required|string|max:80',
            'settings.*.channel_app' => 'required|boolean',
            'settings.*.channel_whatsapp' => 'required|boolean',
            'settings.*.send_mode' => ['required', Rule::in(['manual', 'automatic'])],
            'settings.*.template_id' => 'nullable|integer|exists:whatsapp_templates,id',
            'settings.*.is_active' => 'required|boolean',
            'settings.*.retry_limit' => 'required|integer|min:1|max:10',
            'settings.*.delay_seconds' => 'nullable|integer|min:0|max:3600',
        ]);

        foreach ($validated['settings'] as $item) {
            NotificationSetting::query()->updateOrCreate(
                ['module' => $item['module']],
                [
                    'channel_app' => $item['channel_app'],
                    'channel_whatsapp' => $item['channel_whatsapp'],
                    'send_mode' => $item['send_mode'],
                    'template_id' => $item['template_id'] ?? null,
                    'is_active' => $item['is_active'],
                    'retry_limit' => $item['retry_limit'],
                    'delay_seconds' => $item['delay_seconds'] ?? 0,
                ]
            );
        }

        return $this->settings();
    }

    private function messageQuery(Request $request)
    {
        return WhatsAppMessageLog::query()
            ->with(['siswa:id,nama,nis,kelas', 'wali:id,name'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->input('status')))
            ->when($request->filled('module'), fn ($query) => $query->where('module', $request->input('module')))
            ->latest();
    }

    private function validateTemplate(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'name' => 'required|string|max:120',
            'code' => ['required', 'string', 'max:120', Rule::unique('whatsapp_templates', 'code')->ignore($ignoreId)],
            'module' => 'required|string|max:80',
            'event_type' => 'nullable|string|max:80',
            'message_template' => 'required|string|max:4000',
            'is_active' => 'required|boolean',
        ]);
    }

    private function touchClient(Request $request): void
    {
        WhatsAppConnectedClient::query()->updateOrCreate(
            ['client_id' => (string) $request->header('X-Client-Id', 'admin-web')],
            [
                'name' => (string) $request->header('X-Client-Name', 'Admin Web'),
                'client_type' => 'web',
                'domain' => $request->getHost(),
                'status' => 'aktif',
                'last_seen_at' => now(),
                'metadata' => [
                    'user_agent' => $request->userAgent(),
                    'ip' => $request->ip(),
                ],
            ]
        );
    }
}
