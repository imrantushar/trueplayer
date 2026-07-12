<?php

namespace TruePlayer\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Conditional-rules engine (pro) — decides whether a layer (or gate) applies to
 * the current viewer. Mirrors the JS evaluator in
 * dev_trueplayer/player/rules.js: any change to operators/fields here must be
 * reflected there so client and server agree.
 *
 * A rule group is:
 *   [ 'match' => 'all'|'any', 'rules' => [ [ 'field'=>, 'operator'=>, 'value'=> ], … ] ]
 *
 * Server-known fields (logged_in, crm_contact, crm_tag, crm_list, url_param) are
 * evaluated here. Client-only fields (layer_seen, layer_completed,
 * email_submitted) can't be known server-side, so the server treats them as
 * satisfied (the client re-evaluates and hides if needed).
 */
class Rules {

	const CLIENT_ONLY = [ 'layer_seen', 'layer_completed', 'email_submitted' ];

	/**
	 * Per-viewer facts the rules evaluate against. CRM facts are contributed by
	 * integrations through the `trueplayer/viewer_context` filter so the engine
	 * stays decoupled from any specific CRM.
	 */
	public static function viewer_context(): array {
		$user = wp_get_current_user();
		$ctx  = [
			'loggedIn'     => is_user_logged_in(),
			'isCrmContact' => false,
			'crmTags'      => [],
			'crmLists'     => [],
			'email'        => is_user_logged_in() ? $user->user_email : '',
		];
		return apply_filters( 'trueplayer/viewer_context', $ctx, $user );
	}

	/** Evaluate a rule group against a context. Empty group = always true. */
	public static function evaluate( $group, array $context ): bool {
		if ( empty( $group['rules'] ) || ! is_array( $group['rules'] ) ) {
			return true;
		}
		$match   = ( $group['match'] ?? 'all' ) === 'any' ? 'any' : 'all';
		$results = [];
		foreach ( $group['rules'] as $rule ) {
			$results[] = self::eval_rule( $rule, $context );
		}
		return 'any' === $match ? in_array( true, $results, true ) : ! in_array( false, $results, true );
	}

	private static function eval_rule( $rule, array $context ): bool {
		$field    = $rule['field'] ?? '';
		$operator = $rule['operator'] ?? 'is';
		$value    = $rule['value'] ?? '';

		// Client-only facts: not knowable server-side → don't block here.
		if ( in_array( $field, self::CLIENT_ONLY, true ) ) {
			return true;
		}

		$viewer = $context['viewer'] ?? [];

		switch ( $field ) {
			case 'logged_in':
				return self::cmp_bool( ! empty( $viewer['loggedIn'] ), $value, $operator );
			case 'crm_contact':
				return self::cmp_bool( ! empty( $viewer['isCrmContact'] ), $value, $operator );
			case 'crm_tag':
				return self::cmp_in( $viewer['crmTags'] ?? [], $value, $operator );
			case 'crm_list':
				return self::cmp_in( $viewer['crmLists'] ?? [], $value, $operator );
			case 'url_param':
				$params = $context['url'] ?? [];
				$key    = $rule['key'] ?? '';
				$actual = $params[ $key ] ?? null;
				return self::cmp_str( (string) $actual, (string) $value, $operator );
			default:
				return true;
		}
	}

	private static function cmp_bool( bool $actual, $value, string $operator ): bool {
		$want = in_array( $value, [ 'yes', '1', 1, true, 'true' ], true );
		$eq   = ( $actual === $want );
		return 'is_not' === $operator ? ! $eq : $eq;
	}

	private static function cmp_in( array $haystack, $value, string $operator ): bool {
		$haystack = array_map( 'strval', $haystack );
		$in       = in_array( (string) $value, $haystack, true );
		return 'is_not' === $operator ? ! $in : $in;
	}

	private static function cmp_str( string $actual, string $value, string $operator ): bool {
		switch ( $operator ) {
			case 'is_not':
				return $actual !== $value;
			case 'contains':
				return '' !== $value && false !== strpos( $actual, $value );
			case 'is':
			default:
				return $actual === $value;
		}
	}
}
