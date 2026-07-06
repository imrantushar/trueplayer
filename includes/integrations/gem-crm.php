<?php

namespace TruePlayer\Integrations;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * GemCRM integration — turns an in-player opt-in into a GemCRM contact and
 * (optionally) attaches it to one or more lists.
 *
 * Uses GemCRM's own model layer: \GemCrm\Database\Models\Contact::create()
 * upserts by email and, when the email already exists, GemCRM still attaches
 * the given lists to the existing contact before signalling the duplicate —
 * so a re-subscribe still lands on the target list.
 */
class GemCrm extends BaseIntegration {

	const CONTACT = '\\GemCrm\\Database\\Models\\Contact';
	const LISTS   = '\\GemCrm\\Database\\Models\\ListModel';

	public function id(): string {
		return 'gemcrm';
	}

	public function name(): string {
		return 'GemCRM';
	}

	public function is_available(): bool {
		return defined( 'GEMCRM_VERSION' ) && class_exists( self::CONTACT );
	}

	/**
	 * Audiences = GemCRM lists.
	 */
	public function lists(): array {
		if ( ! $this->is_available() || ! class_exists( self::LISTS ) ) {
			return [];
		}
		try {
			$result = call_user_func( [ self::LISTS, 'index' ], [ 'per_page' => 100 ], null, true );
			$rows   = isset( $result['records'] ) ? $result['records'] : $result;
			$out    = [];
			foreach ( (array) $rows as $row ) {
				$row = (array) $row;
				if ( ! empty( $row['id'] ) ) {
					$out[] = [
						'id'    => (string) $row['id'],
						'title' => $row['title'] ?? ( $row['name'] ?? ( 'List ' . $row['id'] ) ),
					];
				}
			}
			return $out;
		} catch ( \Throwable $e ) {
			return [];
		}
	}

	public function subscribe( array $data ): array {
		if ( ! $this->is_available() ) {
			return [ 'ok' => false, 'message' => __( 'GemCRM is not active.', 'trueplayer' ) ];
		}

		$email = sanitize_email( $data['email'] ?? '' );
		if ( ! is_email( $email ) ) {
			return [ 'ok' => false, 'message' => __( 'Invalid email.', 'trueplayer' ) ];
		}

		$name  = trim( (string) ( $data['name'] ?? '' ) );
		$parts = $name !== '' ? explode( ' ', $name, 2 ) : [ '', '' ];

		$payload = [
			'email'      => $email,
			'first_name' => $parts[0] ?? '',
			'last_name'  => $parts[1] ?? '',
			'status'     => 'subscribed',
			'type'       => 'lead',
			'list_ids'   => array_values( array_filter( array_map( 'intval', (array) ( $data['lists'] ?? [] ) ) ) ),
			'tag_ids'    => array_values( array_filter( array_map( 'intval', (array) ( $data['tags'] ?? [] ) ) ) ),
		];

		try {
			call_user_func( [ self::CONTACT, 'create' ], $payload );
			return [ 'ok' => true ];
		} catch ( \Throwable $e ) {
			// GemCRM throws "Email already exists" AFTER attaching the lists to
			// the existing contact — so a repeat opt-in is still a success.
			if ( false !== stripos( $e->getMessage(), 'already exist' ) ) {
				return [ 'ok' => true, 'message' => __( 'Already subscribed.', 'trueplayer' ) ];
			}
			return [ 'ok' => false, 'message' => $e->getMessage() ];
		}
	}
}
