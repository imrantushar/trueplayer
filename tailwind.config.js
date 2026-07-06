/** @type {import('tailwindcss').Config} */
module.exports = {
	// React UI: both the admin SPA and the frontend player use Tailwind.
	content: [ './dev_trueplayer/**/*.{js,jsx}' ],
	corePlugins: {
		// WP admin already ships a reset; avoid preflight fighting core styles.
		preflight: false,
	},
	theme: {
		extend: {
			// StoreEngine-inspired design tokens.
			colors: {
				brand: {
					50: '#e6f4ff',
					100: '#cce9ff',
					200: '#99d3ff',
					300: '#66bcff',
					400: '#33a6ff',
					500: '#008dff', // primary
					600: '#0077e0',
					700: '#005fb3',
					800: '#004886',
					900: '#00396b',
				},
				ink: '#2c3135', // body/heading text
				line: '#dedede', // borders
				subtle: '#eae8fa', // light lavender surface
			},
			fontFamily: {
				sans: [ 'Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif' ],
			},
			boxShadow: {
				card: '0 0.5px 2px 0 rgba(16, 24, 40, 0.15)',
				pop: '0 8px 28px rgba(16, 24, 40, 0.12)',
			},
			borderRadius: {
				card: '8px',
			},
		},
	},
	plugins: [],
};
