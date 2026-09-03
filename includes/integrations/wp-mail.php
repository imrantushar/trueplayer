<?php

namespace TruePlayer\Integrations;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The provider that always works: email the captured contact to the site.
 *
 * Every other integration depends on something being installed and configured,
 * which left email capture with nowhere to send a contact on a site that has no
 * CRM — the form would render, the viewer would submit, and the request would
 * come back "No subscription provider is configured." This one has no
 * dependency, so it is always available and is what makes email capture usable
 * out of the box.
 *
 * There is no list concept: WordPress is not an audience manager. Contacts are
 * not stored either — `Integrations::subscribe()` emits `subscriber.added` on
 * success, so webhooks and automation receive them the same way they do for any
 * other provider.
 */
class WpMail extends BaseIntegration {

	public function id(): string {
		return 'wp_mail';
	}

	public function name(): string {
		return __( 'Email notification', 'trueplayer' );
	}

	/**
	 * Always. That is the point of this provider — see the class comment.
	 */
	public function is_available(): bool {
		return true;
	}

	/**
	 * Where notifications go. Settings → Integrations, falling back to the
	 * site's own admin address so it works before anyone configures anything.
	 */
	private function recipient(): string {
		$settings = json_decode( (string) get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ), true );
		$to       = $settings['integrations']['wp_mail']['to'] ?? '';
		$to       = is_string( $to ) ? trim( $to ) : '';
		if ( '' === $to ) {
			$to = (string) get_option( 'admin_email' );
		}
		return (string) apply_filters( 'trueplayer/wp_mail/recipient', $to );
	}

	public function subscribe( array $data ): array {
		$to = $this->recipient();
		if ( ! is_email( $to ) ) {
			return [
				'ok'      => false,
				'message' => __( 'No notification address is set for email capture.', 'trueplayer' ),
			];
		}

		$video_id = (int) ( $data['video_id'] ?? 0 );
		$title    = $video_id ? get_the_title( $video_id ) : '';
		$email    = (string) ( $data['email'] ?? '' );
		$name     = (string) ( $data['name'] ?? '' );

		$subject = sprintf(
			/* translators: %s: video title. */
			__( 'New subscriber from %s', 'trueplayer' ),
			$title !== '' ? $title : __( 'your video', 'trueplayer' )
		);

		$lines = [
			sprintf( /* translators: %s: email address. */ __( 'Email: %s', 'trueplayer' ), $email ),
		];
		if ( '' !== $name ) {
			$lines[] = sprintf( /* translators: %s: subscriber name. */ __( 'Name: %s', 'trueplayer' ), $name );
		}
		if ( $video_id ) {
			$lines[] = sprintf( /* translators: 1: video title, 2: video id. */ __( 'Video: %1$s (#%2$d)', 'trueplayer' ), $title, $video_id );
		}
		$lines[] = sprintf( /* translators: %s: site name. */ __( 'Site: %s', 'trueplayer' ), get_bloginfo( 'name' ) );

		$sent = wp_mail( $to, $subject, implode( "\n", $lines ) );

		// A viewer must never be told their address was rejected because the
		// site's own mail transport is down — the capture itself succeeded, and
		// `subscriber.added` still carries it to any webhook that is listening.
		if ( ! $sent ) {
			error_log( 'TruePlayer: email-capture notification could not be sent to ' . $to );
		}

		return [ 'ok' => true ];
	}
}
