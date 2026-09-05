<?php

return [
    /*
    |--------------------------------------------------------------------------
    | VAPID Keys untuk Web Push Notifications (RFC 8292 Standard)
    |--------------------------------------------------------------------------
    | Kunci kriptografi ECDSA prime256v1 untuk mengautentikasi server pengirim
    | notifikasi ke browser Push Service (Google FCM, Mozilla, Apple APNs).
    */
    'vapid' => [
        'subject' => env('VAPID_SUBJECT', 'mailto:admin@qomaruddin.ponpes.id'),
        'public_key' => env('VAPID_PUBLIC_KEY', 'BK4v9zk66xHN4CakIHwj9UbqteDnV1dHRE5geJay_e44kksVneD_Mmp5U77kBDysqr5o6tMHlmvBHak5gqjw-ig'),
        'private_key' => env('VAPID_PRIVATE_KEY', 'QZJMd2gIhFrLlI_9nYQe6D0yD7SQ7gjuLnGLw6_1JMg'),
    ],

    /*
    | Default payload options
    */
    'default_icon' => env('PUSH_DEFAULT_ICON', '/logo-qomaruddin.png'),
    'default_badge' => env('PUSH_DEFAULT_BADGE', '/logo-qomaruddin.png'),
];
