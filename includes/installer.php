<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Installer {

	public $trueplayer_version;

	public static function init() {
		$self                     = new self();
		$self->trueplayer_version = get_option( 'trueplayer_version' );
		$self->save_option();
		Helper::request_rewrite_flush();
	}

	public function save_option() {
		if ( ! $this->trueplayer_version ) {
			add_option( 'trueplayer_version', TRUEPLAYER_VERSION );
		}
	}
}
