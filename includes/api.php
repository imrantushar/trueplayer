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
		( new API\ViewersController() )->register_routes();
		( new API\WebhooksController() )->register_routes();
		// Public runtime endpoints (nonce-protected).
		( new API\GateController() )->register_routes();
		( new API\ProgressController() )->register_routes();
		( new API\GradeController() )->register_routes();
		( new API\OptinController() )->register_routes();
		( new API\IntegrationsController() )->register_routes();
		( new API\AnalyticsController() )->register_routes();
		( new API\StreamController() )->register_routes();
		( new API\BunnyController() )->register_routes();
		( new API\GumletController() )->register_routes();
		( new API\LmsController() )->register_routes();
		( new API\QuizpressController() )->register_routes();
		( new API\ImportController() )->register_routes();
		( new API\RulesController() )->register_routes();
		( new API\SubtitlesController() )->register_routes();
		do_action( 'trueplayer/api/register_routes' );
	}
}
