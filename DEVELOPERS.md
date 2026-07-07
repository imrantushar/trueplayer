# TruePlayer — developer / integration API

TruePlayer ships a stable set of extension points so **any plugin** (LMS,
membership, CRM, e-commerce, custom) can connect without modifying TruePlayer.
Nothing below depends on a specific plugin — these are the seams; the actual
integrations live in the integrating plugin.

## Lifecycle events (server-side)

Every server-side milestone fires two actions:

```php
do_action( 'trueplayer/event', $name, $payload );   // catch-all
do_action( "trueplayer/event/{$name}", $payload );  // per-event
```

Event names: `view.started`, `progress.milestone`, `view.completed`,
`checkpoint.passed`, `checkpoint.failed`, `quiz.passed`, `quiz.failed`,
`video.locked`, `video.unlocked`, `subscriber.added`.

`$payload` shape:

```php
[
  'event'       => 'view.completed',
  'video_id'    => 123,
  'video_title' => 'Lesson 1',
  'subject'     => [ 'type' => 'user'|'guest', 'id' => '42', 'email' => '…'|null ],
  'timestamp'   => '2026-07-06T12:00:00Z',
  'site'        => 'example.com',
  // + event extras: coverage_percent, milestone, score, passed, attempt_no, gate_id…
]
```

Example — mark something complete when a viewer finishes a video:

```php
add_action( 'trueplayer/event/view.completed', function ( $p ) {
    if ( ( $p['subject']['type'] ?? '' ) === 'user' ) {
        // $p['video_id'], (int) $p['subject']['id'] …
    }
} );
```

## Access gate (control who can play)

Deny or allow playback before the player loads:

```php
add_filter( 'trueplayer/gate/access', function ( $access, $video_id, $subject ) {
    // $subject is a \TruePlayer\Subject ($subject->type, $subject->id)
    if ( /* not allowed */ ) {
        return [
            'allowed' => false,
            'reason'  => 'enroll_required', // or purchase_required, login_required, custom
            'message' => 'Enroll to watch this.',
            'cta'     => [ 'label' => 'View course', 'url' => 'https://…' ],
        ];
    }
    return $access; // default: [ 'allowed' => true ]
}, 10, 3 );
```

The player renders the message/CTA when `allowed` is false.

## Per-video config

Read/mutate a video's resolved config (source, gating, branding, etc.):

```php
add_filter( 'trueplayer/config', function ( $config, $video_id ) {
    // $config['source'], $config['gating'], $config['lms'] (free-form) …
    return $config;
}, 10, 2 );
```

`config.lms` is a reserved, free-form slot for LMS mappings (e.g.
`{ provider, course, lesson }`) that integrations can write from their own UI
and read here — TruePlayer just stores and passes it through.

## Subscribe / CRM providers

Handle in-player opt-ins, or register a full provider:

```php
// Lightweight: handle any opt-in.
add_filter( 'trueplayer/subscribe', function ( $result, $data ) {
    // $data = [ email, name, video_id, provider, lists, tags ]
    return [ 'ok' => true ];
}, 10, 2 );

// Full provider (implements \TruePlayer\Interfaces\IntegrationInterface).
add_filter( 'trueplayer/integrations/register', function ( $list ) {
    $list[] = new My_TruePlayer_Provider();
    return $list;
} );
```

## Addons (pro-style modules)

Register a self-contained module loaded through TruePlayer's autoloader:

```php
add_filter( 'trueplayer/addons/loader_filtered', function ( $addons ) {
    $addons['my-addon'] = [ 'class' => 'MyAddon', 'namespace' => 'MyVendorNs', 'path' => __DIR__ . '/my-addon/' ];
    return $addons;
} );
```

## Injecting data / feature flags into the UI

```php
add_filter( 'trueplayer/assets/backend_scripts_data',  fn( $d ) => $d );  // admin
add_filter( 'trueplayer/assets/frontend_scripts_data', fn( $d ) => $d );  // player
```

Add `$d['feature_flags']['my_flag'] = true;` to branch in React / the player.

## Licensing

Pro features gate on `\TruePlayer\Pro::active()`. Force the license verdict:

```php
add_filter( 'trueplayer/license_valid', '__return_true' );
```

---

These hooks are the contract. TruePlayer ships **connect-ready** — integrations
are built in the integrating plugin, never here.
