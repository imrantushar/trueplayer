const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const path = require('path');

// Single source of truth — must match trueplayer.php's TRUEPLAYER_VERSION
// so PHP's wp_enqueue_script(`build/{name}.{VERSION}.js`) resolves to the
// file webpack actually emitted.
const TRUEPLAYER_VERSION = require('./package.json').version;

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
	plugins: [...defaultConfig.plugins, new CleanWebpackPlugin()],
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
