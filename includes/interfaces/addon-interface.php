<?php

namespace TruePlayer\Interfaces;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

interface AddonInterface {

	public static function init();
	public function define_constants();
	public function init_addon();
	public function addon_activation_hook();
}
