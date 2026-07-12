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
			// GemCRM design tokens — ground truth: gemcrm/assets/scss/Common/_global.scss.
			colors: {
				brand: {
					50: '#eef3ff',
					100: '#E3E7FF', // primary-light (soft surface / active nav bg)
					200: '#c3d0ff',
					300: '#94adff',
					400: '#5b83ff',
					500: '#006BFF', // primary
					600: '#005ce0',
					700: '#004ab8',
					800: '#003a90',
					900: '#002d70',
				},
				ink: '#1f2937', // font-color / heading
				label: '#374151', // setting labels / nav titles
				line: '#e5e7eb', // border-color (single source)
				divider: '#f3f4f6', // row dividers
				body: '#F6F7F8', // page background
				subtle: '#F6F7F8', // secondary surface (same as body)
				placeholder: '#A2ADB9',
				muted: '#6b7280', // descriptions / subtitles / muted text
				// Status
				success: { DEFAULT: '#00AD6B', light: 'rgba(0,173,107,0.10)' },
				danger: { DEFAULT: '#F15B50', light: '#FDE8E7' },
				warning: { DEFAULT: '#FDB022', light: 'rgba(253,176,34,0.12)' },
			},
			fontFamily: {
				// GemCRM uses the native system stack (no blocking webfont request).
				sans: [ '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji' ],
			},
			boxShadow: {
				// GemCRM currently runs the border-only look (--gemcrm-shadow: none).
				card: 'none',
				pop: '0 8px 28px rgba(16,24,40,0.12)', // overlays/modals only
			},
			borderRadius: {
				DEFAULT: '4px', // inputs, buttons, cells
				card: '8px', // cards / panels
			},
		},
	},
	plugins: [],
};
