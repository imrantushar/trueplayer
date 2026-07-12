// Predefined player looks (FluentPlayer-style). Shared by the Presets builder
// (starting point for a new preset) and Settings → General (site-wide default
// player template). Each seeds config.customize.appearance.
export const PRESET_TEMPLATES = [
	{ key: 'default', label: 'Default', appearance: { skin: 'default', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 10 } },
	{ key: 'modern', label: 'Modern', appearance: { skin: 'modern', controlBarStyle: 'solid', playButtonStyle: 'soft', roundness: 14 } },
	{ key: 'simple', label: 'Simple', appearance: { skin: 'simple', controlBarStyle: 'solid', playButtonStyle: 'square', roundness: 6 } },
	{ key: 'minimal', label: 'Minimal', appearance: { skin: 'minimal', controlBarStyle: 'minimal', playButtonStyle: 'square', roundness: 0 } },
	{ key: 'standard', label: 'Standard', appearance: { skin: 'standard', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 8 } },
	{ key: 'floating', label: 'Floating', pro: true, appearance: { skin: 'floating', controlBarStyle: 'solid', playButtonStyle: 'soft', roundness: 16 } },
	{ key: 'ambient', label: 'Ambient', pro: true, appearance: { skin: 'ambient', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 8 } },
];

// The config object a template seeds (for creating a preset from it).
export function templateConfig( key ) {
	const t = PRESET_TEMPLATES.find( ( x ) => x.key === key );
	return t ? { customize: { appearance: { ...t.appearance } } } : {};
}

export const ASPECT_RATIOS = [
	{ value: '16:9', label: '16:9 (widescreen)' },
	{ value: '9:16', label: '9:16 (vertical)' },
	{ value: '4:3', label: '4:3 (classic)' },
	{ value: '1:1', label: '1:1 (square)' },
	{ value: '21:9', label: '21:9 (cinematic)' },
	{ value: 'auto', label: 'Auto (native)' },
];
