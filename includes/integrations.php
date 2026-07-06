<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Integration registry — the single, documented seam other plugins use to
 * plug into TruePlayer.
 *
 * Register your own integration:
 *
 *   add_filter( 'trueplayer/integrations/register', function ( $list ) {
 *       $list[] = new My_TruePlayer_Mailchimp();  // implements IntegrationInterface
 *       return $list;
 *   } );
 *
 * Or, for a lighter touch, just listen for opt-in submissions:
 *
 *   add_filter( 'trueplayer/subscribe', function ( $result, $data ) {
 *       // $data = [ email, name, video_id, provider, lists, tags ]
 *       return [ 'ok' => true ];
 *   }, 10, 2 );
 *
 * And for automation, subscribe to the event bus: `trueplayer/event/{name}`.
 */
class Integrations {

	public static function init() {
		if ( ! \TruePlayer\Pro::active() ) {
			return; // integrations/opt-in are a pro feature
		}
		foreach ( self::available() as $integration ) {
			$integration->register();
		}
	}

	/**
	 * @return \TruePlayer\Interfaces\IntegrationInterface[]
	 */
	public static function all(): array {
		$built_in = [
			new Integrations\GemCrm(),
		];
		return apply_filters( 'trueplayer/integrations/register', $built_in );
	}

	/**
	 * @return \TruePlayer\Interfaces\IntegrationInterface[]
	 */
	public static function available(): array {
		return array_values( array_filter( self::all(), function ( $i ) {
			return $i->is_available();
		} ) );
	}

	public static function get( string $id ) {
		foreach ( self::all() as $integration ) {
			if ( $integration->id() === $id ) {
				return $integration;
			}
		}
		return null;
	}

	/**
	 * Generic subscribe pipeline used by the opt-in layer. Routes to the named
	 * provider when available, otherwise lets any listener handle it via the
	 * `trueplayer/subscribe` filter. Always returns a { ok, message } array.
	 */
	public static function subscribe( array $data ): array {
		$provider    = $data['provider'] ?? '';
		$integration = $provider ? self::get( $provider ) : null;

		$result = [ 'ok' => false, 'message' => __( 'No subscription provider is configured.', 'trueplayer' ) ];

		if ( $integration && $integration->is_available() ) {
			$result = $integration->subscribe( $data );
		}

		/**
		 * Let any plugin observe or override the outcome (e.g. also push to a
		 * second list, or handle the opt-in when no provider matched).
		 */
		$result = apply_filters( 'trueplayer/subscribe', $result, $data );

		// Fire an event so webhooks + automation see opt-ins too.
		if ( ! empty( $result['ok'] ) ) {
			Events::emit( 'subscriber.added', [
				'video_id' => (int) ( $data['video_id'] ?? 0 ),
				'provider' => $provider,
				'subject'  => [ 'email' => $data['email'] ?? '', 'name' => $data['name'] ?? '' ],
			] );
		}

		return $result;
	}
}
