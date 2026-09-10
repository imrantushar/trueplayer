<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Helper {

	/**
	 * Read an addon's active status from the in-memory registry (kept in sync
	 * with the `trueplayer_addons` option by Addons::save_addon_status).
	 */
	public static function get_addon_active_status( $slug ) {
		$addons = isset( $GLOBALS['trueplayer_addons'] ) ? (array) $GLOBALS['trueplayer_addons'] : [];
		return ! empty( $addons[ $slug ] );
	}

	/**
	 * Read a single value from the plugin settings object.
	 */
	public static function get_specific_setting( $key, $default = null ) {
		$settings = isset( $GLOBALS['trueplayer_settings'] ) ? (array) $GLOBALS['trueplayer_settings'] : [];
		return array_key_exists( $key, $settings ) ? $settings[ $key ] : $default;
	}

	/**
	 * One-time rewrite flush, armed via request_rewrite_flush().
	 */
	public static function request_rewrite_flush() {
		update_option( 'trueplayer_flush_rewrite', 'yes' );
	}

	public static function maybe_flush_rewrite_rules() {
		if ( 'yes' === get_option( 'trueplayer_flush_rewrite' ) ) {
			flush_rewrite_rules( false );
			delete_option( 'trueplayer_flush_rewrite' );
		}
	}

	/**
	 * UTC ISO-8601 timestamp used in webhook payloads + log rows.
	 */
	public static function now_iso() {
		return gmdate( 'Y-m-d\TH:i:s\Z' );
	}

	/** The global TruePlayer settings option, decoded (empty array if unset). */
	public static function get_settings(): array {
		$raw = get_option( TRUEPLAYER_SETTINGS_NAME, '{}' );
		$val = is_string( $raw ) ? json_decode( $raw, true ) : ( is_array( $raw ) ? $raw : [] );
		return is_array( $val ) ? $val : [];
	}

	/** A named section of the global settings (e.g. 'enforcement', 'compliance'). */
	public static function get_settings_section( string $section ): array {
		$settings = self::get_settings();
		return isset( $settings[ $section ] ) && is_array( $settings[ $section ] ) ? $settings[ $section ] : [];
	}

	/**
	 * Merge the site-wide default branding (Settings → Branding: logo, position,
	 * opacity, link) as the lowest priority — a preset or the video's own
	 * branding overrides it per key.
	 */
	public static function apply_global_branding( array $config ): array {
		$global = self::get_settings_section( 'branding' );
		if ( ! empty( $global ) ) {
			$over               = isset( $config['branding'] ) && is_array( $config['branding'] ) ? $config['branding'] : [];
			$config['branding'] = array_merge( $global, $over );
		}
		return $config;
	}

	/**
	 * Store an array as JSON in post meta.
	 *
	 * The wp_slash() is not optional. update_post_meta() runs wp_unslash() on
	 * its value — WP meta functions expect slashed input — which eats the
	 * backslashes wp_json_encode() puts in front of every double quote inside a
	 * string. A layer holding `[contact-form-7 id="123"]` was written as
	 * `"shortcode":"[contact-form-7 id="123"]"`: invalid JSON, so the next
	 * json_decode() returned null and the WHOLE config read back as empty —
	 * source, layers and all silently lost on save. Any value with a quote or a
	 * backslash in it did the same. Slashing first means the unslash restores
	 * exactly what was encoded.
	 *
	 * @param int    $post_id Post to write to.
	 * @param string $key     Meta key.
	 * @param mixed  $data    Data to encode.
	 * @return bool|int
	 */
	public static function update_json_meta( $post_id, $key, $data ) {
		return update_post_meta( (int) $post_id, $key, wp_slash( wp_json_encode( $data ) ) );
	}

	/**
	 * Decode a video's `_trueplayer_config` JSON meta into an array.
	 */
	public static function get_video_config( $video_id ) {
		$raw    = get_post_meta( (int) $video_id, '_trueplayer_config', true );
		$config = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : ( is_array( $raw ) ? $raw : [] );
		if ( ! is_array( $config ) ) {
			$config = [];
		}
		/**
		 * Central seam: pro + Gem integrations mutate the resolved player
		 * config (inject layers, override gating, etc.) without touching core.
		 */
		return apply_filters( 'trueplayer/config', $config, (int) $video_id );
	}

	/** Decode a preset's `_trueplayer_preset` JSON meta into an array. */
	public static function get_preset_config( $preset_id ) {
		$raw = get_post_meta( (int) $preset_id, '_trueplayer_preset', true );
		$cfg = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : ( is_array( $raw ) ? $raw : [] );
		return is_array( $cfg ) ? $cfg : [];
	}

	/**
	 * A preset's media type: 'audio' or 'video'.
	 *
	 * Normalized rather than returned raw so an absent meta (every preset made
	 * before audio existed) and an unexpected value both read as 'video'.
	 */
	public static function get_preset_type( $preset_id ): string {
		$type = get_post_meta( (int) $preset_id, '_trueplayer_preset_type', true );
		return 'audio' === $type ? 'audio' : 'video';
	}

	/**
	 * If a video references a preset (config.presetId), merge the preset's
	 * customize + branding UNDER the video's own settings so per-video values
	 * win. Applied at frontend render only — the admin editor edits the raw
	 * config so authors always see their own overrides.
	 */
	public static function apply_preset( array $config ): array {
		$preset_id = isset( $config['presetId'] ) ? (int) $config['presetId'] : 0;
		$is_audio  = Media::is_audio( $config['source'] ?? [] );

		// Fall back to the site-wide default preset (Settings → General).
		//
		// Audio reads its own setting and does NOT fall back to the video one:
		// a video preset carries a skin, an aspect ratio and a control-bar style
		// that mean nothing for a bar, so inheriting it would silently restyle
		// every audio item on the site. No audio default means no default.
		if ( ! $preset_id ) {
			$general   = self::get_settings_section( 'general' );
			$key       = $is_audio ? 'defaultAudioPreset' : 'defaultPreset';
			$preset_id = isset( $general[ $key ] ) ? (int) $general[ $key ] : 0;
		}
		if ( ! $preset_id || get_post_type( $preset_id ) !== TRUEPLAYER_PRESET_POST_TYPE ) {
			return $config;
		}
		// An explicitly chosen preset is always honoured; only a mismatched
		// *default* is refused, since nobody picked it for this item.
		if ( ! isset( $config['presetId'] ) && ( self::get_preset_type( $preset_id ) === 'audio' ) !== $is_audio ) {
			return $config;
		}
		$preset = self::get_preset_config( $preset_id );
		if ( ! empty( $preset['customize'] ) && is_array( $preset['customize'] ) ) {
			$over               = isset( $config['customize'] ) && is_array( $config['customize'] ) ? $config['customize'] : [];
			$config['customize'] = self::deep_merge( $preset['customize'], $over );
		}
		if ( ! empty( $preset['branding'] ) && is_array( $preset['branding'] ) ) {
			$over               = isset( $config['branding'] ) && is_array( $config['branding'] ) ? $config['branding'] : [];
			$config['branding'] = array_merge( $preset['branding'], $over );
		}
		return $config;
	}

	/**
	 * Clamp pro-only config to free-safe values when pro isn't active. Runs at
	 * frontend render, after apply_preset, so a preset can't smuggle premium
	 * options past the gate either.
	 */
	public static function enforce_pro_limits( array $config ): array {
		if ( Pro::active() ) {
			return $config;
		}
		$skin = $config['customize']['appearance']['skin'] ?? '';
		if ( $skin && Pro::is_premium_skin( $skin ) ) {
			$config['customize']['appearance']['skin'] = 'default';
		}

		/**
		 * A premium source keeps its type and loses its location.
		 *
		 * The client has always refused to play these (see Player.jsx), but the
		 * config it refused on still carried the real media URL — a signed Bunny
		 * manifest included — inline in the page, where anyone could read it out
		 * of the source. Refusing in the browser is a courtesy; this is the gate.
		 *
		 * The type survives on purpose: the player needs it to say *why* it
		 * won't play. Dropping the source entirely would render as an ordinary
		 * "no video here" instead of an upgrade prompt.
		 */
		$source_type = $config['source']['type'] ?? '';
		if ( $source_type && Pro::is_premium_source( $source_type ) ) {
			$config['source'] = [ 'type' => $source_type, 'locked' => true ];
		}

		// Pro-only config never reaches the free frontend.
		unset( $config['protection'], $config['timedContent'] );
		$config['layers'] = self::free_layers( $config['layers'] ?? [] );
		if ( ! $config['layers'] ) {
			unset( $config['layers'] );
		}
		return $config;
	}

	/**
	 * The layers a free install may render.
	 *
	 * Email capture is free, and it lives in the layer stack — so the stack can
	 * no longer be dropped wholesale. Form layers survive; hotspots, banners and
	 * shortcode layers stay Pro as before.
	 *
	 * Display rules are Pro in their own right, so they are stripped from the
	 * layers that do survive. Stripping the rule rather than the layer is
	 * deliberate: a rule that cannot be evaluated must fail open, or a free
	 * install would silently stop showing a capture form it is entitled to.
	 *
	 * @param mixed $layers Raw `config.layers`.
	 * @return array Layers safe to render without Pro.
	 */
	private static function free_layers( $layers ): array {
		if ( ! is_array( $layers ) ) {
			return [];
		}
		$kept = [];
		foreach ( $layers as $layer ) {
			if ( ! is_array( $layer ) || 'form' !== ( $layer['type'] ?? '' ) ) {
				continue;
			}
			unset( $layer['conditions'] );
			$kept[] = $layer;
		}
		return array_values( $kept );
	}

	/** Extract an 11-char YouTube id from a watch/share/embed/shorts URL. */
	public static function youtube_id( string $url ): string {
		if ( preg_match( '/(?:v=|\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/', $url, $m ) ) {
			return $m[1];
		}
		return '';
	}

	/** Extract the numeric id from a Vimeo URL. */
	public static function vimeo_id( string $url ): string {
		if ( preg_match( '/vimeo\.com\/(?:video\/)?(\d+)/', $url, $m ) ) {
			return $m[1];
		}
		return '';
	}

	/**
	 * The ordered YouTube thumbnail candidates for an id, widest first.
	 *
	 * `maxresdefault` / `hq720` are true 16:9 at 1280x720; `hqdefault` is only
	 * 480x360 with letterbox bars baked in, so it is the last resort — it was
	 * the sole poster before, which is why derived posters looked upscaled and
	 * boxed inside a 16:9 stage. Not every video has the HD variants (YouTube
	 * 404s them), hence the chain: the client walks it on error.
	 */
	public static function youtube_poster_candidates( string $yid ): array {
		if ( '' === $yid ) {
			return [];
		}
		$base = 'https://i.ytimg.com/vi/' . $yid . '/';
		return [ $base . 'maxresdefault.jpg', $base . 'hq720.jpg', $base . 'sddefault.jpg', $base . 'hqdefault.jpg' ];
	}

	/**
	 * Re-request a Vimeo CDN thumbnail at a given width.
	 *
	 * oEmbed hands back a small render (…-d_960), and the size lives in a
	 * mandatory `-d_<width>` path suffix — strip it and the URL 404s, so this
	 * rewrites the suffix rather than removing it. Width alone (no `x<height>`)
	 * keeps the frame's own aspect ratio; the stage crops via CSS.
	 *
	 * @param string $url   Thumbnail URL from oEmbed.
	 * @param int    $width Desired width in pixels.
	 */
	private static function vimeo_thumb_width( string $url, int $width ): string {
		if ( ! preg_match( '#^https://[\w.-]*vimeocdn\.com/#', $url ) ) {
			return $url;
		}
		$parts = explode( '?', $url, 2 );
		$path  = preg_replace( '/-d_\d+(x\d+)?$/', '', $parts[0] ) . '-d_' . $width;
		return isset( $parts[1] ) ? $path . '?' . $parts[1] : $path;
	}

	/**
	 * Vimeo's own thumbnail for a video, at the largest size oEmbed offers.
	 *
	 * Unlike YouTube, Vimeo publishes no guessable thumbnail URL, so this costs
	 * a remote call — and that call sits on a page render, so it is fenced: the
	 * result is cached for a day, the miss is claimed before the request goes
	 * out (a slow Vimeo delays one render, not every concurrent one), and a
	 * failure is remembered briefly so a broken video does not re-fetch on
	 * every view. Saving a video warms this ahead of the first render.
	 */
	public static function vimeo_poster( string $vid ): string {
		if ( '' === $vid ) {
			return '';
		}
		$key    = 'tp_vimeo_poster_' . $vid;
		$cached = get_transient( $key );
		if ( is_string( $cached ) ) {
			return $cached;
		}
		// Claim the miss first — concurrent renders skip the call and paint
		// posterless instead of queueing behind the same request.
		set_transient( $key, '', 15 * MINUTE_IN_SECONDS );

		$poster = '';
		$res    = wp_safe_remote_get(
			'https://vimeo.com/api/oembed.json?url=' . rawurlencode( 'https://vimeo.com/' . $vid ),
			[ 'timeout' => 3 ]
		);
		if ( ! is_wp_error( $res ) && 200 === wp_remote_retrieve_response_code( $res ) ) {
			$body = json_decode( wp_remote_retrieve_body( $res ), true );
			if ( is_array( $body ) && ! empty( $body['thumbnail_url'] ) ) {
				$poster = self::vimeo_thumb_width( (string) $body['thumbnail_url'], 1280 );
			}
		}
		if ( '' !== $poster ) {
			set_transient( $key, $poster, DAY_IN_SECONDS );
		}
		return $poster;
	}

	/**
	 * The poster to paint for a source when the author set none: the provider's
	 * own thumbnail, at the best resolution it publishes.
	 *
	 * Returns [ url, fallbacks ] — `fallbacks` is the rest of the candidate
	 * chain for providers (YouTube) that 404 their HD sizes on some videos.
	 */
	public static function derive_poster( array $source ): array {
		$type = (string) ( $source['type'] ?? '' );
		$src  = (string) ( $source['src'] ?? '' );

		if ( 'youtube' === $type ) {
			$candidates = self::youtube_poster_candidates( self::youtube_id( $src ) );
			if ( $candidates ) {
				return [ array_shift( $candidates ), $candidates ];
			}
		} elseif ( 'vimeo' === $type ) {
			$poster = self::vimeo_poster( self::vimeo_id( $src ) );
			if ( '' !== $poster ) {
				return [ $poster, [] ];
			}
		}
		return [ '', [] ];
	}

	/**
	 * Fill `source.poster` from the provider when the author left it empty, so
	 * every frontend consumer (facade, player, playlist, SEO schema, ambient
	 * skin) paints the same image. Render-time only — the admin editor reads
	 * raw meta, so a derived poster is never written back as an author choice.
	 */
	public static function with_derived_poster( array $config ): array {
		$source = is_array( $config['source'] ?? null ) ? $config['source'] : [];
		if ( ! empty( $source['poster'] ) && is_string( $source['poster'] ) ) {
			return $config;
		}
		list( $poster, $fallbacks ) = self::derive_poster( $source );
		if ( '' === $poster ) {
			return $config;
		}
		$config['source']['poster']          = $poster;
		$config['source']['posterFallbacks'] = $fallbacks;
		$config['source']['posterDerived']   = true;
		return $config;
	}

	/**
	 * The product name shown in the admin and any attribution. White-label (pro)
	 * hooks `trueplayer/brand_name` to override it.
	 */
	public static function brand_name(): string {
		return (string) apply_filters( 'trueplayer/brand_name', 'TruePlayer' );
	}

	/**
	 * The site owner's own mark, when white-label is on (pro). Empty otherwise —
	 * the admin then falls back to TruePlayer's built-in play glyph.
	 */
	public static function brand_logo(): string {
		return (string) apply_filters( 'trueplayer/brand_logo', '' );
	}

	/**
	 * The site-wide watch-verification policy, with every key present.
	 *
	 * One source of truth for three consumers that used to keep their own copy:
	 * the settings screen, a video's gating config, and the per-video editor.
	 * The editor's copy was the damaging one — it wrote its hardcoded `false`
	 * for `requireLogin` into every video the moment anyone opened the Questions
	 * & gating tab, so the site-wide toggle silently stopped applying.
	 */
	public static function enforcement_defaults(): array {
		$saved = self::get_settings_section( 'enforcement' );
		return [
			'completionThreshold' => isset( $saved['completionThreshold'] ) ? (int) $saved['completionThreshold'] : 90,
			'antiSkip'            => array_key_exists( 'antiSkip', $saved ) ? (bool) $saved['antiSkip'] : true,
			'maxAttempts'         => isset( $saved['maxAttempts'] ) ? (int) $saved['maxAttempts'] : 3,
			'requireLogin'        => array_key_exists( 'requireLogin', $saved ) ? (bool) $saved['requireLogin'] : false,
			'strict'              => array_key_exists( 'strict', $saved ) ? (bool) $saved['strict'] : false,
			'trackGuests'         => array_key_exists( 'trackGuests', $saved ) ? (bool) $saved['trackGuests'] : true,
		];
	}

	/** Recursive array merge where $over wins; list (numeric) arrays are replaced. */
	private static function deep_merge( array $base, array $over ): array {
		foreach ( $over as $k => $v ) {
			if ( is_array( $v ) && isset( $base[ $k ] ) && is_array( $base[ $k ] ) && ! self::is_list( $v ) ) {
				$base[ $k ] = self::deep_merge( $base[ $k ], $v );
			} else {
				$base[ $k ] = $v;
			}
		}
		return $base;
	}

	private static function is_list( array $a ): bool {
		return array_keys( $a ) === range( 0, count( $a ) - 1 );
	}
}
