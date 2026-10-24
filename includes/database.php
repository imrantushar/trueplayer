<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The free plugin ships no custom tables of its own; it registers the player's
 * post types and meta here. Analytics/progress/engagement/quiz-attempts schema
 * is owned by TruePlayer Pro and created by its own installer.
 */
class Database {

	public static function init() {
		$self = new self();
		$self->dispatch_hook();
	}

	public function dispatch_hook() {
		Database\PostType::init();
		Database\MetaManager::init();
	}
}
