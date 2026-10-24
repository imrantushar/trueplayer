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
		$ok = Database::create_initial_custom_table();
		if ( $ok ) {
			update_option( 'trueplayer_db_version', TRUEPLAYER_DB_VERSION );
		}
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
