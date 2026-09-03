import { createInterpolateElement, useEffect, useState, useRef, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Card, CollapsibleCard, Button, Badge, Field, Input, Select, Textarea, Toggle } from '../components/UI';
import { Icon } from '../components/icons';
import { EndpointList } from '../components/EndpointList';
import UpsellPanel from '../components/UpsellPanel';
import { isPro, licenseStatus, licensePageUrl } from '../pro';
import { hasLicenseApi } from '../license';
import LicensePanel from './settings/LicensePanel';
import AddonsPanel from './settings/AddonsPanel';
import MediaPicker from '../components/MediaPicker';
import { PRESET_TEMPLATES, ASPECT_RATIOS } from '../data/preset-templates';
import { __, __sprintf } from '@Utils/translation';

/**
 * A mini player preview rendered in the template's own style.
 *
 * Every tile used to draw the same picture — one accent play button over one
 * progress bar — so the six looks were indistinguishable and the names carried
 * the whole explanation. Each trait below mirrors a real rule in
 * player/style.css, so the tile shows the difference and the caption states it.
 */
function TemplateCard({ template, selected, disabled, accent, onSelect }) {
	const a = template.appearance;
	const skin = a.skin;
	const playRadius = { circle: '9999px', soft: '7px', square: '2px' }[a.playButtonStyle] || '9999px';
	// Big-play sizes track the skin's own overrides (modern 84px, simple 64px).
	const playSize = skin === 'modern' ? 34 : skin === 'simple' ? 24 : 29;
	// Modern thickens the scrubber; standard squares off every one of its parts.
	const trackH = skin === 'modern' ? 5 : 3;
	const trackRadius = skin === 'standard' ? 0 : 9999;
	// How the bar meets the picture: a wash, a solid deck, a pill, or a panel
	// that lifts off the edge entirely.
	const floating = skin === 'floating';
	const minimal = skin === 'minimal';
	const barBg = floating || minimal
		? 'transparent'
		: skin === 'standard'
			? 'rgba(12,14,18,0.96)'
			: skin === 'simple'
				? 'rgba(0,0,0,0.6)'
				: 'linear-gradient(transparent, rgba(10,12,20,0.9))';

	return (
		<button
			type="button"
			onClick={() => !disabled && onSelect(template)}
			className={`text-left transition ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
		>
			<div
				className={`relative aspect-video overflow-hidden border-2 ${selected ? 'border-brand-500' : 'border-line'}`}
				style={{ borderRadius: Math.max(4, a.roundness ?? 8), background: '#111318' }}
			>
				{/* Ambient's whole point is light escaping the frame; at tile size
				    that reads as a soft accent bloom behind the picture. */}
				{skin === 'ambient' && (
					<span
						className="absolute inset-0"
						style={{ background: `radial-gradient(120% 90% at 50% 55%, ${accent}55, transparent 70%)`, filter: 'blur(6px)' }}
					/>
				)}

				<span className="absolute inset-0 flex items-center justify-center">
					<span className="flex items-center justify-center" style={{ width: playSize, height: playSize, background: accent, borderRadius: playRadius }}>
						<svg viewBox="0 0 24 24" width={Math.round(playSize * 0.42)} height={Math.round(playSize * 0.42)} fill="#fff"><path d="M8 5v14l11-7z" /></svg>
					</span>
				</span>

				<span
					className="absolute flex flex-col justify-end"
					style={ floating
						? { left: 8, right: 8, bottom: 8, borderRadius: 9, background: 'rgba(15,17,26,0.82)', boxShadow: '0 4px 14px rgba(0,0,0,0.45)', padding: '5px 7px' }
						: { left: 0, right: 0, bottom: 0, background: barBg, padding: minimal ? '0 8px 7px' : '10px 7px 6px' } }
				>
					{/* Minimal parks its controls in a rounded pill and drops the
					    time and volume readouts entirely. */}
					<span style={ minimal ? { background: 'rgba(0,0,0,0.5)', borderRadius: 7, padding: '4px 6px' } : undefined }>
						<span className="block relative" style={{ height: trackH, borderRadius: trackRadius, background: 'rgba(255,255,255,0.3)' }}>
							<span className="absolute left-0 top-0" style={{ width: '45%', height: trackH, borderRadius: trackRadius, background: accent }} />
						</span>
						{!minimal && (
							<span className="flex items-center gap-1 mt-1.5">
								<span className="block rounded-sm bg-white/70" style={{ width: 5, height: 5 }} />
								<span className="block rounded-sm bg-white/40" style={{ width: 14, height: 3 }} />
								<span className="flex-1" />
								<span className="block rounded-sm bg-white/40" style={{ width: 5, height: 5 }} />
							</span>
						)}
					</span>
				</span>

				{template.pro && <span className="absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/90 text-brand-500">{ __( 'PRO' ) }</span>}
			</div>

			<div className="flex items-center gap-1.5 mt-2">
				{selected && <Icon name="check" className="w-4 h-4 text-brand-500 shrink-0" />}
				<span className={`text-sm font-medium ${selected ? 'text-brand-500' : 'text-ink'}`}>{template.label}</span>
			</div>
			{template.description && <p className="text-xs text-muted mt-0.5 leading-snug">{template.description}</p>}
		</button>
	);
}

const NAV_GROUPS = [
	{
		label: __( 'Player' ), items: [
			{ key: 'general', label: __( 'General' ), icon: 'settings' },
			{ key: 'branding', label: __( 'Branding' ), icon: 'tag' },
			{ key: 'sources', label: __( 'Sources & CDN' ), icon: 'cloud' },
		]
	},
	{
		label: __( 'Trust & data' ), items: [
			{ key: 'enforcement', label: __( 'Enforcement' ), icon: 'shield' },
			{ key: 'compliance', label: __( 'Compliance & privacy' ), icon: 'lock' },
			{ key: 'analytics', label: __( 'Analytics' ), icon: 'analytics' },
		]
	},
	{
		label: __( 'Connect' ), items: [
			{ key: 'integrations', label: __( 'Integrations' ), icon: 'plug' },
			{ key: 'webhooks', label: __( 'Global webhooks' ), icon: 'webhook' },
			{ key: 'logs', label: __( 'Webhook logs' ), icon: 'clock' },
		]
	},
	{
		label: __( 'Account' ), items: [
			{ key: 'addons', label: __( 'Addons' ), icon: 'puzzle' },
			{ key: 'license', label: __( 'License' ), icon: 'key' },
		]
	},
];

/**
 * Push the values that were just saved back into TruePlayerGlobal.
 *
 * PHP localizes those once per page load (Assets::get_common_scripts_data), but
 * the admin is a pushState SPA — Settings, the library and the video editor all
 * live inside a single load. Without this, choosing a default player template,
 * saving, and then creating a video hands that editor the snapshot from *before*
 * the save: its Skin dropdown (and its live preview) keep showing the previous
 * template until a hard reload.
 *
 * Mirrors what PHP sends, key for key: `player_defaults` is `settings.customize`
 * (Assets::player_defaults) and `enforcement` is the enforcement section, whose
 * gaps both Helper::enforcement_defaults and sitePolicy() fill themselves.
 *
 * @param {Object} saved The settings object the save endpoint echoed back.
 */
function syncGlobalDefaults(saved) {
	const g = window.TruePlayerGlobal;
	if (!g || !saved) {
		return;
	}
	g.player_defaults = saved.customize && typeof saved.customize === 'object' ? saved.customize : {};
	g.enforcement = { ...(g.enforcement || {}), ...(saved.enforcement || {}) };
}

// Global defaults so a control is never uncontrolled before first save.
const ENFORCEMENT_DEFAULTS = { completionThreshold: 90, antiSkip: true, strict: false, maxAttempts: 3, requireLogin: false, trackGuests: true };
const COMPLIANCE_DEFAULTS = { certIssuer: '', certLogo: '', certSignature: '', certFooter: '', retentionEnabled: false, retentionDays: 365 };

// Bunny.net storage endpoints. Codes must match BunnyStorage::REGIONS in PHP —
// the server maps them to hostnames, and an unknown code falls back to default.
// Bunny names a Stream pull zone `vz-{uuid}.b-cdn.net`. Mirrors
// BunnyStorage::looks_like_stream_host() — the server makes the same call after
// an upload, this one just gets there first.
const IS_STREAM_HOST = /^vz-[0-9a-f-]+\.b-cdn\.net$/i;

const BUNNY_REGIONS = [
	{ value: '', label: __( 'Default — Falkenstein, DE' ) },
	{ value: 'ny', label: __( 'New York, US' ) },
	{ value: 'la', label: __( 'Los Angeles, US' ) },
	{ value: 'uk', label: __( 'London, UK' ) },
	{ value: 'se', label: __( 'Stockholm, SE' ) },
	{ value: 'sg', label: __( 'Singapore' ) },
	{ value: 'syd', label: __( 'Sydney, AU' ) },
	{ value: 'br', label: __( 'São Paulo, BR' ) },
	{ value: 'jh', label: __( 'Johannesburg, ZA' ) },
];

function WebhookLogs({ className }) {
	const [rows, setRows] = useState(null);
	useEffect(() => { api.getWebhookLogs(100).then(setRows).catch(() => setRows([])); }, []);
	return (
		<Card className={`overflow-hidden p-6 ${ className }`}>
			<table className="w-full text-sm">
				<thead className="bg-gray-50 text-gray-500 text-left">
					<tr><th className="px-4 py-3 font-medium">{ __( 'When' ) }</th><th className="px-4 py-3 font-medium">{ __( 'Event' ) }</th><th className="px-4 py-3 font-medium">{ __( 'Endpoint' ) }</th><th className="px-4 py-3 font-medium">{ __( 'Result' ) }</th></tr>
				</thead>
				<tbody>
					{(rows || []).map((r) => (
						<tr key={r.id} className="border-t border-gray-100">
							<td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.created}</td>
							<td className="px-4 py-3">{r.event}</td>
							<td className="px-4 py-3 text-gray-500 truncate max-w-xs">{r.url}</td>
							<td className="px-4 py-3"><Badge tone={r.ok ? 'green' : 'red'}>{r.code || __( 'error' )}</Badge>{r.error ? <span className="text-xs text-red-500 ml-2">{r.error}</span> : ''}</td>
						</tr>
					))}
					{rows && rows.length === 0 && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">{ __( 'No deliveries logged yet.' ) }</td></tr>}
					{!rows && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">{ __( 'Loading…' ) }</td></tr>}
				</tbody>
			</table>
		</Card>
	);
}

/** The address wp_mail falls back to, shown as the field's placeholder. */
function TruePlayerGlobalAdminEmail() {
	const g = window.TruePlayerGlobal || {};
	return g.admin_email || 'admin@example.com';
}

export default function Settings({ tab = 'general', onTabChange, onEditState }) {
	const [settings, setSettings] = useState(null);
	const setTab = (next) => onTabChange && onTabChange(next);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [toolbarSlot, setToolbarSlot] = useState(null);
	const loadedOnce = useRef(false);
	// Which Bunny panel is expanded. One at a time on purpose: Storage and
	// Stream each take a Bunny secret, the two look identical, and nothing
	// reports a swap until playback or an upload fails — so they are never on
	// screen together to be pasted into the wrong box. `null` means the seeding
	// effect below hasn't run yet, which is distinct from '' (all collapsed).
	const [bunnyPanel, setBunnyPanel] = useState(null);

	useEffect(() => {
		api.getSettings().then((s) => setSettings(s || {}));
		setToolbarSlot(document.getElementById('tp-topbar-slot'));
	}, []);

	// setSettings is called from ~30 individual field onChange handlers — rather
	// than touch every call site, mark dirty whenever `settings` changes after
	// the initial load (the first change is that load itself, not an edit).
	useEffect(() => {
		if (!settings) {
			return;
		}
		if (!loadedOnce.current) {
			loadedOnce.current = true;
			return;
		}
		setDirty(true);
	}, [settings]);

	// Open whichever Bunny product this site already uses, once the saved
	// settings arrive. An install with neither opens Storage — it is the one
	// people come here to set up, and a screen of closed cards hides that.
	useEffect(() => {
		if (!settings || bunnyPanel !== null) {
			return;
		}
		const st = settings.bunny?.storage || {};
		const hasStorage = !!(st.zone || st.accessKey || st.pullZone);
		setBunnyPanel(!hasStorage && settings.bunny?.tokenKey ? 'stream' : 'storage');
	}, [settings, bunnyPanel]);

	// Report dirty state up to the app shell so it can warn before navigating
	// away (Settings has no breadcrumb title/back of its own, unlike the entity
	// editors, so only `dirty` is lifted here).
	useEffect(() => { onEditState && onEditState({ dirty }); }, [dirty]);
	useEffect(() => () => onEditState && onEditState(null), []);

	const save = async () => {
		setSaving(true);
		try {
			const res = await api.saveSettings(settings);
			syncGlobalDefaults((res && res.settings) || settings);
			setDirty(false);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} finally {
			setSaving(false);
		}
	};

	if (!settings) {
		return <p className="text-gray-400">{ __( 'Loading…' ) }</p>;
	}

	// "Connected" means uploads can actually run — the same three fields
	// BunnyStorage::is_configured() checks server-side, so the badge can't claim
	// a zone is ready that the editor's upload field will then refuse.
	const bs = settings.bunny?.storage || {};
	const storageReady = !!(bs.zone && bs.accessKey && bs.pullZone);

	return (
		<>
			{ /* Save lives in the topbar (portaled) — same pattern as the video editor. */}
			{toolbarSlot && createPortal(
				<>
					{saved && <span className="inline-flex items-center gap-1 text-sm text-green-600"><Icon name="checkmark" className="w-4 h-4" /> { __( 'Saved' ) }</span>}
					<Button onClick={save} disabled={saving || !dirty}>{saving ? __( 'Saving…' ) : __( 'Save' )}</Button>
				</>,
				toolbarSlot
			)}

			<div className="mb-6">
				<h1 className="text-2xl font-bold text-gray-900">{ __( 'Settings' ) }</h1>
				<p className="text-sm text-gray-500">{ __( 'Site-wide defaults. Any single video can override these in its own editor.' ) }</p>
			</div>

			<div className="flex gap-6 items-start">
				{ /* Sticky must be on this element directly (not a nested <nav> inside a
					shrink-wrapped <aside>) — a nested sticky child has no room to stick,
					since its containing block is the short wrapper, not the tall row. */ }
				<nav className="w-60 shrink-0 sticky top-[104px] bg-white border border-line rounded-card p-2">
					{NAV_GROUPS.map((group, gi) => (
						<div key={group.label} className={gi > 0 ? 'mt-1' : ''}>
							<div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</div>
							<div className='flex flex-col gap-2'>
								{group.items.map((t) => (
									<button
										key={t.key}
										onClick={() => setTab(t.key)}
										className={`flex items-center gap-2.5 w-full px-3 py-2 rounded text-sm font-medium text-left transition-colors ${tab === t.key ? 'bg-brand-100 text-brand-500' : 'text-label hover:bg-gray-100'
											}`}
									>
										<Icon name={t.icon} className="w-[17px] h-[17px] shrink-0" />
										<span className="truncate">{t.label}</span>
									</button>
								))}
							</div>
						</div>
					))}
				</nav>
				<div className="flex-1 min-w-0">

					{tab === 'general' && (
						<div className="space-y-6">
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Default player template' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( "The look applied to every video by default. A video's own preset or settings still override it." ) }</p>
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-5 border-t border-solid border-line">
									{PRESET_TEMPLATES.map((t) => (
										<TemplateCard
											key={t.key}
											template={t}
											accent={settings.customize?.appearance?.accent || '#006BFF'}
											selected={(settings.general?.defaultTemplate || 'default') === t.key}
											disabled={t.pro && !isPro()}
											onSelect={(tpl) => setSettings((s) => ({
												...s,
												general: { ...(s.general || {}), defaultTemplate: tpl.key },
												customize: { ...(s.customize || {}), appearance: { ...(s.customize?.appearance || {}), ...tpl.appearance } },
											}))}
										/>
									))}
								</div>
							</Card>

							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Default aspect ratio' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( 'The frame shape new videos use unless overridden per video.' ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Field label={ __( 'Aspect ratio' ) } className='!mb-0'>
										<Select value={settings.customize?.appearance?.aspectRatio || '16:9'} onChange={(e) => setSettings((s) => ({ ...s, customize: { ...(s.customize || {}), appearance: { ...(s.customize?.appearance || {}), aspectRatio: e.target.value } } }))}>
											{ASPECT_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
										</Select>
									</Field>
								</div>
							</Card>

							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Custom CSS' ) }</h3>
								<p className="text-sm text-muted">
									{ createInterpolateElement(
										__( 'Injected on every page a TruePlayer player renders. Target <c>.tp-*</c> classes.' ),
										{ c: <code /> }
									) }
								</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Textarea rows={6} className="font-mono text-xs" value={settings.customize?.css || ''} onChange={(e) => setSettings((s) => ({ ...s, customize: { ...(s.customize || {}), css: e.target.value } }))} placeholder=".tp-controls { --tp-accent: #4F46E5; }" />
								</div>
							</Card>
						</div>
					)}

					{tab === 'enforcement' && (
						isPro() ? (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Enforcement defaults' ) }</h3>
								<p className="text-sm text-muted mb-4">
									{ createInterpolateElement(
										__( 'The watch-verification & gating policy applied to new videos. Any video can override these in its own <b>Questions & gating</b> tab.' ),
										{ b: <strong /> }
									) }
								</p>
								{(() => {
									const enf = { ...ENFORCEMENT_DEFAULTS, ...(settings.enforcement || {}) };
									const setEnf = (partial) => setSettings((s) => ({ ...s, enforcement: { ...ENFORCEMENT_DEFAULTS, ...(s.enforcement || {}), ...partial } }));
									return (
										<>
											<div className="grid grid-cols-2 gap-4 mt-4 pt-5 border-t border-solid border-line">
												<Field label={ __( 'Completion threshold (%)' ) } hint={ __( "Coverage required to count as 'watched'." ) }>
													<Input type="number" min="1" max="100" value={enf.completionThreshold} onChange={(e) => setEnf({ completionThreshold: parseInt(e.target.value, 10) || 0 })} />
												</Field>
												<Field label={ __( 'Max quiz attempts' ) } hint={ __( 'Before the video locks.' ) }>
													<Input type="number" min="1" value={enf.maxAttempts} onChange={(e) => setEnf({ maxAttempts: parseInt(e.target.value, 10) || 1 })} />
												</Field>
											</div>
											<Toggle className="mb-6" checked={enf.antiSkip} onChange={(v) => setEnf({ antiSkip: v })} label={ __( 'Anti-skip (block seeking past unwatched parts)' ) } />
											<Toggle className="mb-6" checked={enf.strict} onChange={(v) => setEnf({ strict: v })} label={ __( 'Must-watch (strict): force 100% coverage + anti-skip' ) } />
											<Toggle className="mb-6" checked={enf.requireLogin} onChange={(v) => setEnf({ requireLogin: v })} label={ __( 'Require login to watch (reliable per-person tracking)' ) } />
											<Toggle checked={enf.trackGuests} onChange={(v) => setEnf({ trackGuests: v })} label={ __( 'Track logged-out guests (cookie-based, best-effort)' ) } />
										</>
									);
								})()}
							</Card>
						) : (
							<UpsellPanel title={ __( 'Enforcement policy' ) } features={[ __( 'Site-wide watch-verification defaults' ), __( 'Anti-skip & must-watch (strict) mode' ), __( 'Quiz lock-on-fail & login gating' ) ]} />
						)
					)}

					{tab === 'compliance' && (
						isPro() ? (
							<div className="space-y-6">
								<Card className="p-6">
									<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Certificate branding' ) }</h3>
									<p className="text-sm text-muted mb-4">{ __( 'Shown on completion certificates & the public verification page.' ) }</p>
									{(() => {
										const c = { ...COMPLIANCE_DEFAULTS, ...(settings.compliance || {}) };
										const setC = (partial) => setSettings((s) => ({ ...s, compliance: { ...COMPLIANCE_DEFAULTS, ...(s.compliance || {}), ...partial } }));
										return (
											<div className='mt-4 pt-5 border-t border-solid border-line'>
												<Field label={ __( 'Issuer name' ) } hint={ __( 'Defaults to your site name.' ) }>
													<Input value={c.certIssuer} onChange={(e) => setC({ certIssuer: e.target.value })} placeholder={(window.TruePlayerGlobal && window.TruePlayerGlobal.site_name) || __( 'Your organization' )} />
												</Field>
												<Field label={ __( 'Logo' ) }>
													<MediaPicker value={c.certLogo} onChange={(url) => setC({ certLogo: url })} accept="image" label={ __( 'Upload a logo' ) } />
												</Field>
												<Field label={ __( 'Signature line' ) } hint={ __( 'e.g. a name / title printed under the certificate.' ) }>
													<Input value={c.certSignature} onChange={(e) => setC({ certSignature: e.target.value })} placeholder={ __( 'Jane Doe, Head of Training' ) } />
												</Field>
												<Field label={ __( 'Footer note' ) } className='!mb-0'>
													<Input value={c.certFooter} onChange={(e) => setC({ certFooter: e.target.value })} placeholder={ __( 'This certificate can be verified online.' ) } />
												</Field>
											</div>
										);
									})()}
								</Card>

								<Card className="p-6">
									<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Data retention' ) }</h3>
									<p className="text-sm text-muted mb-4">{ __( 'Automatically purge watch & quiz records older than a set age — for privacy & GDPR compliance.' ) }</p>
									{(() => {
										const c = { ...COMPLIANCE_DEFAULTS, ...(settings.compliance || {}) };
										const setC = (partial) => setSettings((s) => ({ ...s, compliance: { ...COMPLIANCE_DEFAULTS, ...(s.compliance || {}), ...partial } }));
										return (
											<div className='mt-4 pt-5 border-t border-solid border-line'>
												<Toggle checked={c.retentionEnabled} onChange={(v) => setC({ retentionEnabled: v })} label={ __( 'Auto-purge old records' ) } />
												{c.retentionEnabled ? (
													<div className="mt-6">
														<Field label={ __( 'Keep records for (days)' ) } hint={ __( 'Progress + quiz attempts past this age are deleted daily.' ) } className='!mb-0'>
															<Input type="number" min="7" value={c.retentionDays} onChange={(e) => setC({ retentionDays: parseInt(e.target.value, 10) || 0 })} />
														</Field>
													</div>
												) : null}
											</div>
										);
									})()}
								</Card>
							</div>
						) : (
							<UpsellPanel title={ __( 'Compliance & privacy' ) } features={[ __( 'White-labelled completion certificates' ), __( 'Public verification page' ), __( 'Data-retention auto-purge (GDPR)' ) ]} />
						)
					)}

					{tab === 'analytics' && (
						isPro() ? (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Analytics collection' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( 'Retention, replay heatmap & daily rollups. Turning this off keeps watch-verification working but stops aggregate data collection.' ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Toggle
										checked={settings.analytics?.enabled !== false}
										onChange={(v) => setSettings((s) => ({ ...s, analytics: { ...(s.analytics || {}), enabled: v } }))}
										label={ __( 'Collect video analytics' ) }
										className="mb-6"
									/>
									<p className="text-xs text-muted mt-2">
										{ createInterpolateElement(
											__( 'Data retention (auto-purge) is under <b>Compliance & privacy</b>.' ),
											{ b: <strong /> }
										) }
									</p>
								</div>
							</Card>
						) : (
							<UpsellPanel title={ __( 'Video analytics' ) } features={[ __( 'Audience retention & replay heatmap' ), __( 'Completion funnel & per-viewer drill-down' ), __( 'Toggle collection site-wide' ) ]} />
						)
					)}

					{tab === 'sources' && (
						<div className="space-y-6">
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'YouTube' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( 'Privacy-enhanced mode plays via youtube-nocookie.com — no cookies until a visitor presses play.' ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Toggle checked={!!settings.sources?.youtubeNoCookie} onChange={(v) => setSettings((s) => ({ ...s, sources: { ...(s.sources || {}), youtubeNoCookie: v } }))} label={ __( 'Enable privacy-enhanced mode (no-cookie)' ) } />
								</div>
							</Card>

							{isPro() ? (
								<>
									{ /* Storage before Stream: these are two different Bunny
									     products with two different secrets, and the one people
									     arrive here for is the zone they just uploaded to. Each
									     card names the product and says where in Bunny's own
									     dashboard its key lives, because a Token Authentication
									     Key and a storage password look identical and neither
									     tells you when it has been pasted into the wrong box. */ }
									<CollapsibleCard
										title={ __( 'Bunny.net Storage' ) }
										description={ __( 'Video files you upload to a storage zone and serve through a pull zone. Connect it and videos can be uploaded straight from the editor — the password stays on this server, uploads are proxied, never sent from the browser.' ) }
										badge={storageReady ? <Badge tone="green">{ __( 'Connected' ) }</Badge> : <Badge tone="gray">{ __( 'Not set up' ) }</Badge>}
										open={bunnyPanel === 'storage'}
										onToggle={() => setBunnyPanel((p) => (p === 'storage' ? '' : 'storage'))}
									>
										{(() => {
											const st = settings.bunny?.storage || {};
											const setSt = (partial) => setSettings((s) => ({ ...s, bunny: { ...(s.bunny || {}), storage: { ...((s.bunny || {}).storage || {}), ...partial } } }));
											return (
												<>
													<div className="grid grid-cols-2 gap-4">
														<Field label={ __( 'Storage zone name' ) } hint={ __( 'As it appears in your Bunny dashboard.' ) }>
															<Input value={st.zone || ''} onChange={(e) => setSt({ zone: e.target.value.trim() })} placeholder="my-videos" />
														</Field>
														<Field label={ __( 'Region' ) } hint={ __( "The zone's main storage region." ) }>
															<Select value={st.region || ''} onChange={(e) => setSt({ region: e.target.value })}>
																{BUNNY_REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
															</Select>
														</Field>
													</div>
													<Field label={ __( 'Storage password' ) } hint={ __( 'Bunny → Storage → your zone → FTP & API Access → Password. Not the same as a Token Authentication Key. Grants full access to the zone, so it is never exposed to the browser.' ) }>
														<Input type="password" value={st.accessKey || ''} onChange={(e) => setSt({ accessKey: e.target.value.trim() })} placeholder="••••••••-••••-••••" />
													</Field>
													{ /* Required, not optional: the storage host serves nothing publicly,
													     so without a pull zone an upload succeeds and yields a URL that
													     cannot be played. */ }
													<Field label={ __( 'Pull-zone hostname' ) } required hint={ __( 'Bunny → Storage → your zone → Connected pull zones. Uploads need this to produce a playable URL.' ) }>
														<Input value={st.pullZone || ''} onChange={(e) => setSt({ pullZone: e.target.value.replace(/^https?:\/\//, '').replace(/\/$/, '').trim() })} placeholder="my-videos.b-cdn.net" />
														{ /* Bunny auto-names Stream's zones `vz-{uuid}.b-cdn.net`, and that
														     one hostname is the difference between every upload playing and
														     every upload 404ing — while the upload itself succeeds either
														     way, so nothing else in the flow can catch it. */ }
														{IS_STREAM_HOST.test(st.pullZone || '') && (
															<p className="text-xs text-ink leading-5 !mt-1.5 p-2.5 rounded border border-warning/40 bg-warning-light">
																{ createInterpolateElement(
																	__( 'That is a <b>Stream</b> pull zone (Bunny names them <c>vz-…</c>). It serves a video library, not your storage zone — files uploaded here will not play from it. Use the hostname under <s>Storage → your zone → Connected pull zones</s> instead.' ),
																	{ b: <strong />, c: <code />, s: <strong /> }
																) }
															</p>
														)}
													</Field>
													<Field label={ __( 'Upload folder' ) } hint={ __( 'Folder inside the zone that uploads land in. Leave empty to use the zone root.' ) }>
														<Input value={st.folder ?? 'trueplayer'} onChange={(e) => setSt({ folder: e.target.value.replace(/^\/+|\/+$/g, '') })} placeholder="trueplayer" />
													</Field>
													<Field label={ __( 'Token Authentication Key (optional)' ) } hint={ __( 'Bunny → CDN → this storage pull zone → Security → Token Authentication Key. Only needed to sign playback of videos you mark private.' ) } className='!mb-0'>
														<Input type="password" value={st.tokenKey || ''} onChange={(e) => setSt({ tokenKey: e.target.value.trim() })} placeholder="••••••••-••••-••••" />
													</Field>
												</>
											);
										})()}
									</CollapsibleCard>

									<CollapsibleCard
										title={ __( 'Bunny.net Stream' ) }
										description={ __( "Videos hosted in a Bunny video library. Each video's own pull zone and video ID are set in its Source tab — only the signing key is site-wide." ) }
										badge={settings.bunny?.tokenKey ? <Badge tone="green">{ __( 'Key saved' ) }</Badge> : <Badge tone="gray">{ __( 'Not set up' ) }</Badge>}
										open={bunnyPanel === 'stream'}
										onToggle={() => setBunnyPanel((p) => (p === 'stream' ? '' : 'stream'))}
									>
										<Field label={ __( 'Token Authentication Key' ) } hint={ __( 'Bunny → CDN → your Stream pull zone → Security → Token Authentication Key. Only needed to sign playback of videos you mark private.' ) } className='!mb-0'>
											<Input type="password" value={settings.bunny?.tokenKey || ''} onChange={(e) => setSettings((s) => ({ ...s, bunny: { ...(s.bunny || {}), tokenKey: e.target.value.trim() } }))} placeholder="••••••••-••••-••••" />
										</Field>
									</CollapsibleCard>

									<Card className="p-6">
										<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Signed link expiry' ) }</h3>
										<p className="text-sm text-muted mb-4">{ __( 'How long a signed / private playback URL stays valid before it must be re-issued.' ) }</p>
										<div className='mt-4 pt-5 border-t border-solid border-line'>
											<Field label={ __( 'Expiry (hours)' ) } hint={ __( 'Applies to private self-hosted files and to both Bunny sources above.' ) } className='!mb-0'>
												<Input type="number" min="1" value={settings.sources?.signedUrlTtlHours || 6} onChange={(e) => setSettings((s) => ({ ...s, sources: { ...(s.sources || {}), signedUrlTtlHours: parseInt(e.target.value, 10) || 0 } }))} />
											</Field>
										</div>
									</Card>
								</>
							) : (
								<UpsellPanel title={ __( 'Private & premium sources' ) } features={[ __( 'Bunny.net token authentication' ), __( 'Signed, expiring playback URLs' ), __( 'Mux & HLS streaming' ) ]} />
							)}
						</div>
					)}

					{tab === 'integrations' && (
						<div className="space-y-6">
							{ /* Free, and first: this is the destination email capture falls back
							     to when no CRM is connected, so it must be reachable without Pro
							     — the rest of this section stays gated below. */ }
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Email notification' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( "Where captured addresses are sent when a video's email form has no CRM provider selected." ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Field label={ __( 'Send notifications to' ) } hint={ __( "Leave empty to use this site's admin email address." ) }>
										<Input
											type="email"
											value={settings.integrations?.wp_mail?.to || ''}
											onChange={(e) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), wp_mail: { ...(s.integrations?.wp_mail || {}), to: e.target.value } } }))}
											placeholder={TruePlayerGlobalAdminEmail()}
										/>
									</Field>
								</div>
							</Card>

						{ isPro() ? (
							<>
								<Card className="p-6">
									<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Mailchimp' ) }</h3>
									<p className="text-sm text-muted mb-4">{ __( 'Send in-player opt-ins to Mailchimp audiences. Paste your API key (Account → Extras → API keys).' ) }</p>
									<div className='mt-4 pt-5 border-t border-solid border-line'>
										<Field label={ __( 'Mailchimp API key' ) } hint={ __( 'Looks like abc123…-us21. Stored on your site only.' ) }>
											<Input
												type="password"
												value={settings.integrations?.mailchimp?.api_key || ''}
												onChange={(e) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), mailchimp: { ...(s.integrations?.mailchimp || {}), api_key: e.target.value } } }))}
												placeholder="xxxxxxxxxxxxxxxx-us21"
											/>
										</Field>
										<p className="text-xs text-muted">{ __( 'Once saved, Mailchimp audiences appear in each video’s Subscribe tab.' ) }</p>
									</div>
								</Card>

								<Card className="p-6">
									<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Google Analytics' ) }</h3>
									<p className="text-sm text-muted mb-4">{ __( 'Send player events (video_start, video_complete) to GA4. Uses your existing site tag, or loads one from a measurement ID.' ) }</p>
									<div className='mt-4 pt-5 border-t border-solid border-line'>
										<Toggle
											checked={!!settings.integrations?.ga?.enabled}
											onChange={(v) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), ga: { ...(s.integrations?.ga || {}), enabled: v } } }))}
											label={ __( 'Send player events to Google Analytics' ) }
										/>
										{settings.integrations?.ga?.enabled ? (
											<div className="mt-6">
												<Field label={ __( 'Measurement ID' ) } hint={ __( "Optional — leave blank to use the site's existing GA tag." ) } className="!mb-0">
													<Input value={settings.integrations?.ga?.measurementId || ''} onChange={(e) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), ga: { ...(s.integrations?.ga || {}), measurementId: e.target.value.trim() } } }))} placeholder="G-XXXXXXXXXX" />
												</Field>
											</div>
										) : null}
									</div>
								</Card>
							</>
						) : (
							<UpsellPanel title={ __( 'CRM & email integrations' ) } features={[ __( 'Mailchimp audiences' ), __( 'Google Analytics events' ), __( 'GemCRM / FluentCRM opt-in capture' ) ]} />
						)}
						</div>
					)}

					{tab === 'branding' && (
						(() => {
							const app = settings.customize?.appearance || {};
							const setApp = (partial) => setSettings((s) => ({ ...s, customize: { ...(s.customize || {}), appearance: { ...(s.customize?.appearance || {}), ...partial } } }));
							const brand = settings.branding || {};
							const setBrand = (partial) => setSettings((s) => ({ ...s, branding: { ...(s.branding || {}), ...partial } }));
							return (
								<div className="space-y-6">
									<Card className="p-6">
										<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Brand colors' ) }</h3>
										<p className="text-sm text-muted mb-4">{ __( 'The default accent for the scrubber, buttons & highlights. Any video or preset can override it.' ) }</p>
										<div className="grid grid-cols-2 gap-4 mt-4 pt-5 border-t border-solid border-line">
											<Field label={ __( 'Accent color' ) }>
												<div className="flex gap-2 items-center">
													<input type="color" value={app.accent || '#006BFF'} onChange={(e) => setApp({ accent: e.target.value })} className="h-10 w-12 rounded border border-line" />
													<Input value={app.accent || ''} onChange={(e) => setApp({ accent: e.target.value })} placeholder="#006BFF" />
												</div>
											</Field>
											<Field label={ __( 'Button hover color' ) } hint={ __( 'Optional.' ) }>
												<div className="flex gap-2 items-center">
													<input type="color" value={app.hoverColor || '#ffffff'} onChange={(e) => setApp({ hoverColor: e.target.value })} className="h-10 w-12 rounded border border-line" />
													<Input value={app.hoverColor || ''} onChange={(e) => setApp({ hoverColor: e.target.value })} placeholder={ __( '(none)' ) } />
												</div>
											</Field>
										</div>
									</Card>

									<Card className="p-6">
										<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Player logo' ) }</h3>
										<p className="text-sm text-muted">{ __( 'A watermark logo shown on every player by default.' ) }</p>
										<div className='mt-4 pt-5 border-t border-solid border-line'>
											{ /* Upload-only: a pasted URL was never the point of a logo
											     field, and MediaPicker shows what you actually picked. */ }
											<Field label={ __( 'Logo image' ) } className='!mb-0'>
												<MediaPicker value={brand.logo || ''} onChange={(url) => setBrand({ logo: url })} accept="image" label={ __( 'Upload a logo' ) } />
											</Field>
											{brand.logo && (
												<div className="grid grid-cols-2 gap-4">
													<Field label={ __( 'Position' ) }>
														<Select value={brand.logoPosition || 'top-right'} onChange={(e) => setBrand({ logoPosition: e.target.value })}>
															<option value="top-left">{ __( 'Top left' ) }</option>
															<option value="top-right">{ __( 'Top right' ) }</option>
															<option value="bottom-left">{ __( 'Bottom left' ) }</option>
															<option value="bottom-right">{ __( 'Bottom right' ) }</option>
														</Select>
													</Field>
													<Field label={ __sprintf( 'Opacity (%d%%)', Math.round( ( brand.logoOpacity ?? 0.9 ) * 100 ) ) }>
														<input type="range" min="10" max="100" step="5" value={Math.round((brand.logoOpacity ?? 0.9) * 100)} onChange={(e) => setBrand({ logoOpacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
													</Field>
													<div className="col-span-2">
														<Field label={ __( 'Click-through link' ) } hint={ __( 'Optional — makes the logo clickable.' ) }>
															<Input value={brand.logoUrl || ''} onChange={(e) => setBrand({ logoUrl: e.target.value })} placeholder="https://your-site.com" />
														</Field>
													</div>
												</div>
											)}
										</div>
									</Card>

									<Card className="p-6">
										<div className="flex items-center gap-2 !mb-1">
											<h3 className="font-semibold text-gray-900">{ __( 'White-label' ) }</h3>
											{!isPro() && <Badge tone="gray">{ __( 'Pro' ) }</Badge>}
										</div>
										<p className="text-sm text-muted mb-4">{ __( 'Replace the TruePlayer name across the admin and hide the player attribution.' ) }</p>
										<div className='mt-4 pt-5 border-t border-solid border-line'>
											{isPro() ? (
												<>
													<Toggle
														checked={!!settings.whiteLabel?.enabled}
														onChange={(v) => setSettings((s) => ({ ...s, whiteLabel: { ...(s.whiteLabel || {}), enabled: v } }))}
														label={ __( 'Enable white-label' ) }
														className="mb-6"
													/>
													{settings.whiteLabel?.enabled && (
														<>
															<Field label={ __( 'Brand name' ) } hint={ __( 'Shown in the admin menu & titles.' ) }>
																<Input
																	value={settings.whiteLabel?.brand || ''}
																	onChange={(e) => setSettings((s) => ({ ...s, whiteLabel: { ...(s.whiteLabel || {}), brand: e.target.value } }))}
																	placeholder={ __( 'Acme Video' ) }
																/>
															</Field>
															{ /* The mark that goes with the name — without it a rebranded
															     install still showed TruePlayer's play glyph beside the
															     owner's own name in the WP menu and the admin header. */ }
															<Field label={ __( 'Brand logo' ) } hint={ __( 'Square works best (used at 20px in the WordPress menu). Leave empty to keep the default mark.' ) }>
																<MediaPicker
																	value={settings.whiteLabel?.logo || ''}
																	onChange={(url) => setSettings((s) => ({ ...s, whiteLabel: { ...(s.whiteLabel || {}), logo: url } }))}
																	accept="image"
																	label={ __( 'Upload a mark' ) }
																/>
															</Field>
														</>
													)}
													<p className="text-xs text-muted mt-2">{ __( 'Takes effect on the next page load after saving.' ) }</p>
												</>
											) : (
												<p className="text-sm text-muted">{ __( 'Upgrade to TruePlayer Pro to rebrand the admin and remove player attribution.' ) }</p>
											)}
										</div>
									</Card>
								</div>
							);
						})()
					)}

					{tab === 'logs' && (
						isPro() ? <WebhookLogs /> : <UpsellPanel title={ __( 'Webhook delivery logs' ) } features={[ __( 'Every delivery attempt recorded' ), __( 'See failures & status codes' ) ]} />
					)}

					{tab === 'webhooks' && (
						isPro() ? (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Global webhooks' ) }</h3>
								<p className="text-sm text-gray-500">{ __( 'Fire for every video, in addition to per-video webhooks.' ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<EndpointList
										endpoints={settings.webhooks || []}
										onChange={(webhooks) => setSettings((s) => ({ ...s, webhooks }))}
									/>
								</div>
							</Card>
						) : (
							<UpsellPanel title={ __( 'Automation & webhooks' ) } features={[ __( 'Signed webhooks on every player event' ), __( 'Site-wide + per-video endpoints' ) ]} />
						)
					)}

					{tab === 'addons' && <AddonsPanel />}

					{ /* With Pro active and a store product configured, the SDK's REST
					     routes are reachable and this tab is the real activation
					     screen. Without them there is nothing to activate, so it
					     falls back to stating where things stand. */ }
					{tab === 'license' && hasLicenseApi() && <LicensePanel />}

					{tab === 'license' && !hasLicenseApi() && (
						(() => {
							// Two independent facts, and this card used to conflate them:
							// the Pro plugin being active, and a license key being
							// activated. Pro runs on a permissive default before a store
							// is configured, so "Pro active" must not be reported as
							// "your license is valid".
							const status = licenseStatus();
							const url = licensePageUrl();
							return (
								<Card className="p-6">
									<div className="flex items-center gap-3 mb-2">
										<h3 className="font-semibold text-gray-900">{ __( 'License' ) }</h3>
										{!isPro() && <Badge tone="gray">{ __( 'Free' ) }</Badge>}
										{isPro() && <Badge tone="brand">{ __( 'Pro plugin active' ) }</Badge>}
										{isPro() && status === 'active' && <Badge tone="green">{ __( 'License activated' ) }</Badge>}
										{isPro() && status === 'inactive' && <Badge tone="amber">{ __( 'License not activated' ) }</Badge>}
									</div>
									{!isPro() && (
										<p className="text-sm text-gray-500">
											{ createInterpolateElement(
												__( 'You’re on the free player. Install <b>TruePlayer Pro</b> and activate a license to unlock watch-verification, quiz-gating, analytics, automation, premium sources and playlists.' ),
												{ b: <strong /> }
											) }
										</p>
									)}
									{isPro() && status === 'active' && (
										<p className="text-sm text-gray-500">{ __( 'TruePlayer Pro is active and your license key is valid.' ) }</p>
									)}
									{isPro() && status === 'inactive' && (
										<p className="text-sm text-gray-500">
											{ __( 'TruePlayer Pro is running and every feature is available. Activating a license adds automatic updates and priority support — it doesn’t unlock anything.' ) }
										</p>
									)}
									{isPro() && status === 'unconfigured' && (
										<p className="text-sm text-gray-500">
											{ __( 'TruePlayer Pro is active. This build has no license server configured, so there’s no key to activate.' ) }
										</p>
									)}
									{url && status !== 'unconfigured' && (
										<div className="mt-4">
											<Button variant="ghost" onClick={() => { window.location.href = url; }}>
												{status === 'active' ? __( 'Manage license' ) : __( 'Activate license' )}
											</Button>
										</div>
									)}
								</Card>
							);
						})()
					)}
				</div>
			</div>
		</>
	);
}
