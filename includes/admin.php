<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin {

	public static function init() {
		$self = new self();
		$self->dispatch_hook();
	}

	public function dispatch_hook() {
		Admin\Menu::init();
	}
}
