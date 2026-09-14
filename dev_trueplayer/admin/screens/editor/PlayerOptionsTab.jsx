import { Card, Field, Input, Select, Toggle, Textarea, ColorInput } from '../../components/UI';
import { isPro, PRO_SKINS, PRO_AUDIO_LAYOUTS } from '../../pro';
import { resolveCustomize, CUSTOMIZE_DEFAULTS } from '@Player/customize';
import { availableControls } from '@Utils/controls';
import { isAudioSource as isAudioSourceUtil } from '@Utils/audio';
import { templatesFor, applyTemplateToBlob } from '../../data/preset-templates';
import { createInterpolateElement } from '@wordpress/element';
import { __, __sprintf } from '@Utils/translation';

// Player sub-sections. Exported so the editor's left-nav accordion (Editor.jsx)
// can drive which one is shown — this tab renders the active section only.
export const PLAYER_SUBS = [
	['appearance', __( 'Appearance' )],
	['captions', __( 'Captions' )],
	['controls', __( 'Controls' )],
	['behavior', __( 'Behaviour' )],
	['playback', __( 'Playback' )],
	['css', __( 'Custom CSS' )],
];

const SKINS = [
	{ value: 'default', label: __( 'Default' ) },
	{ value: 'modern', label: __( 'Modern' ) },
	{ value: 'simple', label: __( 'Simple' ) },
	{ value: 'minimal', label: __( 'Minimal' ) },
	{ value: 'standard', label: __( 'Standard' ) },
	{ value: 'floating', label: __( 'Floating' ) },
	{ value: 'ambient', label: __( 'Ambient' ) },
];

// The audio player's skins. Same control, same word and same slot as the video
// Skin dropdown above — an author configuring two players should not have to
// learn that one of them calls its look a "layout".
//
// Stored under `appearance.audioLayout`, not `appearance.skin`: the two lists
// share no values, `skin` is video-only by declaration (VIDEO_ONLY_APPEARANCE
// in player/customize.js) and Player.jsx refuses `ambient` for audio outright.
// Merging the keys would undo that separation to save a word. So the KEY stays
// what it has always been — every stored config keeps working — and only the
// vocabulary in front of the author changes.
//
// Each entry is a real block at the end of player/style.css.
const AUDIO_SKINS = [
	{ value: 'compact', label: __( 'Compact' ), hint: __( 'A single bar: cover art, title and controls in one row.' ) },
	{ value: 'card', label: __( 'Card' ), hint: __( 'Large square cover art above the title and controls.' ) },
	{ value: 'minimal', label: __( 'Minimal' ), hint: __( 'Play button and a waveform, nothing else.' ) },
	{ value: 'podcast', label: __( 'Podcast' ), hint: __( 'A taller bar with large cover art and room for the episode title.' ) },
	{ value: 'audiobook', label: __( 'Audiobook' ), hint: __( 'The transport centred and enlarged for hours of listening.' ) },
];

const ASPECT_RATIOS = [
	{ value: '16:9', label: __( '16:9 (widescreen)' ) },
	{ value: '9:16', label: __( '9:16 (vertical)' ) },
	{ value: '4:3', label: __( '4:3 (classic)' ) },
	{ value: '1:1', label: __( '1:1 (square)' ) },
	{ value: '21:9', label: __( '21:9 (cinematic)' ) },
	{ value: 'auto', label: __( 'Auto (native)' ) },
];

export default function PlayerOptionsTab({ config, patch, presets = [], sub = 'appearance', mediaType = null, offerTemplates = false }) {
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
	// `mediaType` is passed explicitly when there is no source to read from — a
	// preset's config has none, so its type must be told, not inferred.
	// Otherwise: detected, not just declared, so an .mp3 that nobody ticked the
	// audio-only box for is configured with the audio control set here, matching
	// what the player will actually render for it.
	const isAudioSource = mediaType ? 'audio' === mediaType : isAudioSourceUtil(source);

	// Which control-bar buttons can ever do anything here. The registry knows
	// which controls a media type may offer and which source types make one
	// inert, so we don't offer a toggle whose button would never render.
	const offeredControls = availableControls({
		mediaType: isAudioSource ? 'audio' : 'video',
		sourceType: source.type,
	});

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
								<h3 className="font-semibold text-gray-900">{ __( 'Appearance' ) }</h3>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									{/* Preset builder only — `offerTemplates` is passed by
									    Presets.jsx and by nothing else.
									
									    A template is a STARTING POINT, and a preset is the thing
									    the plugin already has for "a named look I reuse". Offering
									    templates on a single media item as well put the same
									    decision on two screens and quietly changed what it meant:
									    on a preset it seeds something reusable, on one item it
									    stamps a copy that then stops following the preset or the
									    site default at all. One home for it, and this is the one.
									
									    An action, not a stored choice — which is why it is a row
									    of buttons and not a dropdown with a selected value. A
									    template is a bundle of ordinary fields (Skin, the control
									    bar, roundness, and for audio the controls and the skip
									    length); once applied, those fields are the truth and any
									    of them can be changed. A control claiming the preset still
									    "is" Audiobook after you switched its skips off would be
									    lying.
									
									    No tiles here, unlike Settings: the live preview is on
									    screen beside this, so a thumbnail of the result would be
									    a worse copy of something the author can already see. */}
									{offerTemplates && (
									<Field
										label={ __( 'Start from a template' ) }
										hint={ __( 'Applies a complete look in one click. Every field below stays editable afterwards.' ) }
									>
										<div className="flex flex-wrap gap-2">
											{templatesFor(isAudioSource ? 'audio' : 'video').map((t) => {
												const locked = t.pro && ! isPro();
												return (
													<button
														key={t.key}
														type="button"
														disabled={locked}
														title={t.description || ''}
														// Replaces the keys a template owns rather than
														// merging over them — same rule as the Settings
														// picker, and the same helper, so "Playlist" means
														// Playlist here too and not Playlist wearing
														// whatever the last template left behind.
														onClick={() => patch({ customize: applyTemplateToBlob(config.customize, t, isAudioSource ? 'audio' : 'video') })}
														className={`px-3 py-1.5 rounded border border-solid text-[13px] font-medium transition-colors ${
															locked
																? 'border-line bg-gray-50 text-muted opacity-60 cursor-not-allowed'
																: 'border-line bg-white text-ink hover:border-brand-400 hover:text-brand-500 cursor-pointer'
														}`}
													>
														{t.label}
														{locked && <span className="ml-1 text-[9px] font-semibold text-brand-500">{ __( 'PRO' ) }</span>}
													</button>
												);
											})}
										</div>
									</Field>
									)}

									{presets.some((p) => ('audio' === p.type) === isAudioSource) && (
										<Field label={ __( 'Preset' ) } hint={ __( 'Apply a saved player preset as the starting point — you can still tweak anything below.' ) }>
											<Select
												value={config.presetId || ''}
												onChange={(e) => patch({ presetId: e.target.value ? parseInt(e.target.value, 10) : undefined })}
											>
												<option value="">{ __( 'None' ) }</option>
												{/* Only presets for this kind of player: an audio preset carries
												    no skin or aspect ratio, and a video preset's mean nothing
												    for a bar. */}
												{presets
													.filter((p) => ('audio' === p.type) === isAudioSource)
													.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
											</Select>
										</Field>
									)}
									<div className="grid md:grid-cols-2 gap-x-6">
										{/* A skin is a treatment of the picture — the bar fading over it, the
										    glow behind it. None of that exists in an audio bar, and `ambient`
										    is already refused outright by Player.jsx. */}
										{!isAudioSource && (
											<Field label={ __( 'Skin' ) } hint={isPro() ? __( 'Overall player theme.' ) : __( 'Floating & Ambient need TruePlayer Pro.' )}>
												<Select value={appearance.skin} onChange={(e) => setSection('appearance', { skin: e.target.value })}>
													{SKINS.map((s) => (
														<option key={s.value} value={s.value} disabled={!isPro() && PRO_SKINS.includes(s.value)}>
															{s.label}{!isPro() && PRO_SKINS.includes(s.value) ? __( ' (Pro)' ) : ''}
														</option>
													))}
												</Select>
											</Field>
										)}
										{/* Audio has no picture to shape, and Player.jsx skips the
										    aspect-ratio style for it entirely — so the slot shows the
										    one dimension that IS meaningful for a bar instead of a
										    field that would silently do nothing. */}
										{isAudioSource ? (
											<Field
												label={ __( 'Skin' ) }
												hint={ isPro()
													? ( AUDIO_SKINS.find( ( l ) => l.value === appearance.audioLayout ) || AUDIO_SKINS[ 0 ] ).hint
													: __( 'Podcast & Audiobook need TruePlayer Pro.' ) }
											>
												<Select value={appearance.audioLayout} onChange={(e) => setSection('appearance', { audioLayout: e.target.value })}>
													{AUDIO_SKINS.map((l) => (
														<option key={l.value} value={l.value} disabled={!isPro() && PRO_AUDIO_LAYOUTS.includes(l.value)}>
															{l.label}{!isPro() && PRO_AUDIO_LAYOUTS.includes(l.value) ? __( ' (Pro)' ) : ''}
														</option>
													))}
												</Select>
											</Field>
										) : (
											<Field label={ __( 'Aspect ratio' ) } hint={ __( '9:16 for vertical / Shorts-style video.' ) }>
												<Select value={appearance.aspectRatio} onChange={(e) => setSection('appearance', { aspectRatio: e.target.value })}>
													{ASPECT_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
												</Select>
											</Field>
										)}
										<Field label={ __( 'Accent color' ) } hint={ __( 'Scrubber, buttons, highlights.' ) }>
											<ColorInput value={appearance.accent} onChange={(v) => setSection('appearance', { accent: v })} />
										</Field>
										<Field label={ __( 'Button hover color' ) } hint={ __( 'Optional; default is a light overlay.' ) }>
											<ColorInput value={appearance.hoverColor} onChange={(v) => setSection('appearance', { hoverColor: v })} placeholder={ __( '(none)' ) } />
										</Field>
										{/* The centre play button is painted over the picture and Player.jsx
										    already suppresses it for audio. */}
										{!isAudioSource && (
											<Field label={ __( 'Play button style' ) }>
												<Select value={appearance.playButtonStyle} onChange={(e) => setSection('appearance', { playButtonStyle: e.target.value })}>
													<option value="circle">{ __( 'Circle' ) }</option>
													<option value="soft">{ __( 'Soft (rounded)' ) }</option>
													<option value="square">{ __( 'Square' ) }</option>
												</Select>
											</Field>
										)}
										{/* Same — no centre play button on an audio bar. */}
										{!isAudioSource && (
											<Field label={ __( 'Play button size' ) }>
												<Select value={appearance.playButtonSize} onChange={(e) => setSection('appearance', { playButtonSize: parseInt(e.target.value, 10) })}>
													<option value="0">{ __( 'Auto (skin default)' ) }</option>
													<option value="56">{ __( 'Small' ) }</option>
													<option value="72">{ __( 'Medium' ) }</option>
													<option value="88">{ __( 'Large' ) }</option>
													<option value="108">{ __( 'Extra large' ) }</option>
												</Select>
											</Field>
										)}
										<Field label={ __( 'Control bar style' ) }>
											<Select value={appearance.controlBarStyle} onChange={(e) => setSection('appearance', { controlBarStyle: e.target.value })}>
												<option value="gradient">{ __( 'Gradient' ) }</option>
												<option value="solid">{ __( 'Solid' ) }</option>
												<option value="minimal">{ __( 'Minimal' ) }</option>
											</Select>
										</Field>
										<Field label={ __sprintf( 'Corner roundness (%dpx)', appearance.roundness ) }>
											<input type="range" min="0" max="28" value={appearance.roundness} onChange={(e) => setSection('appearance', { roundness: parseInt(e.target.value, 10) })} className="w-full accent-brand-500 cursor-pointer" />
										</Field>
									</div>
									{/* Player.jsx never renders BigPlay for audio, so the toggle
									    would be a switch with nothing on the other end. */}
									{!isAudioSource && (
										<Toggle checked={appearance.bigPlay} onChange={(v) => setSection('appearance', { bigPlay: v })} label={ __( 'Show large center play button' ) } />
									)}
								</div>
							</Card>
						)}

						{sub === 'captions' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Subtitle style' ) }</h3>
								<p className="text-sm text-gray-500">{ __( 'How captions render on self-hosted / HLS video. YouTube & Vimeo embeds style their own.' ) }</p>
								<div className="grid md:grid-cols-2 gap-x-6 mt-4 pt-5 border-t border-solid border-line">
									<Field label={ __sprintf( 'Font size (%d%%)', appearance.captionSize ) }>
										<input type="range" min="50" max="200" step="10" value={appearance.captionSize} onChange={(e) => setSection('appearance', { captionSize: parseInt(e.target.value, 10) })} className="w-full accent-brand-500 cursor-pointer" />
									</Field>
									<Field label={ __( 'Text color' ) }>
										<ColorInput value={appearance.captionColor} onChange={(v) => setSection('appearance', { captionColor: v })} />
									</Field>
									<Field label={ __( 'Background color' ) }>
										<ColorInput value={appearance.captionBackground} onChange={(v) => setSection('appearance', { captionBackground: v })} />
									</Field>
									<Field label={ __sprintf( 'Background opacity (%d%%)', appearance.captionOpacity ) }>
										<input type="range" min="0" max="100" step="5" value={appearance.captionOpacity} onChange={(e) => setSection('appearance', { captionOpacity: parseInt(e.target.value, 10) })} className="w-full accent-brand-500 cursor-pointer" />
									</Field>
								</div>
							</Card>

						)}

						{sub === 'controls' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Controls' ) }</h3>
								<p className="text-sm text-gray-500">{ __( 'Show or hide each control in the bar.' ) }</p>
								<div className="grid md:grid-cols-2 gap-6 mt-4 pt-5 border-t border-solid border-line">
									{offeredControls.map((c) => (
										<Toggle key={c.key} checked={controls[c.key]} onChange={(v) => setSection('controls', { [c.key]: v })} label={c.label} />
									))}
								</div>
							</Card>

						)}

						{sub === 'behavior' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 mb-4">{ __( 'Behavior' ) }</h3>
								<div className="grid gap-x-6 mt-4 pt-5 border-t border-solid border-line">
									<Field label={ __( 'Autoplay' ) } hint={ __( '“With sound” falls back to muted when the browser blocks it.' ) }>
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
											<option value="off">{ __( 'Off' ) }</option>
											<option value="muted">{ __( 'On, muted' ) }</option>
											<option value="sound">{ __( 'On, with sound' ) }</option>
										</Select>
									</Field>
									<div className='flex flex-col gap-6 mb-6'>
										{apMode === 'off' && (
											<Toggle checked={behavior.muted} onChange={(v) => setSection('behavior', { muted: v })} label={ __( 'Start muted' ) } />
										)}
										<Toggle checked={behavior.loop} onChange={(v) => setSection('behavior', { loop: v })} label={ __( 'Loop' ) } />
										<Toggle
											checked={behavior.resetOnEnd && !behavior.loop}
											disabled={behavior.loop}
											onChange={(v) => setSection('behavior', { resetOnEnd: v })}
											label={<>{ __( 'Reset to start when finished' ) }{behavior.loop && <em className="block not-italic text-[11px] text-gray-400 mt-0.5">{ __( 'Loop already restarts the video, and keeps it playing.' ) }</em>}</>}
										/>
									</div>

									<div className='flex flex-col gap-6'>
										<Toggle checked={behavior.savePosition} onChange={(v) => setSection('behavior', { savePosition: v })} label={ __( 'Save & resume playback position' ) } />
										<Toggle checked={behavior.hideControls} onChange={(v) => setSection('behavior', { hideControls: v })} label={ __( 'Auto-hide controls while playing' ) } />
										<Toggle
											checked={behavior.sticky}
											onChange={(v) => setSection('behavior', { sticky: v })}
											label={<>{ __( 'Float player when scrolling away' ) }{<em className="block not-italic text-[11px] text-gray-400 mt-0.5">{ __( 'Test on a real page — the preview is scaled, so it can’t float.' ) }</em>}</>}
										/>
										<Toggle
											checked={behavior.noSkip}
											disabled={behavior.disableSeek}
											onChange={(v) => setSection('behavior', { noSkip: v })}
											label={<>{ __( 'Prevent skipping ahead (no jumping to unwatched parts)' ) }{<em className="block not-italic text-[11px] text-gray-400 mt-0.5">{ __( 'Test on a real page — the preview stays scrubbable on purpose.' ) }</em>}</>}
										/>
										<Toggle
											checked={behavior.disableSeek}
											onChange={(v) => setSection('behavior', { disableSeek: v, ...(v ? { noSkip: false } : {}) })}
											label={ __( 'Disable the timeline entirely (no click or drag, forward or back)' ) }
										/>
										{hoverPreviewEligible && (
											<Toggle
												checked={behavior.hoverPreview}
												onChange={(v) => setSection('behavior', { hoverPreview: v })}
												label={<>{ __( 'Muted preview on hover (self-hosted video)' ) }{<em className="block not-italic text-[11px] text-gray-400 mt-0.5">{ __( 'Test on a real page — it needs the click-to-load poster.' ) }</em>}</>}
											/>
										)}
									</div>
								</div>
								<div className="grid md:grid-cols-2 gap-x-6 mt-6">
									{behavior.sticky && (
										<Field label={ __( 'Float position' ) }>
											<Select value={behavior.stickyPosition} onChange={(e) => setSection('behavior', { stickyPosition: e.target.value })}>
												<option value="bottom-right">{ __( 'Bottom right' ) }</option>
												<option value="bottom-left">{ __( 'Bottom left' ) }</option>
												<option value="top-right">{ __( 'Top right' ) }</option>
												<option value="top-left">{ __( 'Top left' ) }</option>
											</Select>
										</Field>
									)}
									<Field label={ __( 'Preload' ) } hint={ __( 'How much to load before play.' ) }>
										<Select value={behavior.preload} onChange={(e) => setSection('behavior', { preload: e.target.value })}>
											<option value="metadata">{ __( 'Metadata only' ) }</option>
											<option value="auto">{ __( 'Auto (full)' ) }</option>
											<option value="none">{ __( 'None' ) }</option>
										</Select>
									</Field>
									<Field label={ __( 'Load strategy' ) } hint={ __( 'When the player boots — keeps below-the-fold pages fast.' ) }>
										<Select value={behavior.loadStrategy || 'facade'} onChange={(e) => setSection('behavior', { loadStrategy: e.target.value })}>
											<option value="facade">{ __( 'On click (poster until played)' ) }</option>
											<option value="onvisible">{ __( 'When scrolled into view' ) }</option>
											<option value="eager">{ __( 'Immediately on page load' ) }</option>
										</Select>
									</Field>
								</div>
							</Card>

						)}

						{sub === 'playback' && (
							<Card className="p-6 max-w-2xl">
								<h3 className="font-semibold text-gray-900 mb-4">{ __( 'Playback' ) }</h3>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Field label={ __( 'Playback speeds' ) } hint={ __( 'Comma-separated, e.g. 0.5, 1, 1.5, 2' ) }>
										<Input
											value={cz.speeds.join(', ')}
											onChange={(e) => {
												const speeds = e.target.value.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n) && n > 0);
												setRoot({ speeds: speeds.length ? speeds : CUSTOMIZE_DEFAULTS.speeds });
											}}
										/>
									</Field>
									<Field label={ __( 'Skip interval (seconds)' ) } hint={ __( 'Rewind / fast-forward + arrow keys.' ) }>
										<Input type="number" min="1" max="60" className="w-28" value={cz.skipSeconds} onChange={(e) => setRoot({ skipSeconds: parseInt(e.target.value, 10) || 10 })} />
									</Field>
								</div>
							</Card>

						)}

						{sub === 'css' && (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Custom CSS' ) }</h3>
								<p className="text-sm text-gray-500 mb-4">
									{ createInterpolateElement(
										__( 'Printed with this player on the frontend. Scope rules with <mount>.trueplayer-mount</mount> (all players) or <stage>.tp-stage</stage>.' ),
										{
											mount: <code className="text-xs bg-gray-100 px-1 rounded" />,
											stage: <code className="text-xs bg-gray-100 px-1 rounded" />,
										}
									) }
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
