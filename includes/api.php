<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Api {

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		( new API\SettingsController() )->register_routes();
		( new API\VideosController() )->register_routes();
		( new API\PresetsController() )->register_routes();
		( new API\PlaylistsController() )->register_routes();
		( new API\OptinController() )->register_routes();
		( new API\ImportController() )->register_routes();
		do_action( 'trueplayer/api/register_routes' );
	}
}
