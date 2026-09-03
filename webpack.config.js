const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const path = require('path');

// Single source of truth — must match trueplayer.php's TRUEPLAYER_VERSION
// so PHP's wp_enqueue_script(`build/{name}.{VERSION}.js`) resolves to the
// file webpack actually emitted. Kept in step with the plugin header and
// TRUEPLAYER_VERSION in trueplayer.php — assets.php builds URLs from that
// constant, so a mismatch here 404s every script.
const TRUEPLAYER_VERSION = '1.2.0';

const config = {
	...defaultConfig,
	cache: {
		type: 'filesystem',
		allowCollectingMemory: true,
		compression: 'gzip',
		buildDependencies: {
			config: [__filename],
		},
	},
	entry: {
		backend: path.resolve(__dirname, 'dev_trueplayer/backend.js'),
		frontend: path.resolve(__dirname, 'dev_trueplayer/frontend.js'),
		block: path.resolve(__dirname, 'dev_trueplayer/block/index.js'),
	},
	output: {
		filename: `[name].${TRUEPLAYER_VERSION}.js`,
		path: path.resolve(__dirname, 'assets/build'),
		// Lazy chunks (hls.js, YouTube/Vimeo providers) load from the build dir.
		publicPath: 'auto',
	},
	// `cleanStaleWebpackAssets` is off because it breaks `wp-scripts start`:
	// on an incremental rebuild webpack only re-emits what changed, so the
	// plugin treats untouched lazy chunks (yt/vimeo/hlsjs) as stale and deletes
	// them — and the next player mount dies with a ChunkLoadError. The
	// once-before-build clean still runs, so a fresh build stays tidy.
	plugins: [ ...defaultConfig.plugins, new CleanWebpackPlugin( { cleanStaleWebpackAssets: false } ) ],
	module: {
		...defaultConfig.module,
		rules: [
			...defaultConfig.module.rules,
			// The admin "What's New" panel imports changelog.md as a plain string
			// to parse — webpack 5's built-in asset/source type (no extra loader
			// dependency needed, unlike QuizPress's own raw-loader-based version
			// of this same panel).
			{ test: /\.md$/, type: 'asset/source' },
		],
	},
	resolve: {
		...defaultConfig.resolve,
		extensions: [ '.js', '.jsx', '.ts', '.tsx', '.json', '...' ],
		alias: {
			...defaultConfig.resolve.alias,
			'@Admin': path.resolve(__dirname, 'dev_trueplayer/admin/'),
			'@Player': path.resolve(__dirname, 'dev_trueplayer/player/'),
			'@Providers': path.resolve(__dirname, 'dev_trueplayer/player/providers/'),
			'@Global': path.resolve(__dirname, 'dev_trueplayer/global/'),
			'@Utils': path.resolve(__dirname, 'dev_trueplayer/utils/'),
		},
	},
};

module.exports = config;
