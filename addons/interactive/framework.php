<?php

namespace TruePlayerInteractive;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * TruePlayer's implementation of H5PFrameworkInterface — the bridge between
 * H5PCore and WordPress (libraries, content, dependencies, options, messages,
 * i18n, file paths).
 *
 * Adapted from the official H5P WordPress plugin's framework (GPL-3.0), with:
 *   - our own `tp_h5p_` tables (never collides with a separate H5P plugin),
 *   - our own `trueplayer_h5p_` option prefix,
 *   - WordPress-standard capabilities (edit_posts / manage_options) instead of
 *     H5P's custom caps,
 *   - the H5P-plugin-specific coupling removed (its H5P_Event log class, the
 *     H5P_Plugin singleton, and the content hub — none of which we use).
 *
 * H5PCore only ever reaches the database through this class, so the table
 * naming is entirely ours.
 */
class Framework implements \H5PFrameworkInterface {

	/** Fully-qualified table prefix, e.g. `wp_tp_h5p_`. */
	private $tbl;

	private $messages = [ 'error' => [], 'info' => [] ];

	public function __construct() {
		global $wpdb;
		$this->tbl = $wpdb->prefix . 'tp_h5p_';
	}

	/* -- Messages ------------------------------------------------------------ */

	public function setErrorMessage( $message, $code = null ) {
		if ( current_user_can( 'edit_posts' ) ) {
			$this->messages['error'][] = (object) [ 'code' => $code, 'message' => $message ];
		}
	}

	public function setInfoMessage( $message ) {
		if ( current_user_can( 'edit_posts' ) ) {
			$this->messages['info'][] = $message;
		}
	}

	public function getMessages( $type ) {
		if ( empty( $this->messages[ $type ] ) ) {
			return null;
		}
		$messages                 = $this->messages[ $type ];
		$this->messages[ $type ] = [];
		return $messages;
	}

	public function t( $message, $replacements = [] ) {
		foreach ( $replacements as $key => $replacement ) {
			if ( $key[0] === '@' ) {
				$replacements[ $key ] = esc_html( $replacement );
			} elseif ( $key[0] === '%' ) {
				$replacements[ $key ] = '<em>' . esc_html( $replacement ) . '</em>';
			}
		}
		$message = preg_replace( '/(!|@|%)[a-z0-9-]+/i', '%s', $message );
		return vsprintf( $message, $replacements );
	}

	/* -- Paths / platform ---------------------------------------------------- */

	private function getH5pPath() {
		return Core::paths()['path'];
	}

	public function getLibraryFileUrl( $libraryFolderName, $fileName ) {
		return Core::paths()['url'] . '/libraries/' . $libraryFolderName . '/' . $fileName;
	}

	public function getUploadedH5pFolderPath() {
		static $dir;
		if ( is_null( $dir ) ) {
			$dir = Core::core()->fs->getTmpPath();
		}
		return $dir;
	}

	public function getUploadedH5pPath() {
		static $path;
		if ( is_null( $path ) ) {
			$path = Core::core()->fs->getTmpPath() . '.h5p';
		}
		return $path;
	}

	public function getPlatformInfo() {
		global $wp_version;
		return [
			'name'       => 'TruePlayer',
			'version'    => $wp_version,
			'h5pVersion' => defined( 'TRUEPLAYER_VERSION' ) ? TRUEPLAYER_VERSION : '1.0',
		];
	}

	public function fetchExternalData( $url, $data = null, $blocking = true, $stream = null, $fullData = false, $headers = [], $files = [], $method = 'POST' ) {
		@set_time_limit( 0);
		$options = [
			'timeout'  => ! empty( $blocking ) ? 30 : 0.01,
			'stream'   => ! empty( $stream ),
			'filename' => ! empty( $stream ) ? $stream : false,
		];

		if ( $data !== null ) {
			$options['body'] = $data;
			$response        = wp_remote_post( $url, $options );
		} elseif ( empty( $options['filename'] ) ) {
			$response = wp_remote_get( $url );
		} else {
			$response = wp_safe_remote_get( $url, $options );
		}

		if ( is_wp_error( $response ) ) {
			$this->setErrorMessage( $response->get_error_message(), 'failed-fetching-external-data' );
			return false;
		} elseif ( $response['response']['code'] >= 200 && $response['response']['code'] < 300 ) {
			return empty( $response['body'] ) ? true : $response['body'];
		}
		return null;
	}

	/* -- Libraries ----------------------------------------------------------- */

	public function setLibraryTutorialUrl( $machineName, $tutorialUrl ) {
		global $wpdb;
		$wpdb->update( "{$this->tbl}libraries", [ 'tutorial_url' => $tutorialUrl ], [ 'name' => $machineName ], [ '%s' ], [ '%s' ] );
	}

	public function getLibraryId( $name, $majorVersion = null, $minorVersion = null ) {
		global $wpdb;
		$sql_where = 'WHERE name = %s';
		$sql_args  = [ $name ];
		if ( $majorVersion !== null ) {
			$sql_where .= ' AND major_version = %d';
			$sql_args[] = $majorVersion;
			if ( $minorVersion !== null ) {
				$sql_where .= ' AND minor_version = %d';
				$sql_args[] = $minorVersion;
			}
		}
		$id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$this->tbl}libraries {$sql_where}
				ORDER BY major_version DESC, minor_version DESC, patch_version DESC LIMIT 1",
				$sql_args
			)
		);
		return $id === null ? false : $id;
	}

	public function isPatchedLibrary( $library ) {
		global $wpdb;
		$operator = $this->isInDevMode() ? '<=' : '<';
		return $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$this->tbl}libraries
				WHERE name = %s AND major_version = %d AND minor_version = %d AND patch_version {$operator} %d",
				$library['machineName'],
				$library['majorVersion'],
				$library['minorVersion'],
				$library['patchVersion']
			)
		) !== null;
	}

	public function isInDevMode() {
		return false;
	}

	public function mayUpdateLibraries() {
		return current_user_can( 'manage_options' );
	}

	public function getLibraryUsage( $id, $skipContent = false ) {
		global $wpdb;
		return [
			'content'   => $skipContent ? -1 : intval(
				$wpdb->get_var(
					$wpdb->prepare(
						"SELECT COUNT(distinct c.id)
						FROM {$this->tbl}libraries l
						JOIN {$this->tbl}contents_libraries cl ON l.id = cl.library_id
						JOIN {$this->tbl}contents c ON cl.content_id = c.id
						WHERE l.id = %d",
						$id
					)
				)
			),
			'libraries' => intval(
				$wpdb->get_var(
					$wpdb->prepare(
						"SELECT COUNT(*) FROM {$this->tbl}libraries_libraries WHERE required_library_id = %d",
						$id
					)
				)
			),
		];
	}

	public function saveLibraryData( &$library, $new = true ) {
		global $wpdb;

		$preloadedJs    = $this->pathsToCsv( $library, 'preloadedJs' );
		$preloadedCss   = $this->pathsToCsv( $library, 'preloadedCss' );
		$dropLibraryCss = '';
		if ( isset( $library['dropLibraryCss'] ) ) {
			$libs = [];
			foreach ( $library['dropLibraryCss'] as $lib ) {
				$libs[] = $lib['machineName'];
			}
			$dropLibraryCss = implode( ', ', $libs );
		}
		$embedTypes = isset( $library['embedTypes'] ) ? implode( ', ', $library['embedTypes'] ) : '';
		if ( ! isset( $library['semantics'] ) ) {
			$library['semantics'] = '';
		}
		if ( ! isset( $library['fullscreen'] ) ) {
			$library['fullscreen'] = 0;
		}
		if ( ! isset( $library['hasIcon'] ) ) {
			$library['hasIcon'] = 0;
		}
		$metadataSettings = isset( $library['metadataSettings'] ) ? $library['metadataSettings'] : null;

		if ( $new ) {
			$wpdb->insert(
				"{$this->tbl}libraries",
				[
					'created_at'        => current_time( 'mysql', 1 ),
					'updated_at'        => current_time( 'mysql', 1 ),
					'name'              => $library['machineName'],
					'title'             => $library['title'],
					'major_version'     => $library['majorVersion'],
					'minor_version'     => $library['minorVersion'],
					'patch_version'     => $library['patchVersion'],
					'runnable'          => $library['runnable'],
					'fullscreen'        => $library['fullscreen'],
					'embed_types'       => $embedTypes,
					'preloaded_js'      => $preloadedJs,
					'preloaded_css'     => $preloadedCss,
					'drop_library_css'  => $dropLibraryCss,
					'tutorial_url'      => '',
					'semantics'         => $library['semantics'],
					'has_icon'          => $library['hasIcon'] ? 1 : 0,
					'metadata_settings' => $metadataSettings,
					'add_to'            => isset( $library['addTo'] ) ? wp_json_encode( $library['addTo'] ) : null,
				],
				[ '%s', '%s', '%s', '%s', '%d', '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s' ]
			);
			$library['libraryId'] = $wpdb->insert_id;
		} else {
			$wpdb->update(
				"{$this->tbl}libraries",
				[
					'updated_at'        => current_time( 'mysql', 1 ),
					'title'             => $library['title'],
					'patch_version'     => $library['patchVersion'],
					'runnable'          => $library['runnable'],
					'fullscreen'        => $library['fullscreen'],
					'embed_types'       => $embedTypes,
					'preloaded_js'      => $preloadedJs,
					'preloaded_css'     => $preloadedCss,
					'drop_library_css'  => $dropLibraryCss,
					'semantics'         => $library['semantics'],
					'has_icon'          => $library['hasIcon'] ? 1 : 0,
					'metadata_settings' => $metadataSettings,
					'add_to'            => isset( $library['addTo'] ) ? wp_json_encode( $library['addTo'] ) : null,
				],
				[ 'id' => $library['libraryId'] ],
				[ '%s', '%s', '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s' ],
				[ '%d' ]
			);
			$this->deleteLibraryDependencies( $library['libraryId'] );
		}

		// Update languages
		$wpdb->delete( "{$this->tbl}libraries_languages", [ 'library_id' => $library['libraryId'] ], [ '%d' ] );
		if ( isset( $library['language'] ) ) {
			foreach ( $library['language'] as $languageCode => $translation ) {
				$wpdb->insert(
					"{$this->tbl}libraries_languages",
					[
						'library_id'    => $library['libraryId'],
						'language_code' => $languageCode,
						'translation'   => $translation,
					],
					[ '%d', '%s', '%s' ]
				);
			}
		}
	}

	private function pathsToCsv( $library, $key ) {
		if ( isset( $library[ $key ] ) ) {
			$paths = [];
			foreach ( $library[ $key ] as $file ) {
				$paths[] = $file['path'];
			}
			return implode( ', ', $paths );
		}
		return '';
	}

	public function deleteLibraryDependencies( $libraryId ) {
		global $wpdb;
		$wpdb->delete( "{$this->tbl}libraries_libraries", [ 'library_id' => $libraryId ], [ '%d' ] );
	}

	public function deleteLibrary( $library ) {
		global $wpdb;
		\H5PCore::deleteFileTree( $this->getH5pPath() . '/libraries/' . $library->name . '-' . $library->major_version . '.' . $library->minor_version );
		$wpdb->delete( "{$this->tbl}libraries_libraries", [ 'library_id' => $library->id ], [ '%d' ] );
		$wpdb->delete( "{$this->tbl}libraries_languages", [ 'library_id' => $library->id ], [ '%d' ] );
		$wpdb->delete( "{$this->tbl}libraries", [ 'id' => $library->id ], [ '%d' ] );
	}

	public function saveLibraryDependencies( $libraryId, $dependencies, $dependency_type ) {
		global $wpdb;
		foreach ( $dependencies as $dependency ) {
			$wpdb->query(
				$wpdb->prepare(
					"INSERT INTO {$this->tbl}libraries_libraries (library_id, required_library_id, dependency_type)
					SELECT %d, hl.id, %s FROM {$this->tbl}libraries hl
					WHERE name = %s AND major_version = %d AND minor_version = %d
					ON DUPLICATE KEY UPDATE dependency_type = %s",
					$libraryId,
					$dependency_type,
					$dependency['machineName'],
					$dependency['majorVersion'],
					$dependency['minorVersion'],
					$dependency_type
				)
			);
		}
	}

	public function loadLibraries() {
		global $wpdb;
		$results   = $wpdb->get_results(
			"SELECT id, name, title, major_version, minor_version, patch_version, runnable, restricted
			FROM {$this->tbl}libraries
			ORDER BY title ASC, major_version ASC, minor_version ASC"
		);
		$libraries = [];
		foreach ( $results as $library ) {
			$libraries[ $library->name ][] = $library;
		}
		return $libraries;
	}

	public function loadLibrary( $machineName, $majorVersion, $minorVersion ) {
		global $wpdb;
		$library = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id as libraryId, name as machineName, title, major_version as majorVersion, minor_version as minorVersion, patch_version as patchVersion,
					embed_types as embedTypes, preloaded_js as preloadedJs, preloaded_css as preloadedCss, drop_library_css as dropLibraryCss, fullscreen, runnable,
					semantics, has_icon as hasIcon
				FROM {$this->tbl}libraries
				WHERE name = %s AND major_version = %d AND minor_version = %d",
				$machineName,
				$majorVersion,
				$minorVersion
			),
			ARRAY_A
		);
		if ( ! $library ) {
			return null;
		}
		$dependencies = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT hl.name as machineName, hl.major_version as majorVersion, hl.minor_version as minorVersion, hll.dependency_type as dependencyType
				FROM {$this->tbl}libraries_libraries hll
				JOIN {$this->tbl}libraries hl ON hll.required_library_id = hl.id
				WHERE hll.library_id = %d",
				$library['libraryId']
			)
		);
		foreach ( $dependencies as $dependency ) {
			$library[ $dependency->dependencyType . 'Dependencies' ][] = [
				'machineName'  => $dependency->machineName,
				'majorVersion' => $dependency->majorVersion,
				'minorVersion' => $dependency->minorVersion,
			];
		}
		return $library;
	}

	private function getSemanticsFromFile( $name, $majorVersion, $minorVersion ) {
		$semanticsPath = $this->getH5pPath() . '/libraries/' . $name . '-' . $majorVersion . '.' . $minorVersion . '/semantics.json';
		if ( file_exists( $semanticsPath ) ) {
			$semantics = file_get_contents( $semanticsPath );
			if ( ! json_decode( $semantics, true ) ) {
				$this->setErrorMessage( $this->t( 'Invalid json in semantics for %library', [ '%library' => $name ] ) );
			}
			return $semantics;
		}
		return false;
	}

	public function loadLibrarySemantics( $name, $majorVersion, $minorVersion ) {
		global $wpdb;
		$semantics = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT semantics FROM {$this->tbl}libraries WHERE name = %s AND major_version = %d AND minor_version = %d",
				$name,
				$majorVersion,
				$minorVersion
			)
		);
		return ( $semantics === false ? null : $semantics );
	}

	public function alterLibrarySemantics( &$semantics, $name, $majorVersion, $minorVersion ) {
		do_action_ref_array( 'trueplayer/h5p/alter_library_semantics', [ &$semantics, $name, $majorVersion, $minorVersion ] );
	}

	public function loadAddons() {
		global $wpdb;
		return $wpdb->get_results(
			"SELECT l1.id as libraryId, l1.name as machineName,
				l1.major_version as majorVersion, l1.minor_version as minorVersion,
				l1.patch_version as patchVersion, l1.add_to as addTo,
				l1.preloaded_js as preloadedJs, l1.preloaded_css as preloadedCss
			FROM {$this->tbl}libraries AS l1
			LEFT JOIN {$this->tbl}libraries AS l2
				ON l1.name = l2.name AND
					(l1.major_version < l2.major_version OR
						(l1.major_version = l2.major_version AND l1.minor_version < l2.minor_version))
			WHERE l1.add_to IS NOT NULL AND l2.name IS NULL",
			ARRAY_A
		);
	}

	public function getLibraryConfig( $libraries = null ) {
		return defined( 'H5P_LIBRARY_CONFIG' ) ? H5P_LIBRARY_CONFIG : null;
	}

	public function libraryHasUpgrade( $library ) {
		global $wpdb;
		return $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$this->tbl}libraries
				WHERE name = %s AND (major_version > %d OR (major_version = %d AND minor_version > %d)) LIMIT 1",
				$library['machineName'],
				$library['majorVersion'],
				$library['majorVersion'],
				$library['minorVersion']
			)
		) !== null;
	}

	public function getLibraryContentCount() {
		global $wpdb;
		$count   = [];
		$results = $wpdb->get_results(
			"SELECT l.name, l.major_version, l.minor_version, COUNT(*) AS count
			FROM {$this->tbl}contents c, {$this->tbl}libraries l
			WHERE c.library_id = l.id
			GROUP BY l.name, l.major_version, l.minor_version"
		);
		foreach ( $results as $library ) {
			$count[ $library->name . ' ' . $library->major_version . '.' . $library->minor_version ] = $library->count;
		}
		return $count;
	}

	public function getLibraryStats( $type ) {
		global $wpdb;
		$count   = [];
		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT library_name AS name, library_version AS version, num FROM {$this->tbl}counters WHERE type = %s",
				$type
			)
		);
		foreach ( $results as $library ) {
			$count[ $library->name . ' ' . $library->version ] = $library->num;
		}
		return $count;
	}

	/* -- Content ------------------------------------------------------------- */

	public function updateContent( $content, $contentMainId = null ) {
		global $wpdb;
		$metadata = (array) $content['metadata'];
		$table    = "{$this->tbl}contents";

		$format = [];
		$data   = array_merge(
			\H5PMetadata::toDBArray( $metadata, true, true, $format ),
			[
				'updated_at' => current_time( 'mysql', 1 ),
				'parameters' => $content['params'],
				'embed_type' => 'div',
				'library_id' => $content['library']['libraryId'],
				'filtered'   => '',
				'disable'    => isset( $content['disable'] ) ? $content['disable'] : 0,
			]
		);
		$format[] = '%s'; // updated_at
		$format[] = '%s'; // parameters
		$format[] = '%s'; // embed_type
		$format[] = '%d'; // library_id
		$format[] = '%s'; // filtered
		$format[] = '%d'; // disable

		if ( ! isset( $content['id'] ) ) {
			$data['created_at'] = $data['updated_at'];
			$format[]           = '%s';
			$data['user_id']    = get_current_user_id();
			$format[]           = '%d';
			$wpdb->insert( $table, $data, $format );
			$content['id'] = $wpdb->insert_id;
		} else {
			$wpdb->update( $table, $data, [ 'id' => $content['id'] ], $format, [ '%d' ] );
		}
		return $content['id'];
	}

	public function insertContent( $content, $contentMainId = null ) {
		return $this->updateContent( $content );
	}

	public function getWhitelist( $isLibrary, $defaultContentWhitelist, $defaultLibraryWhitelist ) {
		$whitelist = $defaultContentWhitelist;
		if ( $isLibrary ) {
			$whitelist .= ' ' . $defaultLibraryWhitelist;
		}
		return $whitelist;
	}

	public function copyLibraryUsage( $contentId, $copyFromId, $contentMainId = null ) {
		global $wpdb;
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$this->tbl}contents_libraries (content_id, library_id, dependency_type, weight, drop_css)
				SELECT %d, hcl.library_id, hcl.dependency_type, hcl.weight, hcl.drop_css
				FROM {$this->tbl}contents_libraries hcl WHERE hcl.content_id = %d",
				$contentId,
				$copyFromId
			)
		);
	}

	public function deleteContentData( $contentId ) {
		global $wpdb;
		$wpdb->delete( "{$this->tbl}contents", [ 'id' => $contentId ], [ '%d' ] );
		$this->deleteLibraryUsage( $contentId );
		$wpdb->delete( "{$this->tbl}results", [ 'content_id' => $contentId ], [ '%d' ] );
		$wpdb->delete( "{$this->tbl}contents_user_data", [ 'content_id' => $contentId ], [ '%d' ] );
	}

	public function deleteLibraryUsage( $contentId ) {
		global $wpdb;
		$wpdb->delete( "{$this->tbl}contents_libraries", [ 'content_id' => $contentId ], [ '%d' ] );
	}

	public function saveLibraryUsage( $contentId, $librariesInUse ) {
		global $wpdb;
		$dropLibraryCssList = [];
		foreach ( $librariesInUse as $dependency ) {
			if ( ! empty( $dependency['library']['dropLibraryCss'] ) ) {
				$dropLibraryCssList = array_merge( $dropLibraryCssList, explode( ', ', $dependency['library']['dropLibraryCss'] ) );
			}
		}
		foreach ( $librariesInUse as $dependency ) {
			$dropCss = in_array( $dependency['library']['machineName'], $dropLibraryCssList, true ) ? 1 : 0;
			$wpdb->insert(
				"{$this->tbl}contents_libraries",
				[
					'content_id'      => $contentId,
					'library_id'      => $dependency['library']['libraryId'],
					'dependency_type' => $dependency['type'],
					'drop_css'        => $dropCss,
					'weight'          => $dependency['weight'],
				],
				[ '%d', '%d', '%s', '%d', '%d' ]
			);
		}
	}

	public function loadContent( $id ) {
		global $wpdb;
		$content = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT hc.id, hc.title, hc.parameters AS params, hc.filtered, hc.slug AS slug, hc.user_id,
					hc.embed_type AS embedType, hc.disable,
					hl.id AS libraryId, hl.name AS libraryName, hl.major_version AS libraryMajorVersion,
					hl.minor_version AS libraryMinorVersion, hl.embed_types AS libraryEmbedTypes, hl.fullscreen AS libraryFullscreen,
					hc.authors AS authors, hc.source AS source, hc.year_from AS yearFrom, hc.year_to AS yearTo,
					hc.license AS license, hc.license_version AS licenseVersion, hc.license_extras AS licenseExtras,
					hc.author_comments AS authorComments, hc.changes AS changes, hc.default_language AS defaultLanguage, hc.a11y_title AS a11yTitle
				FROM {$this->tbl}contents hc
				JOIN {$this->tbl}libraries hl ON hl.id = hc.library_id
				WHERE hc.id = %d",
				$id
			),
			ARRAY_A
		);

		if ( $content !== null ) {
			$content['metadata'] = [];
			$metadata_structure  = [ 'title', 'authors', 'source', 'yearFrom', 'yearTo', 'license', 'licenseVersion', 'licenseExtras', 'authorComments', 'changes', 'defaultLanguage', 'a11yTitle' ];
			foreach ( $metadata_structure as $property ) {
				if ( ! empty( $content[ $property ] ) ) {
					if ( $property === 'authors' || $property === 'changes' ) {
						$content['metadata'][ $property ] = json_decode( $content[ $property ] );
					} else {
						$content['metadata'][ $property ] = $content[ $property ];
					}
					if ( $property !== 'title' ) {
						unset( $content[ $property ] );
					}
				}
			}
		}
		return $content;
	}

	public function loadContentDependencies( $id, $type = null ) {
		global $wpdb;
		$query     = "SELECT hl.id, hl.name AS machineName, hl.major_version AS majorVersion, hl.minor_version AS minorVersion,
				hl.patch_version AS patchVersion, hl.preloaded_css AS preloadedCss, hl.preloaded_js AS preloadedJs,
				hcl.drop_css AS dropCss, hcl.dependency_type AS dependencyType
			FROM {$this->tbl}contents_libraries hcl
			JOIN {$this->tbl}libraries hl ON hcl.library_id = hl.id
			WHERE hcl.content_id = %d";
		$queryArgs = [ $id ];
		if ( $type !== null ) {
			$query       .= ' AND hcl.dependency_type = %s';
			$queryArgs[] = $type;
		}
		$query .= ' ORDER BY hcl.weight';
		return $wpdb->get_results( $wpdb->prepare( $query, $queryArgs ), ARRAY_A );
	}

	public function updateContentFields( $id, $fields ) {
		global $wpdb;
		$processedFields = [];
		$format          = [];
		foreach ( $fields as $name => $value ) {
			if ( is_int( $value ) ) {
				$format[] = '%d';
			} elseif ( is_float( $value ) ) {
				$format[] = '%f';
			} else {
				$format[] = '%s';
			}
			$processedFields[ self::camelToString( $name ) ] = $value;
		}
		$wpdb->update( "{$this->tbl}contents", $processedFields, [ 'id' => $id ], $format, [ '%d' ] );
	}

	private static function camelToString( $input ) {
		$input = preg_replace( '/[a-z0-9]([A-Z])[a-z0-9]/', '_$1', $input );
		return strtolower( $input );
	}

	public function clearFilteredParameters( $library_ids ) {
		global $wpdb;
		$wpdb->query(
			"UPDATE {$this->tbl}contents SET filtered = ''
			WHERE id IN (
				SELECT DISTINCT content_id FROM {$this->tbl}contents_libraries
				WHERE library_id IN (" . implode( ',', array_map( 'intval', $library_ids ) ) . ')
			)'
		);
	}

	public function getNumNotFiltered() {
		global $wpdb;
		return (int) $wpdb->get_var( "SELECT COUNT(id) FROM {$this->tbl}contents WHERE filtered = ''" );
	}

	public function getNumContent( $libraryId, $skip = null ) {
		global $wpdb;
		$skip_query = empty( $skip ) ? '' : " AND id NOT IN ($skip)";
		return (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(id) FROM {$this->tbl}contents WHERE library_id = %d {$skip_query}", $libraryId )
		);
	}

	public function isContentSlugAvailable( $slug ) {
		global $wpdb;
		return ! $wpdb->get_var( $wpdb->prepare( "SELECT slug FROM {$this->tbl}contents WHERE slug = %s", $slug ) );
	}

	public function resetContentUserData( $contentId ) {
		global $wpdb;
		$wpdb->update(
			"{$this->tbl}contents_user_data",
			[ 'updated_at' => current_time( 'mysql', 1 ), 'data' => 'RESET' ],
			[ 'content_id' => $contentId, 'invalidate' => 1 ],
			[ '%s', '%s' ],
			[ '%d', '%d' ]
		);
	}

	public function getNumAuthors() {
		global $wpdb;
		return $wpdb->get_var( "SELECT COUNT(DISTINCT user_id) FROM {$this->tbl}contents" );
	}

	/* -- Options ------------------------------------------------------------- */

	public function getOption( $name, $default = false ) {
		if ( $name === 'site_uuid' ) {
			$name = 'site_uuid';
		}
		return get_option( 'trueplayer_h5p_' . $name, $default );
	}

	public function setOption( $name, $value ) {
		$optionName = 'trueplayer_h5p_' . $name;
		if ( get_option( $optionName ) === false ) {
			add_option( $optionName, $value );
		} else {
			update_option( $optionName, $value );
		}
	}

	/* -- Dependency storage locks (unused: no library dev mode) -------------- */

	public function lockDependencyStorage() {}
	public function unlockDependencyStorage() {}

	/* -- Cached assets ------------------------------------------------------- */

	public function saveCachedAssets( $key, $libraries ) {
		global $wpdb;
		foreach ( $libraries as $library ) {
			$wpdb->insert(
				"{$this->tbl}libraries_cachedassets",
				[
					'library_id' => isset( $library['id'] ) ? $library['id'] : $library['libraryId'],
					'hash'       => $key,
				],
				[ '%d', '%s' ]
			);
		}
	}

	public function deleteCachedAssets( $library_id ) {
		global $wpdb;
		$results = $wpdb->get_results(
			$wpdb->prepare( "SELECT hash FROM {$this->tbl}libraries_cachedassets WHERE library_id = %d", $library_id )
		);
		$hashes  = [];
		foreach ( $results as $key ) {
			$hashes[] = $key->hash;
			$wpdb->delete( "{$this->tbl}libraries_cachedassets", [ 'hash' => $key->hash ], [ '%s' ] );
		}
		return $hashes;
	}

	public function afterExportCreated( $content, $filename ) {
		delete_transient( 'dirsize_cache' );
	}

	/* -- Permissions --------------------------------------------------------- */

	private static function currentUserCanEdit( $contentUserId ) {
		if ( current_user_can( 'edit_others_posts' ) ) {
			return true;
		}
		return get_current_user_id() == $contentUserId;
	}

	public function hasPermission( $permission, $id = null ) {
		switch ( $permission ) {
			case \H5PPermission::DOWNLOAD_H5P:
			case \H5PPermission::EMBED_H5P:
			case \H5PPermission::COPY_H5P:
				return self::currentUserCanEdit( $id );
			case \H5PPermission::CREATE_RESTRICTED:
			case \H5PPermission::UPDATE_LIBRARIES:
			case \H5PPermission::INSTALL_RECOMMENDED:
				return current_user_can( 'manage_options' );
		}
		return false;
	}

	public function getAdminUrl() {
		return '';
	}

	/* -- Content hub (not used) --------------------------------------------- */

	public function replaceContentTypeCache( $contentTypeCache ) {}
	public function replaceContentHubMetadataCache( $metadata, $lang ) {
		return [];
	}
	public function getContentHubMetadataCache( $lang = 'en' ) {
		return null;
	}
	public function getContentHubMetadataChecked( $lang = 'en' ) {
		return null;
	}
	public function setContentHubMetadataChecked( $time, $lang = 'en' ) {
		return [];
	}
	public function resetHubOrganizationData() {}

	public static function dateTimeToTime( $datetime ) {
		$dt = new \DateTime( $datetime );
		return $dt->getTimestamp();
	}
}
