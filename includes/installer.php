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
		Database::create_initial_custom_table();
		Helper::request_rewrite_flush();
	}

	public function save_option() {
		if ( ! $this->trueplayer_version ) {
			add_option( 'trueplayer_version', TRUEPLAYER_VERSION );
		}
		if ( ! get_option( 'trueplayer_first_install_time' ) ) {
			add_option( 'trueplayer_first_install_time', Helper::now_iso() );
		}
	}
}
