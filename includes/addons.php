<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Addons {

	public static function init() {
		$self = new self();
		$self->addons_loader();

		add_action( 'wp_ajax_trueplayer/addons/get_all_addons', [ $self, 'get_all_addons' ] );
		add_action( 'wp_ajax_trueplayer/addons/save_addon_status', [ $self, 'save_addon_status' ] );
	}

	private function addons_loader() {

		$Autoload = \TruePlayer\Autoload::get_instance();

		// Core-bundled addons ship in the free plugin. Pro-only addons
		// (reporting, exports, webhook-logs, mux, bunny, gemcrm-capture,
		// academy-sync, …) are contributed by trueplayer-pro through the
		// `trueplayer/addons/loader_filtered` filter below.
		$addons = apply_filters(
			'trueplayer/addons/loader_args',
			[
				// No core addons yet — watch verification, gating and basic
				// webhooks live directly in core (they are the product). Kept
				// as an empty registry so the filter surface exists for pro.
			]
		);

		$addons = apply_filters( 'trueplayer/addons/loader_filtered', $addons );

		foreach ( $addons as $addon_slug => $addon_config ) {

			if ( is_array( $addon_config ) ) {
				$addon_class     = $addon_config['class'] ?? '';
				$addon_root      = $addon_config['path'] ?? ( TRUEPLAYER_ROOT_DIR_PATH . 'addons/' . $addon_slug . '/' );
				$addon_namespace = $addon_config['namespace'] ?? ( 'TruePlayer' . str_replace( ' ', '', ucwords( str_replace( '-', ' ', $addon_slug ) ) ) );
			} else {
				$addon_class     = (string) $addon_config;
				$addon_root      = TRUEPLAYER_ROOT_DIR_PATH . 'addons/' . $addon_slug . '/';
				$addon_namespace = 'TruePlayer' . str_replace( ' ', '', ucwords( str_replace( '-', ' ', $addon_slug ) ) );
			}

			if ( empty( $addon_class ) ) {
				continue;
			}

			$Autoload->add_namespace_directory( $addon_namespace, $addon_root );

			$class = $addon_namespace . '\\' . $addon_class;

			if ( class_exists( $class ) ) {
				$class::init();
			}
		}
	}

	public function get_all_addons() {
		$security = isset( $_POST['security'] ) ? sanitize_text_field( wp_unslash( $_POST['security'] ) ) : '';
		if ( ! wp_verify_nonce( $security, 'trueplayer_nonce' ) ) {
			wp_send_json_error( [ 'message' => 'Invalid nonce' ] );
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Insufficient permissions.', 401 );
		}

		$addons = json_decode( get_option( TRUEPLAYER_ADDONS_SETTINGS, '{}' ) );
		wp_send_json_success( $addons );
	}

	public function save_addon_status() {
		$security = isset( $_POST['security'] ) ? sanitize_text_field( wp_unslash( $_POST['security'] ) ) : '';
		if ( ! wp_verify_nonce( $security, 'trueplayer_nonce' ) ) {
			wp_send_json_error( [ 'message' => 'Invalid nonce' ] );
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Insufficient permissions.', 401 );
		}

		$addon_slug = isset( $_POST['addon_slug'] ) ? sanitize_text_field( wp_unslash( $_POST['addon_slug'] ) ) : '';
		$status     = isset( $_POST['status'] ) ? filter_var( wp_unslash( $_POST['status'] ), FILTER_VALIDATE_BOOLEAN ) : false;

		if ( $status ) {
			$can_activate = apply_filters( "trueplayer/addons/can_activate_{$addon_slug}", true, $addon_slug );
			if ( is_wp_error( $can_activate ) ) {
				wp_send_json_error( [
					'message' => $can_activate->get_error_message(),
					'code'    => $can_activate->get_error_code(),
				] );
			}
			if ( true !== $can_activate ) {
				wp_send_json_error( [ 'message' => __( 'This addon cannot be activated right now.', 'trueplayer' ) ] );
			}
		}

		$saved                = (array) json_decode( get_option( TRUEPLAYER_ADDONS_SETTINGS, '{}' ), true );
		$saved[ $addon_slug ] = $status;
		update_option( TRUEPLAYER_ADDONS_SETTINGS, wp_json_encode( $saved ) );
		$GLOBALS['trueplayer_addons'] = (object) $saved;

		if ( $status ) {
			do_action( "trueplayer/addons/activated_{$addon_slug}", $status );
		} else {
			do_action( "trueplayer/addons/deactivated_{$addon_slug}", $status );
		}

		wp_send_json_success( $saved );
	}
}
