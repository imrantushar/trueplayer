<?php
/**
 * Media type resolution — is this source audio?
 *
 * The PHP twin of dev_trueplayer/utils/audio.js. Both answer the same question
 * and MUST agree: the browser decides whether to build an <audio> or a <video>
 * element, while this side decides what the server-rendered facade looks like
 * before any JavaScript runs. A disagreement paints a 16:9 black box that then
 * collapses into an audio bar on boot.
 *
 * See the JS file for the full rationale and the scope limits (in short: the
 * extension list is a safety net for direct-file sources only — never guess the
 * media type of an .m3u8 manifest).
 *
 * @package TruePlayer
 */

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves a source's media type.
 */
class Media {

	/**
	 * Extensions that mean "this is audio".
	 *
	 * Keep in step with AUDIO_EXTENSIONS in dev_trueplayer/utils/audio.js.
	 *
	 * `ogg` is audio here because that is overwhelmingly what it carries and it
	 * matches WordPress' own handling; Ogg *video* is `ogv`, absent on purpose.
	 */
	const AUDIO_EXTENSIONS = [ 'mp3', 'm4a', 'wav', 'ogg', 'oga', 'flac', 'opus', 'aac', 'weba' ];

	/**
	 * Whether a URL's path ends in a known audio extension.
	 *
	 * Query strings and fragments are stripped first — a signed URL carries its
	 * token after `?`, and testing the raw string would miss every private file.
	 *
	 * @param mixed $url Candidate URL or filename.
	 * @return bool
	 */
	public static function is_audio_extension( $url ): bool {
		if ( ! is_string( $url ) || '' === $url ) {
			return false;
		}
		$path = strtok( $url, '?#' );
		if ( false === $path ) {
			return false;
		}
		$ext = strtolower( (string) pathinfo( $path, PATHINFO_EXTENSION ) );
		return '' !== $ext && in_array( $ext, self::AUDIO_EXTENSIONS, true );
	}

	/**
	 * The predicate. Three states, in order:
	 *
	 *   1. mediaType 'audio' → yes. An explicit answer always wins.
	 *   2. mediaType 'video' → no. Also explicit, and honoured: the Source tab
	 *      writes the literal 'video' when the audio-only toggle is switched
	 *      off, so an author must be able to make that stick. Without this the
	 *      safety net would be inescapable.
	 *   3. absent → fall through to the extension net. This is exactly the
	 *      legacy population — imports, pasted URLs, anything created before
	 *      audio was a first-class type — which has no key at all.
	 *
	 * @param array $source A `config['source']` array.
	 * @return bool
	 */
	public static function is_audio( $source ): bool {
		if ( ! is_array( $source ) ) {
			return false;
		}

		$declared = $source['mediaType'] ?? '';
		if ( 'audio' === $declared ) {
			return true;
		}
		if ( 'video' === $declared ) {
			return false;
		}

		// `fileName` is the original upload name, which survives when the
		// playback URL does not describe the file — Gumlet records it, and
		// Bunny Storage records it since audio support landed.
		return self::is_audio_extension( $source['src'] ?? '' )
			|| self::is_audio_extension( $source['fileName'] ?? '' );
	}

	/**
	 * A source with `mediaType` resolved to a definite value.
	 *
	 * @param array $source Source array.
	 * @return array
	 */
	public static function normalize_source( $source ): array {
		if ( ! is_array( $source ) ) {
			return [];
		}
		$declared = $source['mediaType'] ?? '';
		if ( 'audio' === $declared || 'video' === $declared ) {
			return $source;
		}
		if ( self::is_audio( $source ) ) {
			$source['mediaType'] = 'audio';
		}
		return $source;
	}

	/**
	 * The same, for a whole config.
	 *
	 * READ-TIME only. This is never written back: the controllers store config
	 * verbatim by design, and normalizing on save would rewrite content the
	 * author never touched. The editor offers the change instead.
	 *
	 * @param array $config Video config.
	 * @return array
	 */
	public static function normalize_config( $config ): array {
		if ( ! is_array( $config ) || empty( $config['source'] ) || ! is_array( $config['source'] ) ) {
			return is_array( $config ) ? $config : [];
		}
		$config['source'] = self::normalize_source( $config['source'] );
		return $config;
	}
}
