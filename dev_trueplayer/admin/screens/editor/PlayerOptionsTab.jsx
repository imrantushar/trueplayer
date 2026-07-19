import { useState } from '@wordpress/element';
import { Card, Field, Input, Select, Toggle, Textarea, SubSidebar, ColorInput } from '../../components/UI';
import { isPro, PRO_SKINS } from '../../pro';

const PLAYER_SUBS = [
	['appearance', 'Appearance'],
	['captions', 'Captions'],
	['controls', 'Controls'],
	['behavior', 'Behaviour'],
	['playback', 'Playback'],
	['css', 'Custom CSS'],
];

const SKINS = [
	{ value: 'default', label: 'Default' },
	{ value: 'modern', label: 'Modern' },
	{ value: 'simple', label: 'Simple' },
	{ value: 'minimal', label: 'Minimal' },
	{ value: 'standard', label: 'Standard' },
	{ value: 'floating', label: 'Floating' },
	{ value: 'ambient', label: 'Ambient' },
];

const ASPECT_RATIOS = [
	{ value: '16:9', label: '16:9 (widescreen)' },
	{ value: '9:16', label: '9:16 (vertical)' },
	{ value: '4:3', label: '4:3 (classic)' },
	{ value: '1:1', label: '1:1 (square)' },
	{ value: '21:9', label: '21:9 (cinematic)' },
	{ value: 'auto', label: 'Auto (native)' },
];

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
	settings: 'Settings (gear, incl. playback speed)',
	pip: 'Picture-in-picture',
	fullscreen: 'Fullscreen',
	download: 'Download button',
};

const DEFAULTS = {
	controls: { play: true, rewind: true, forward: true, progress: true, currentTime: true, duration: true, mute: true, volume: true, captions: true, settings: true, pip: true, fullscreen: true, download: false },
	behavior: { autoplay: false, autoplayMode: '', muted: false, loop: false, resetOnEnd: false, savePosition: true, hideControls: true, sticky: false, stickyPosition: 'bottom-right', preload: 'metadata', loadStrategy: 'facade', noSkip: false, disableSeek: false, hoverPreview: false },
	appearance: { skin: 'default', accent: '#4f46e5', hoverColor: '', bigPlay: true, playButtonStyle: 'circle', roundness: 10, controlBarStyle: 'gradient', aspectRatio: '16:9', captionSize: 100, captionColor: '#ffffff', captionBackground: '#000000', captionOpacity: 75 },
	speeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
	skipSeconds: 10,
};

export default function PlayerOptionsTab({ config, patch, presets = [] }) {
	const cz = {
		controls: { ...DEFAULTS.controls, ...(config.customize?.controls || {}) },
		behavior: { ...DEFAULTS.behavior, ...(config.customize?.behavior || {}) },
		appearance: { ...DEFAULTS.appearance, accent: config.branding?.accent || DEFAULTS.appearance.accent, ...(config.customize?.appearance || {}) },
		speeds: config.customize?.speeds || DEFAULTS.speeds,
		skipSeconds: config.customize?.skipSeconds || DEFAULTS.skipSeconds,
	};

	const setSection = (section, partial) =>
		patch({ customize: { ...(config.customize || {}), [section]: { ...cz[section], ...partial } } });
	const setRoot = (partial) => patch({ customize: { ...(config.customize || {}), ...partial } });

	const appearance = cz.appearance;
	const behavior = cz.behavior;
	const controls = cz.controls;

	const [sub, setSub] = useState('appearance');

	return (
		<div className="flex gap-6 items-start">
			<SubSidebar items={PLAYER_SUBS} value={sub} onChange={setSub} />
			<div className="flex-1 min-w-0 w-full">
				<div className="flex gap-6 items-start">
					<div className="w-full max-w-2xl space-y-6">
						{sub === 'appearance' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900">Appearance</h3>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									{presets.length > 0 && (
										<Field label="Preset" hint="Apply a saved player preset as the starting point — you can still tweak anything below.">
											<Select
												value={config.presetId || ''}
												onChange={(e) => patch({ presetId: e.target.value ? parseInt(e.target.value, 10) : undefined })}
											>
												<option value="">None</option>
												{presets.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
											</Select>
										</Field>
									)}
									<div className="grid md:grid-cols-2 gap-x-6">
										<Field label="Skin" hint={isPro() ? 'Overall player theme.' : 'Floating & Ambient need TruePlayer Pro.'}>
											<Select value={appearance.skin} onChange={(e) => setSection('appearance', { skin: e.target.value })}>
												{SKINS.map((s) => (
													<option key={s.value} value={s.value} disabled={!isPro() && PRO_SKINS.includes(s.value)}>
														{s.label}{!isPro() && PRO_SKINS.includes(s.value) ? ' 🔒 Pro' : ''}
													</option>
												))}
											</Select>
										</Field>
										<Field label="Aspect ratio" hint="9:16 for vertical / Shorts-style video.">
											<Select value={appearance.aspectRatio} onChange={(e) => setSection('appearance', { aspectRatio: e.target.value })}>
												{ASPECT_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
											</Select>
										</Field>
										<Field label="Accent color" hint="Scrubber, buttons, highlights.">
											<ColorInput value={appearance.accent} onChange={(v) => setSection('appearance', { accent: v })} />
										</Field>
										<Field label="Button hover color" hint="Optional; default is a light overlay.">
											<ColorInput value={appearance.hoverColor} onChange={(v) => setSection('appearance', { hoverColor: v })} placeholder="(none)" />
										</Field>
										<Field label="Play button style">
											<Select value={appearance.playButtonStyle} onChange={(e) => setSection('appearance', { playButtonStyle: e.target.value })}>
												<option value="circle">Circle</option>
												<option value="soft">Soft (rounded)</option>
												<option value="square">Square</option>
											</Select>
										</Field>
										<Field label="Control bar style">
											<Select value={appearance.controlBarStyle} onChange={(e) => setSection('appearance', { controlBarStyle: e.target.value })}>
												<option value="gradient">Gradient</option>
												<option value="solid">Solid</option>
												<option value="minimal">Minimal</option>
											</Select>
										</Field>
										<Field label={`Corner roundness (${appearance.roundness}px)`}>
											<input type="range" min="0" max="28" value={appearance.roundness} onChange={(e) => setSection('appearance', { roundness: parseInt(e.target.value, 10) })} className="w-full accent-brand-500 cursor-pointer" />
										</Field>
									</div>
									<Toggle checked={appearance.bigPlay} onChange={(v) => setSection('appearance', { bigPlay: v })} label="Show large center play button" />
								</div>
							</Card>
						)}

						{sub === 'captions' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">Subtitle style</h3>
								<p className="text-sm text-gray-500">How captions render on self-hosted / HLS video. YouTube & Vimeo embeds style their own.</p>
								<div className="grid md:grid-cols-2 gap-x-6 mt-4 pt-5 border-t border-solid border-line">
									<Field label={`Font size (${appearance.captionSize}%)`}>
										<input type="range" min="50" max="200" step="10" value={appearance.captionSize} onChange={(e) => setSection('appearance', { captionSize: parseInt(e.target.value, 10) })} className="w-full accent-brand-500 cursor-pointer" />
									</Field>
									<Field label="Text color">
										<ColorInput value={appearance.captionColor} onChange={(v) => setSection('appearance', { captionColor: v })} />
									</Field>
									<Field label="Background color">
										<ColorInput value={appearance.captionBackground} onChange={(v) => setSection('appearance', { captionBackground: v })} />
									</Field>
									<Field label={`Background opacity (${appearance.captionOpacity}%)`}>
										<input type="range" min="0" max="100" step="5" value={appearance.captionOpacity} onChange={(e) => setSection('appearance', { captionOpacity: parseInt(e.target.value, 10) })} className="w-full accent-brand-500 cursor-pointer" />
									</Field>
								</div>
							</Card>

						)}

						{sub === 'controls' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">Controls</h3>
								<p className="text-sm text-gray-500">Show or hide each control in the bar.</p>
								<div className="grid md:grid-cols-2 gap-6 mt-4 pt-5 border-t border-solid border-line">
									{Object.keys(CONTROL_LABELS).map((key) => (
										<Toggle key={key} checked={controls[key]} onChange={(v) => setSection('controls', { [key]: v })} label={CONTROL_LABELS[key]} />
									))}
								</div>
							</Card>

						)}

						{sub === 'behavior' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 mb-4">Behavior</h3>
								<div className="grid gap-x-6 mt-4 pt-5 border-t border-solid border-line">
									<Field label="Autoplay" hint="“With sound” falls back to muted when the browser blocks it.">
										<Select
											value={behavior.autoplayMode || (behavior.autoplay ? 'muted' : 'off')}
											onChange={(e) => {
												const mode = e.target.value;
												// Keep the legacy boolean in sync for older readers.
												setSection('behavior', { autoplayMode: mode, autoplay: mode !== 'off' });
											}}
										>
											<option value="off">Off</option>
											<option value="muted">On, muted</option>
											<option value="sound">On, with sound</option>
										</Select>
									</Field>
									<div className='flex flex-col gap-6 mb-6'>
										<Toggle checked={behavior.muted} onChange={(v) => setSection('behavior', { muted: v })} label="Start muted" />
										<Toggle checked={behavior.loop} onChange={(v) => setSection('behavior', { loop: v })} label="Loop" />
										<Toggle checked={behavior.resetOnEnd} onChange={(v) => setSection('behavior', { resetOnEnd: v })} label="Reset to start when finished" />
									</div>

									<div className='flex flex-col gap-6'>
										<Toggle checked={behavior.savePosition} onChange={(v) => setSection('behavior', { savePosition: v })} label="Save & resume playback position" />
										<Toggle checked={behavior.hideControls} onChange={(v) => setSection('behavior', { hideControls: v })} label="Auto-hide controls while playing" />
										<Toggle checked={behavior.sticky} onChange={(v) => setSection('behavior', { sticky: v })} label="Float player when scrolling away" />
										<Toggle checked={behavior.noSkip} onChange={(v) => setSection('behavior', { noSkip: v })} label="Prevent skipping ahead (no jumping to unwatched parts)" disabled={behavior.disableSeek} />
										<Toggle checked={behavior.disableSeek} onChange={(v) => setSection('behavior', { disableSeek: v })} label="Disable the timeline entirely (no click or drag, forward or back)" />
										<Toggle checked={behavior.hoverPreview} onChange={(v) => setSection('behavior', { hoverPreview: v })} label="Muted preview on hover (self-hosted video)" />
									</div>
								</div>
								<div className="grid md:grid-cols-2 gap-x-6 mt-6">
									{behavior.sticky && (
										<Field label="Float position">
											<Select value={behavior.stickyPosition} onChange={(e) => setSection('behavior', { stickyPosition: e.target.value })}>
												<option value="bottom-right">Bottom right</option>
												<option value="bottom-left">Bottom left</option>
												<option value="top-right">Top right</option>
												<option value="top-left">Top left</option>
											</Select>
										</Field>
									)}
									<Field label="Preload" hint="How much to load before play.">
										<Select value={behavior.preload} onChange={(e) => setSection('behavior', { preload: e.target.value })}>
											<option value="metadata">Metadata only</option>
											<option value="auto">Auto (full)</option>
											<option value="none">None</option>
										</Select>
									</Field>
									<Field label="Load strategy" hint="When the player boots — keeps below-the-fold pages fast.">
										<Select value={behavior.loadStrategy || 'facade'} onChange={(e) => setSection('behavior', { loadStrategy: e.target.value })}>
											<option value="facade">On click (poster until played)</option>
											<option value="onvisible">When scrolled into view</option>
											<option value="eager">Immediately on page load</option>
										</Select>
									</Field>
								</div>
							</Card>

						)}

						{sub === 'playback' && (
							<Card className="p-6 max-w-2xl">
								<h3 className="font-semibold text-gray-900 mb-4">Playback</h3>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Field label="Playback speeds" hint="Comma-separated, e.g. 0.5, 1, 1.5, 2">
										<Input
											value={cz.speeds.join(', ')}
											onChange={(e) => {
												const speeds = e.target.value.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n) && n > 0);
												setRoot({ speeds: speeds.length ? speeds : DEFAULTS.speeds });
											}}
										/>
									</Field>
									<Field label="Skip interval (seconds)" hint="Rewind / fast-forward + arrow keys.">
										<Input type="number" min="1" max="60" className="w-28" value={cz.skipSeconds} onChange={(e) => setRoot({ skipSeconds: parseInt(e.target.value, 10) || 10 })} />
									</Field>
								</div>
							</Card>

						)}

						{sub === 'css' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">Custom CSS</h3>
								<p className="text-sm text-gray-500 mb-4">
									Printed with this player on the frontend. Scope rules with <code className="text-xs bg-gray-100 px-1 rounded">.trueplayer-mount</code> (all players) or <code className="text-xs bg-gray-100 px-1 rounded">.tp-stage</code>.
								</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Textarea
										rows={6}
										className="font-mono text-xs"
										value={config.customize?.css || ''}
										onChange={(e) => setRoot({ css: e.target.value })}
										placeholder={'.tp-stage { box-shadow: 0 10px 40px rgba(0,0,0,.2); }'}
									/>
								</div>
							</Card>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
