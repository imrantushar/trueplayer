import { Card, Field, Input, Select, Toggle } from '../../components/UI';

const CONTROL_LABELS = {
	play: 'Play / pause',
	rewind: 'Rewind',
	forward: 'Fast-forward',
	progress: 'Progress bar',
	currentTime: 'Current time',
	duration: 'Duration',
	mute: 'Mute',
	volume: 'Volume slider',
	captions: 'Captions',
	settings: 'Settings (gear)',
	speed: 'Playback speed',
	pip: 'Picture-in-picture',
	fullscreen: 'Fullscreen',
	download: 'Download button',
};

const DEFAULTS = {
	controls: { play: true, rewind: true, forward: true, progress: true, currentTime: true, duration: true, mute: true, volume: true, captions: true, settings: true, speed: true, pip: true, fullscreen: true, download: false },
	behavior: { autoplay: false, muted: false, loop: false, resetOnEnd: false, savePosition: true, hideControls: true, sticky: false, stickyPosition: 'bottom-right', preload: 'metadata' },
	appearance: { accent: '#4f46e5', hoverColor: '', bigPlay: true, playButtonStyle: 'circle', roundness: 10, controlBarStyle: 'gradient' },
	speeds: [ 0.5, 0.75, 1, 1.25, 1.5, 2 ],
	skipSeconds: 10,
};

export default function PlayerOptionsTab( { config, patch } ) {
	const cz = {
		controls: { ...DEFAULTS.controls, ...( config.customize?.controls || {} ) },
		behavior: { ...DEFAULTS.behavior, ...( config.customize?.behavior || {} ) },
		appearance: { ...DEFAULTS.appearance, accent: config.branding?.accent || DEFAULTS.appearance.accent, ...( config.customize?.appearance || {} ) },
		speeds: config.customize?.speeds || DEFAULTS.speeds,
		skipSeconds: config.customize?.skipSeconds || DEFAULTS.skipSeconds,
	};

	const setSection = ( section, partial ) =>
		patch( { customize: { ...( config.customize || {} ), [ section ]: { ...cz[ section ], ...partial } } } );
	const setRoot = ( partial ) => patch( { customize: { ...( config.customize || {} ), ...partial } } );

	const appearance = cz.appearance;
	const behavior = cz.behavior;
	const controls = cz.controls;

	return (
		<div className="space-y-6">
			{ /* Appearance */ }
			<Card className="p-6">
				<h3 className="font-semibold text-gray-900 mb-4">Appearance</h3>
				<div className="grid md:grid-cols-2 gap-x-6">
					<Field label="Accent color" hint="Scrubber, buttons, highlights.">
						<div className="flex gap-2 items-center">
							<input type="color" value={ appearance.accent } onChange={ ( e ) => setSection( 'appearance', { accent: e.target.value } ) } className="h-9 w-12 rounded border border-line" />
							<Input value={ appearance.accent } onChange={ ( e ) => setSection( 'appearance', { accent: e.target.value } ) } />
						</div>
					</Field>
					<Field label="Button hover color" hint="Optional; default is a light overlay.">
						<div className="flex gap-2 items-center">
							<input type="color" value={ appearance.hoverColor || '#ffffff' } onChange={ ( e ) => setSection( 'appearance', { hoverColor: e.target.value } ) } className="h-9 w-12 rounded border border-line" />
							<Input value={ appearance.hoverColor } onChange={ ( e ) => setSection( 'appearance', { hoverColor: e.target.value } ) } placeholder="(none)" />
						</div>
					</Field>
					<Field label="Play button style">
						<Select value={ appearance.playButtonStyle } onChange={ ( e ) => setSection( 'appearance', { playButtonStyle: e.target.value } ) }>
							<option value="circle">Circle</option>
							<option value="soft">Soft (rounded)</option>
							<option value="square">Square</option>
						</Select>
					</Field>
					<Field label="Control bar style">
						<Select value={ appearance.controlBarStyle } onChange={ ( e ) => setSection( 'appearance', { controlBarStyle: e.target.value } ) }>
							<option value="gradient">Gradient</option>
							<option value="solid">Solid</option>
							<option value="minimal">Minimal</option>
						</Select>
					</Field>
					<Field label={ `Corner roundness (${ appearance.roundness }px)` }>
						<input type="range" min="0" max="28" value={ appearance.roundness } onChange={ ( e ) => setSection( 'appearance', { roundness: parseInt( e.target.value, 10 ) } ) } className="w-full" />
					</Field>
				</div>
				<Toggle checked={ appearance.bigPlay } onChange={ ( v ) => setSection( 'appearance', { bigPlay: v } ) } label="Show large center play button" />
			</Card>

			{ /* Controls */ }
			<Card className="p-6">
				<h3 className="font-semibold text-gray-900 mb-1">Controls</h3>
				<p className="text-sm text-gray-500 mb-4">Show or hide each control in the bar.</p>
				<div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
					{ Object.keys( CONTROL_LABELS ).map( ( key ) => (
						<Toggle key={ key } checked={ controls[ key ] } onChange={ ( v ) => setSection( 'controls', { [ key ]: v } ) } label={ CONTROL_LABELS[ key ] } />
					) ) }
				</div>
			</Card>

			{ /* Behavior */ }
			<Card className="p-6">
				<h3 className="font-semibold text-gray-900 mb-4">Behavior</h3>
				<div className="grid md:grid-cols-2 gap-x-6">
					<div>
						<Toggle checked={ behavior.autoplay } onChange={ ( v ) => setSection( 'behavior', { autoplay: v } ) } label="Autoplay (starts muted)" />
						<Toggle checked={ behavior.muted } onChange={ ( v ) => setSection( 'behavior', { muted: v } ) } label="Start muted" />
						<Toggle checked={ behavior.loop } onChange={ ( v ) => setSection( 'behavior', { loop: v } ) } label="Loop" />
						<Toggle checked={ behavior.resetOnEnd } onChange={ ( v ) => setSection( 'behavior', { resetOnEnd: v } ) } label="Reset to start when finished" />
					</div>
					<div>
						<Toggle checked={ behavior.savePosition } onChange={ ( v ) => setSection( 'behavior', { savePosition: v } ) } label="Save & resume playback position" />
						<Toggle checked={ behavior.hideControls } onChange={ ( v ) => setSection( 'behavior', { hideControls: v } ) } label="Auto-hide controls while playing" />
						<Toggle checked={ behavior.sticky } onChange={ ( v ) => setSection( 'behavior', { sticky: v } ) } label="Float player when scrolling away" />
					</div>
				</div>
				<div className="grid md:grid-cols-2 gap-x-6 mt-2">
					{ behavior.sticky && (
						<Field label="Float position">
							<Select value={ behavior.stickyPosition } onChange={ ( e ) => setSection( 'behavior', { stickyPosition: e.target.value } ) }>
								<option value="bottom-right">Bottom right</option>
								<option value="bottom-left">Bottom left</option>
								<option value="top-right">Top right</option>
								<option value="top-left">Top left</option>
							</Select>
						</Field>
					) }
					<Field label="Preload" hint="How much to load before play.">
						<Select value={ behavior.preload } onChange={ ( e ) => setSection( 'behavior', { preload: e.target.value } ) }>
							<option value="metadata">Metadata only</option>
							<option value="auto">Auto (full)</option>
							<option value="none">None</option>
						</Select>
					</Field>
				</div>
			</Card>

			{ /* Playback */ }
			<Card className="p-6 max-w-2xl">
				<h3 className="font-semibold text-gray-900 mb-4">Playback</h3>
				<Field label="Playback speeds" hint="Comma-separated, e.g. 0.5, 1, 1.5, 2">
					<Input
						value={ cz.speeds.join( ', ' ) }
						onChange={ ( e ) => {
							const speeds = e.target.value.split( ',' ).map( ( s ) => parseFloat( s.trim() ) ).filter( ( n ) => ! isNaN( n ) && n > 0 );
							setRoot( { speeds: speeds.length ? speeds : DEFAULTS.speeds } );
						} }
					/>
				</Field>
				<Field label="Skip interval (seconds)" hint="Rewind / fast-forward + arrow keys.">
					<Input type="number" min="1" max="60" className="w-28" value={ cz.skipSeconds } onChange={ ( e ) => setRoot( { skipSeconds: parseInt( e.target.value, 10 ) || 10 } ) } />
				</Field>
			</Card>
		</div>
	);
}
