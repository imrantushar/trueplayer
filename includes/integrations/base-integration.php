<?php

namespace TruePlayer\Integrations;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Interfaces\IntegrationInterface;

/**
 * Convenience base so an integration only implements what it needs. A minimal
 * integration overrides id(), name(), is_available() and (for opt-in)
 * lists() + subscribe().
 */
abstract class BaseIntegration implements IntegrationInterface {

	public function is_available(): bool {
		return true;
	}

	public function register(): void {
		// no-op by default
	}

	public function lists(): array {
		return [];
	}

	public function subscribe( array $data ): array {
		return [ 'ok' => false, 'message' => 'Not supported.' ];
	}

	/** Summary shown in the admin integrations list. */
	public function to_array(): array {
		return [
			'id'        => $this->id(),
			'name'      => $this->name(),
			'available' => $this->is_available(),
			'lists'     => $this->is_available() ? $this->lists() : [],
			'supportsSubscribe' => true,
		];
	}
}
