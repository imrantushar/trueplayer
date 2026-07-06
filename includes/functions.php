<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Global helper accessor for the plugin instance.
 *
 * @return \TruePlayer
 */
if ( ! function_exists( 'trueplayer' ) ) {
	function trueplayer() {
		return TruePlayer::init();
	}
}
