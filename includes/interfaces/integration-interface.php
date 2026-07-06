<?php

namespace TruePlayer\Interfaces;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Contract every TruePlayer integration implements. Third-party plugins add
 * their own by returning an instance from the
 * `trueplayer/integrations/register` filter.
 *
 * The base class \TruePlayer\Integrations\BaseIntegration provides sane
 * defaults so an integration only overrides what it needs.
 */
interface IntegrationInterface {

	/** Machine id, e.g. 'gemcrm'. */
	public function id(): string;

	/** Human label shown in the admin. */
	public function name(): string;

	/** True when the dependency (e.g. GemCRM) is installed + active. */
	public function is_available(): bool;

	/** Attach hooks. Called only when is_available() is true. */
	public function register(): void;

	/**
	 * Audiences this integration can target (lists / tags / groups).
	 *
	 * @return array<int,array{id:string,title:string}>
	 */
	public function lists(): array;

	/**
	 * Handle a subscribe/opt-in submission.
	 *
	 * @param array $data { email, name, video_id, lists[], tags[] }
	 * @return array { ok: bool, message?: string }
	 */
	public function subscribe( array $data ): array;
}
