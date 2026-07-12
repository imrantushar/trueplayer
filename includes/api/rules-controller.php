<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Server;
use TruePlayer\Services\Rules;

/**
 * GET /trueplayer/v1/rules/context → per-viewer facts for conditional layers.
 *
 * Public (nonce-checked at the REST layer via the shared cookie auth). Returns
 * only display-relevant facts; when pro is inactive the CRM facts stay empty so
 * conditions still evaluate on login/url state alone.
 */
class RulesController {

	public function register_routes() {
		register_rest_route(
			TRUEPLAYER_PLUGIN_SLUG . '/v1',
			'/rules/context',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'context' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	public function context() {
		if ( ! \TruePlayer\Pro::active() ) {
			return rest_ensure_response( [
				'loggedIn'     => is_user_logged_in(),
				'isCrmContact' => false,
				'crmTags'      => [],
				'crmLists'     => [],
			] );
		}
		$ctx = Rules::viewer_context();
		unset( $ctx['email'] ); // don't leak the address to the client.
		return rest_ensure_response( $ctx );
	}
}
