// Predefined player looks (FluentPlayer-style). Shared by the Presets builder
// (starting point for a new preset) and Settings → General (site-wide default
// player template). Each seeds config.customize.appearance.
// `description` is what the picker shows under each tile. Each line states the
// one thing that skin actually does differently in player/style.css — the
// tiles alone can only hint at it, and "Modern / Simple / Standard" tells an
// author nothing about which to choose.
import { __ } from '@Utils/translation';

export const PRESET_TEMPLATES = [
	{ key: 'default', label: __( 'Default' ), description: __( 'Gradient bar fading over the picture. The balanced baseline.' ), appearance: { skin: 'default', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 10 } },
	{ key: 'modern', label: __( 'Modern' ), description: __( 'Roomier bar, thicker scrubber and a larger play button.' ), appearance: { skin: 'modern', controlBarStyle: 'solid', playButtonStyle: 'soft', roundness: 14 } },
	{ key: 'simple', label: __( 'Simple' ), description: __( 'Flat solid bar, tight padding — quiet and unobtrusive.' ), appearance: { skin: 'simple', controlBarStyle: 'solid', playButtonStyle: 'square', roundness: 6 } },
	{ key: 'minimal', label: __( 'Minimal' ), description: __( 'Controls in a small pill. Time and volume are hidden.' ), appearance: { skin: 'minimal', controlBarStyle: 'minimal', playButtonStyle: 'square', roundness: 0 } },
	{ key: 'standard', label: __( 'Standard' ), description: __( 'Opaque deck with square edges — the classic player look.' ), appearance: { skin: 'standard', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 8 } },
	{ key: 'floating', label: __( 'Floating' ), pro: true, description: __( 'The bar detaches from the edge as a blurred, rounded panel.' ), appearance: { skin: 'floating', controlBarStyle: 'solid', playButtonStyle: 'soft', roundness: 16 } },
	{ key: 'ambient', label: __( 'Ambient' ), pro: true, description: __( 'A blurred glow of the poster spills out behind the player.' ), appearance: { skin: 'ambient', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 8 } },
];

// The config object a template seeds (for creating a preset from it).
export function templateConfig( key ) {
	const t = PRESET_TEMPLATES.find( ( x ) => x.key === key );
	return t ? { customize: { appearance: { ...t.appearance } } } : {};
}

export const ASPECT_RATIOS = [
	{ value: '16:9', label: __( '16:9 (widescreen)' ) },
	{ value: '9:16', label: __( '9:16 (vertical)' ) },
	{ value: '4:3', label: __( '4:3 (classic)' ) },
	{ value: '1:1', label: __( '1:1 (square)' ) },
	{ value: '21:9', label: __( '21:9 (cinematic)' ) },
	{ value: 'auto', label: __( 'Auto (native)' ) },
];
