import { Card, Field, Input, Select, Toggle, Textarea, ColorInput } from '../../components/UI';
import { isPro, PRO_SKINS } from '../../pro';
import { resolveCustomize, CUSTOMIZE_DEFAULTS } from '@Player/customize';

// Player sub-sections. Exported so the editor's left-nav accordion (Editor.jsx)
// can drive which one is shown — this tab renders the active section only.
export const PLAYER_SUBS = [
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

export default function PlayerOptionsTab({ config, patch, presets = [], sub = 'appearance' }) {
	// Resolved exactly the way the player resolves it — built-in defaults, then
	// the site-wide look from Settings → Default player template, then this
	// video's own overrides. This form used to resolve against a second copy of
	// the built-in defaults kept in this file, which never saw the site-wide
	// layer: a freshly created video read "Default" here while the preview
	// beside it, and every visitor, got the template chosen in Settings.
	const cz = resolveCustomize(config);

	// Write only the keys the author actually touched. Writing the whole
	// resolved section would stamp today's site-wide template into the video
	// the moment anyone opens this tab and changes one field, and the site
	// setting would silently stop reaching it from then on — the same trap
	// Helper::enforcement_defaults documents for the gating tab.
	const setSection = (section, partial) =>
		patch({ customize: { ...(config.customize || {}), [section]: { ...(config.customize?.[section] || {}), ...partial } } });
	const setRoot = (partial) => patch({ customize: { ...(config.customize || {}), ...partial } });

	const appearance = cz.appearance;
	const behavior = cz.behavior;
	const controls = cz.controls;

	const source = config.source || {};
	const isEmbedProvider = source.type === 'youtube' || source.type === 'vimeo';
	const isAudioSource = source.mediaType === 'audio';

	// Which control-bar buttons can ever do anything for the current source —
	// mirrors the provider capabilities in player/providers/*.js (youtube/vimeo
	// have no download, youtube has no PiP, audio has no PiP/fullscreen) so we
	// don't offer a toggle whose control button will just never render.
	const CONTROL_AVAILABLE = {
		download: !isEmbedProvider,
		pip: source.type !== 'youtube' && !isAudioSource,
		fullscreen: isEmbedProvider || !isAudioSource,
	};

	// 'off' | 'muted' | 'sound' — same resolution as player/customize.js.
	const apMode = behavior.autoplayMode || (behavior.autoplay ? 'muted' : 'off');

	// Autoplay forces loadStrategy to 'eager' server-side (nothing to wait for),
	// so hover preview — which attaches to the click-to-load facade — only ever
	// has a facade to attach to when autoplay is off and loadStrategy isn't
	// already 'eager'. Source-wise it's direct-file only (self/url, not audio,
	// not an .m3u8 URL) — see attachHoverPreview() in player/mount.js.
	const hoverPreviewEligible =
		['self', 'url'].includes(source.type) &&
		!isAudioSource &&
		!/\.m3u8($|\?)/i.test(source.src || '') &&
		apMode === 'off' &&
		(behavior.loadStrategy || 'facade') !== 'eager';

	return (
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
														{s.label}{!isPro() && PRO_SKINS.includes(s.value) ? ' (Pro)' : ''}
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
										<Field label="Play button size">
											<Select value={appearance.playButtonSize} onChange={(e) => setSection('appearance', { playButtonSize: parseInt(e.target.value, 10) })}>
												<option value="0">Auto (skin default)</option>
												<option value="56">Small</option>
												<option value="72">Medium</option>
												<option value="88">Large</option>
												<option value="108">Extra large</option>
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
									{Object.keys(CONTROL_LABELS).filter((key) => CONTROL_AVAILABLE[key] !== false).map((key) => (
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
											value={apMode}
											onChange={(e) => {
												const mode = e.target.value;
												setSection('behavior', {
													autoplayMode: mode,
													// Keep the legacy boolean in sync for older readers.
													autoplay: mode !== 'off',
													// Autoplay's own mode already decides the start-muted state (see
													// player/Player.jsx) — "Start muted" only applies, and is only
													// shown, when autoplay is off. Clear it so a leftover `true`
													// can't silently mute an "On, with sound" autoplay.
													...(mode !== 'off' ? { muted: false } : {}),
												});
											}}
										>
											<option value="off">Off</option>
											<option value="muted">On, muted</option>
											<option value="sound">On, with sound</option>
										</Select>
									</Field>
									<div className='flex flex-col gap-6 mb-6'>
										{apMode === 'off' && (
											<Toggle checked={behavior.muted} onChange={(v) => setSection('behavior', { muted: v })} label="Start muted" />
										)}
										<Toggle checked={behavior.loop} onChange={(v) => setSection('behavior', { loop: v })} label="Loop" />
										<Toggle checked={behavior.resetOnEnd} onChange={(v) => setSection('behavior', { resetOnEnd: v })} label="Reset to start when finished" />
									</div>

									<div className='flex flex-col gap-6'>
										<Toggle checked={behavior.savePosition} onChange={(v) => setSection('behavior', { savePosition: v })} label="Save & resume playback position" />
										<Toggle checked={behavior.hideControls} onChange={(v) => setSection('behavior', { hideControls: v })} label="Auto-hide controls while playing" />
										<Toggle checked={behavior.sticky} onChange={(v) => setSection('behavior', { sticky: v })} label="Float player when scrolling away" />
										<Toggle checked={behavior.noSkip} onChange={(v) => setSection('behavior', { noSkip: v })} label="Prevent skipping ahead (no jumping to unwatched parts)" disabled={behavior.disableSeek} />
										<Toggle
											checked={behavior.disableSeek}
											onChange={(v) => setSection('behavior', { disableSeek: v, ...(v ? { noSkip: false } : {}) })}
											label="Disable the timeline entirely (no click or drag, forward or back)"
										/>
										{hoverPreviewEligible && (
											<Toggle checked={behavior.hoverPreview} onChange={(v) => setSection('behavior', { hoverPreview: v })} label="Muted preview on hover (self-hosted video)" />
										)}
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
												setRoot({ speeds: speeds.length ? speeds : CUSTOMIZE_DEFAULTS.speeds });
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
	);
}
