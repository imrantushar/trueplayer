import { useEffect, useState, useRef, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Badge, Field, Input, Select, Textarea, Toggle } from '../components/UI';
import { Icon } from '../components/icons';
import { EndpointList } from '../components/EndpointList';
import UpsellPanel from '../components/UpsellPanel';
import { isPro, licenseStatus, licensePageUrl } from '../pro';
import { hasLicenseApi } from '../license';
import LicensePanel from './settings/LicensePanel';
import AddonsPanel from './settings/AddonsPanel';
import { pickMedia } from '../utils/media';
import { PRESET_TEMPLATES, ASPECT_RATIOS } from '../data/preset-templates';

// A mini player preview rendered in the template's style.
function TemplateCard({ template, selected, disabled, accent, onSelect }) {
	const a = template.appearance;
	const barStyle = { gradient: 'bg-gradient-to-t from-black/70 to-transparent', solid: 'bg-black/70', minimal: 'bg-transparent' }[a.controlBarStyle] || 'bg-black/70';
	const playRadius = { circle: '9999px', soft: '8px', square: '3px' }[a.playButtonStyle] || '9999px';
	return (
		<button
			type="button"
			onClick={() => !disabled && onSelect(template)}
			className={`text-left transition ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
		>
			<div
				className={`relative aspect-video overflow-hidden border-2 ${selected ? 'border-brand-500' : 'border-line'}`}
				style={{ borderRadius: 8, background: '#111318' }}
			>
				<span className="absolute inset-0 flex items-center justify-center">
					<span className="flex items-center justify-center w-8 h-8" style={{ background: accent, borderRadius: playRadius }}>
						<svg viewBox="0 0 24 24" width="13" height="13" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
					</span>
				</span>
				<span className={`absolute left-0 right-0 bottom-0 h-6 ${barStyle}`}>
					<span className="absolute left-2 right-2 bottom-2 h-1 rounded-full bg-white/30">
						<span className="absolute left-0 top-0 h-1 rounded-full" style={{ width: '45%', background: accent }} />
					</span>
				</span>
				{template.pro && <span className="absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/90 text-brand-500">PRO</span>}
			</div>
			<div className="flex items-center gap-1.5 mt-2">
				{selected && <Icon name="check" className="w-4 h-4 text-brand-500" />}
				<span className={`text-sm font-medium ${selected ? 'text-brand-500' : 'text-ink'}`}>{template.label}</span>
			</div>
		</button>
	);
}

const NAV_GROUPS = [
	{
		label: 'Player', items: [
			{ key: 'general', label: 'General', icon: 'settings' },
			{ key: 'branding', label: 'Branding', icon: 'tag' },
			{ key: 'sources', label: 'Sources & CDN', icon: 'cloud' },
		]
	},
	{
		label: 'Trust & data', items: [
			{ key: 'enforcement', label: 'Enforcement', icon: 'shield' },
			{ key: 'compliance', label: 'Compliance & privacy', icon: 'lock' },
			{ key: 'analytics', label: 'Analytics', icon: 'analytics' },
		]
	},
	{
		label: 'Connect', items: [
			{ key: 'integrations', label: 'Integrations', icon: 'plug' },
			{ key: 'webhooks', label: 'Global webhooks', icon: 'webhook' },
			{ key: 'logs', label: 'Webhook logs', icon: 'clock' },
		]
	},
	{
		label: 'Account', items: [
			{ key: 'addons', label: 'Addons', icon: 'puzzle' },
			{ key: 'license', label: 'License', icon: 'key' },
		]
	},
];

// Global defaults so a control is never uncontrolled before first save.
const ENFORCEMENT_DEFAULTS = { completionThreshold: 90, antiSkip: true, strict: false, maxAttempts: 3, requireLogin: false, trackGuests: true };
const COMPLIANCE_DEFAULTS = { certIssuer: '', certLogo: '', certSignature: '', certFooter: '', retentionEnabled: false, retentionDays: 365 };

function WebhookLogs({ className }) {
	const [rows, setRows] = useState(null);
	useEffect(() => { api.getWebhookLogs(100).then(setRows).catch(() => setRows([])); }, []);
	return (
		<Card className={`overflow-hidden p-6 ${ className }`}>
			<table className="w-full text-sm">
				<thead className="bg-gray-50 text-gray-500 text-left">
					<tr><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Event</th><th className="px-4 py-3 font-medium">Endpoint</th><th className="px-4 py-3 font-medium">Result</th></tr>
				</thead>
				<tbody>
					{(rows || []).map((r) => (
						<tr key={r.id} className="border-t border-gray-100">
							<td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.created}</td>
							<td className="px-4 py-3">{r.event}</td>
							<td className="px-4 py-3 text-gray-500 truncate max-w-xs">{r.url}</td>
							<td className="px-4 py-3"><Badge tone={r.ok ? 'green' : 'red'}>{r.code || 'error'}</Badge>{r.error ? <span className="text-xs text-red-500 ml-2">{r.error}</span> : ''}</td>
						</tr>
					))}
					{rows && rows.length === 0 && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">No deliveries logged yet.</td></tr>}
					{!rows && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
				</tbody>
			</table>
		</Card>
	);
}

export default function Settings({ tab = 'general', onTabChange, onEditState }) {
	const [settings, setSettings] = useState(null);
	const setTab = (next) => onTabChange && onTabChange(next);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [toolbarSlot, setToolbarSlot] = useState(null);
	const loadedOnce = useRef(false);

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

	// Report dirty state up to the app shell so it can warn before navigating
	// away (Settings has no breadcrumb title/back of its own, unlike the entity
	// editors, so only `dirty` is lifted here).
	useEffect(() => { onEditState && onEditState({ dirty }); }, [dirty]);
	useEffect(() => () => onEditState && onEditState(null), []);

	const save = async () => {
		setSaving(true);
		try {
			await api.saveSettings(settings);
			setDirty(false);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} finally {
			setSaving(false);
		}
	};

	if (!settings) {
		return <p className="text-gray-400">Loading…</p>;
	}

	return (
		<>
			{ /* Save lives in the topbar (portaled) — same pattern as the video editor. */}
			{toolbarSlot && createPortal(
				<>
					{saved && <span className="inline-flex items-center gap-1 text-sm text-green-600"><Icon name="checkmark" className="w-4 h-4" /> Saved</span>}
					<Button onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</Button>
				</>,
				toolbarSlot
			)}

			<div className="mb-6">
				<h1 className="text-2xl font-bold text-gray-900">Settings</h1>
				<p className="text-sm text-gray-500">Site-wide defaults. Any single video can override these in its own editor.</p>
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
								<h3 className="font-semibold text-gray-900 !mb-1">Default player template</h3>
								<p className="text-sm text-muted mb-4">The look applied to every video by default. A video's own preset or settings still override it.</p>
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
								<h3 className="font-semibold text-gray-900 !mb-1">Default aspect ratio</h3>
								<p className="text-sm text-muted mb-4">The frame shape new videos use unless overridden per video.</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Field label="Aspect ratio" className='!mb-0'>
										<Select value={settings.customize?.appearance?.aspectRatio || '16:9'} onChange={(e) => setSettings((s) => ({ ...s, customize: { ...(s.customize || {}), appearance: { ...(s.customize?.appearance || {}), aspectRatio: e.target.value } } }))}>
											{ASPECT_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
										</Select>
									</Field>
								</div>
							</Card>

							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">Custom CSS</h3>
								<p className="text-sm text-muted">Injected on every page a TruePlayer player renders. Target <code>.tp-*</code> classes.</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Textarea rows={6} className="font-mono text-xs" value={settings.customize?.css || ''} onChange={(e) => setSettings((s) => ({ ...s, customize: { ...(s.customize || {}), css: e.target.value } }))} placeholder=".tp-controls { --tp-accent: #4F46E5; }" />
								</div>
							</Card>
						</div>
					)}

					{tab === 'enforcement' && (
						isPro() ? (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">Enforcement defaults</h3>
								<p className="text-sm text-muted mb-4">The watch-verification &amp; gating policy applied to new videos. Any video can override these in its own <strong>Questions &amp; gating</strong> tab.</p>
								{(() => {
									const enf = { ...ENFORCEMENT_DEFAULTS, ...(settings.enforcement || {}) };
									const setEnf = (partial) => setSettings((s) => ({ ...s, enforcement: { ...ENFORCEMENT_DEFAULTS, ...(s.enforcement || {}), ...partial } }));
									return (
										<>
											<div className="grid grid-cols-2 gap-4 mt-4 pt-5 border-t border-solid border-line">
												<Field label="Completion threshold (%)" hint="Coverage required to count as 'watched'.">
													<Input type="number" min="1" max="100" value={enf.completionThreshold} onChange={(e) => setEnf({ completionThreshold: parseInt(e.target.value, 10) || 0 })} />
												</Field>
												<Field label="Max quiz attempts" hint="Before the video locks.">
													<Input type="number" min="1" value={enf.maxAttempts} onChange={(e) => setEnf({ maxAttempts: parseInt(e.target.value, 10) || 1 })} />
												</Field>
											</div>
											<Toggle className="mb-6" checked={enf.antiSkip} onChange={(v) => setEnf({ antiSkip: v })} label="Anti-skip (block seeking past unwatched parts)" />
											<Toggle className="mb-6" checked={enf.strict} onChange={(v) => setEnf({ strict: v })} label="Must-watch (strict): force 100% coverage + anti-skip" />
											<Toggle className="mb-6" checked={enf.requireLogin} onChange={(v) => setEnf({ requireLogin: v })} label="Require login to watch (reliable per-person tracking)" />
											<Toggle checked={enf.trackGuests} onChange={(v) => setEnf({ trackGuests: v })} label="Track logged-out guests (cookie-based, best-effort)" />
										</>
									);
								})()}
							</Card>
						) : (
							<UpsellPanel onNavigate={() => setTab('license')} title="Enforcement policy" features={['Site-wide watch-verification defaults', 'Anti-skip & must-watch (strict) mode', 'Quiz lock-on-fail & login gating']} />
						)
					)}

					{tab === 'compliance' && (
						isPro() ? (
							<div className="space-y-6">
								<Card className="p-6">
									<h3 className="font-semibold text-gray-900 !mb-1">Certificate branding</h3>
									<p className="text-sm text-muted mb-4">Shown on completion certificates &amp; the public verification page.</p>
									{(() => {
										const c = { ...COMPLIANCE_DEFAULTS, ...(settings.compliance || {}) };
										const setC = (partial) => setSettings((s) => ({ ...s, compliance: { ...COMPLIANCE_DEFAULTS, ...(s.compliance || {}), ...partial } }));
										return (
											<div className='mt-4 pt-5 border-t border-solid border-line'>
												<Field label="Issuer name" hint="Defaults to your site name.">
													<Input value={c.certIssuer} onChange={(e) => setC({ certIssuer: e.target.value })} placeholder={(window.TruePlayerGlobal && window.TruePlayerGlobal.site_name) || 'Your organization'} />
												</Field>
												<Field label="Logo URL">
													<Input value={c.certLogo} onChange={(e) => setC({ certLogo: e.target.value })} placeholder="https://…/logo.png" />
												</Field>
												<Field label="Signature line" hint="e.g. a name / title printed under the certificate.">
													<Input value={c.certSignature} onChange={(e) => setC({ certSignature: e.target.value })} placeholder="Jane Doe, Head of Training" />
												</Field>
												<Field label="Footer note" className='!mb-0'>
													<Input value={c.certFooter} onChange={(e) => setC({ certFooter: e.target.value })} placeholder="This certificate can be verified online." />
												</Field>
											</div>
										);
									})()}
								</Card>

								<Card className="p-6">
									<h3 className="font-semibold text-gray-900 !mb-1">Data retention</h3>
									<p className="text-sm text-muted mb-4">Automatically purge watch &amp; quiz records older than a set age — for privacy &amp; GDPR compliance.</p>
									{(() => {
										const c = { ...COMPLIANCE_DEFAULTS, ...(settings.compliance || {}) };
										const setC = (partial) => setSettings((s) => ({ ...s, compliance: { ...COMPLIANCE_DEFAULTS, ...(s.compliance || {}), ...partial } }));
										return (
											<div className='mt-4 pt-5 border-t border-solid border-line'>
												<Toggle checked={c.retentionEnabled} onChange={(v) => setC({ retentionEnabled: v })} label="Auto-purge old records" />
												{c.retentionEnabled ? (
													<div className="mt-6">
														<Field label="Keep records for (days)" hint="Progress + quiz attempts past this age are deleted daily." className='!mb-0'>
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
							<UpsellPanel onNavigate={() => setTab('license')} title="Compliance &amp; privacy" features={['White-labelled completion certificates', 'Public verification page', 'Data-retention auto-purge (GDPR)']} />
						)
					)}

					{tab === 'analytics' && (
						isPro() ? (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">Analytics collection</h3>
								<p className="text-sm text-muted mb-4">Retention, replay heatmap &amp; daily rollups. Turning this off keeps watch-verification working but stops aggregate data collection.</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Toggle
										checked={settings.analytics?.enabled !== false}
										onChange={(v) => setSettings((s) => ({ ...s, analytics: { ...(s.analytics || {}), enabled: v } }))}
										label="Collect video analytics"
										className="mb-6"
									/>
									<p className="text-xs text-muted mt-2">Data retention (auto-purge) is under <strong>Compliance &amp; privacy</strong>.</p>
								</div>
							</Card>
						) : (
							<UpsellPanel onNavigate={() => setTab('license')} title="Video analytics" features={['Audience retention & replay heatmap', 'Completion funnel & per-viewer drill-down', 'Toggle collection site-wide']} />
						)
					)}

					{tab === 'sources' && (
						<div className="space-y-6">
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">YouTube</h3>
								<p className="text-sm text-muted mb-4">Privacy-enhanced mode plays via youtube-nocookie.com — no cookies until a visitor presses play.</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Toggle checked={!!settings.sources?.youtubeNoCookie} onChange={(v) => setSettings((s) => ({ ...s, sources: { ...(s.sources || {}), youtubeNoCookie: v } }))} label="Enable privacy-enhanced mode (no-cookie)" />
								</div>
							</Card>

							{isPro() ? (
								<>
									<Card className="p-6">
										<h3 className="font-semibold text-gray-900 !mb-1">Bunny.net token authentication</h3>
										<p className="text-sm text-muted mb-4">For <strong>private</strong> Bunny videos: enable Token Authentication on your pull zone, then paste its key. TruePlayer signs expiring playback URLs.</p>
										<div className='mt-4 pt-5 border-t border-solid border-line'>
											<Field label="Token Authentication Key" className='!mb-0'>
												<Input type="password" value={settings.bunny?.tokenKey || ''} onChange={(e) => setSettings((s) => ({ ...s, bunny: { ...(s.bunny || {}), tokenKey: e.target.value } }))} placeholder="••••••••-••••-••••" />
											</Field>
										</div>
									</Card>
									<Card className="p-6">
										<h3 className="font-semibold text-gray-900 !mb-1">Signed link expiry</h3>
										<p className="text-sm text-muted mb-4">How long a signed / private playback URL stays valid before it must be re-issued.</p>
										<div className='mt-4 pt-5 border-t border-solid border-line'>
											<Field label="Expiry (hours)" hint="Applies to private self-hosted files and Bunny token links." className='!mb-0'>
												<Input type="number" min="1" value={settings.sources?.signedUrlTtlHours || 6} onChange={(e) => setSettings((s) => ({ ...s, sources: { ...(s.sources || {}), signedUrlTtlHours: parseInt(e.target.value, 10) || 0 } }))} />
											</Field>
										</div>
									</Card>
								</>
							) : (
								<UpsellPanel onNavigate={() => setTab('license')} title="Private &amp; premium sources" features={['Bunny.net token authentication', 'Signed, expiring playback URLs', 'Mux & HLS streaming']} />
							)}
						</div>
					)}

					{tab === 'integrations' && (
						isPro() ? (
							<div className="space-y-6">
								<Card className="p-6">
									<h3 className="font-semibold text-gray-900 !mb-1">Mailchimp</h3>
									<p className="text-sm text-muted mb-4">Send in-player opt-ins to Mailchimp audiences. Paste your API key (Account → Extras → API keys).</p>
									<div className='mt-4 pt-5 border-t border-solid border-line'>
										<Field label="Mailchimp API key" hint="Looks like abc123…-us21. Stored on your site only.">
											<Input
												type="password"
												value={settings.integrations?.mailchimp?.api_key || ''}
												onChange={(e) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), mailchimp: { ...(s.integrations?.mailchimp || {}), api_key: e.target.value } } }))}
												placeholder="xxxxxxxxxxxxxxxx-us21"
											/>
										</Field>
										<p className="text-xs text-muted">Once saved, Mailchimp audiences appear in each video’s Subscribe tab.</p>
									</div>
								</Card>

								<Card className="p-6">
									<h3 className="font-semibold text-gray-900 !mb-1">Google Analytics</h3>
									<p className="text-sm text-muted mb-4">Send player events (video_start, video_complete) to GA4. Uses your existing site tag, or loads one from a measurement ID.</p>
									<div className='mt-4 pt-5 border-t border-solid border-line'>
										<Toggle
											checked={!!settings.integrations?.ga?.enabled}
											onChange={(v) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), ga: { ...(s.integrations?.ga || {}), enabled: v } } }))}
											label="Send player events to Google Analytics"
										/>
										{settings.integrations?.ga?.enabled ? (
											<div className="mt-6">
												<Field label="Measurement ID" hint="Optional — leave blank to use the site's existing GA tag." className="!mb-0">
													<Input value={settings.integrations?.ga?.measurementId || ''} onChange={(e) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), ga: { ...(s.integrations?.ga || {}), measurementId: e.target.value.trim() } } }))} placeholder="G-XXXXXXXXXX" />
												</Field>
											</div>
										) : null}
									</div>
								</Card>
							</div>
						) : (
							<UpsellPanel onNavigate={() => setTab('license')} title="CRM &amp; email integrations" features={['Mailchimp audiences', 'Google Analytics events', 'GemCRM / FluentCRM opt-in capture']} />
						)
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
										<h3 className="font-semibold text-gray-900 !mb-1">Brand colors</h3>
										<p className="text-sm text-muted mb-4">The default accent for the scrubber, buttons &amp; highlights. Any video or preset can override it.</p>
										<div className="grid grid-cols-2 gap-4 mt-4 pt-5 border-t border-solid border-line">
											<Field label="Accent color">
												<div className="flex gap-2 items-center">
													<input type="color" value={app.accent || '#006BFF'} onChange={(e) => setApp({ accent: e.target.value })} className="h-10 w-12 rounded border border-line" />
													<Input value={app.accent || ''} onChange={(e) => setApp({ accent: e.target.value })} placeholder="#006BFF" />
												</div>
											</Field>
											<Field label="Button hover color" hint="Optional.">
												<div className="flex gap-2 items-center">
													<input type="color" value={app.hoverColor || '#ffffff'} onChange={(e) => setApp({ hoverColor: e.target.value })} className="h-10 w-12 rounded border border-line" />
													<Input value={app.hoverColor || ''} onChange={(e) => setApp({ hoverColor: e.target.value })} placeholder="(none)" />
												</div>
											</Field>
										</div>
									</Card>

									<Card className="p-6">
										<h3 className="font-semibold text-gray-900 !mb-1">Player logo</h3>
										<p className="text-sm text-muted">A watermark logo shown on every player by default.</p>
										<div className='mt-4 pt-5 border-t border-solid border-line'>
											<Field label="Logo image" className='!mb-0'>
												<div className="flex gap-2">
													<Input value={brand.logo || ''} onChange={(e) => setBrand({ logo: e.target.value })} placeholder="https://…/logo.png" />
													<Button variant="ghost" onClick={() => pickMedia('image', (url) => setBrand({ logo: url }))}>Media library</Button>
												</div>
											</Field>
											{brand.logo && (
												<div className="grid grid-cols-2 gap-4">
													<Field label="Position">
														<Select value={brand.logoPosition || 'top-right'} onChange={(e) => setBrand({ logoPosition: e.target.value })}>
															<option value="top-left">Top left</option>
															<option value="top-right">Top right</option>
															<option value="bottom-left">Bottom left</option>
															<option value="bottom-right">Bottom right</option>
														</Select>
													</Field>
													<Field label={`Opacity (${Math.round((brand.logoOpacity ?? 0.9) * 100)}%)`}>
														<input type="range" min="10" max="100" step="5" value={Math.round((brand.logoOpacity ?? 0.9) * 100)} onChange={(e) => setBrand({ logoOpacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
													</Field>
													<div className="col-span-2">
														<Field label="Click-through link" hint="Optional — makes the logo clickable.">
															<Input value={brand.logoUrl || ''} onChange={(e) => setBrand({ logoUrl: e.target.value })} placeholder="https://your-site.com" />
														</Field>
													</div>
												</div>
											)}
										</div>
									</Card>

									<Card className="p-6">
										<div className="flex items-center gap-2 !mb-1">
											<h3 className="font-semibold text-gray-900">White-label</h3>
											{!isPro() && <Badge tone="gray">Pro</Badge>}
										</div>
										<p className="text-sm text-muted mb-4">Replace the TruePlayer name across the admin and hide the player attribution.</p>
										<div className='mt-4 pt-5 border-t border-solid border-line'>
											{isPro() ? (
												<>
													<Toggle
														checked={!!settings.whiteLabel?.enabled}
														onChange={(v) => setSettings((s) => ({ ...s, whiteLabel: { ...(s.whiteLabel || {}), enabled: v } }))}
														label="Enable white-label"
														className="mb-6"
													/>
													{settings.whiteLabel?.enabled && (
														<>
															<Field label="Brand name" hint="Shown in the admin menu &amp; titles.">
																<Input
																	value={settings.whiteLabel?.brand || ''}
																	onChange={(e) => setSettings((s) => ({ ...s, whiteLabel: { ...(s.whiteLabel || {}), brand: e.target.value } }))}
																	placeholder="Acme Video"
																/>
															</Field>
															{ /* The mark that goes with the name — without it a rebranded
															     install still showed TruePlayer's play glyph beside the
															     owner's own name in the WP menu and the admin header. */ }
															<Field label="Brand logo" hint="Square works best (used at 20px in the WordPress menu). Leave empty to keep the default mark.">
																<div className="flex gap-2">
																	<Input
																		value={settings.whiteLabel?.logo || ''}
																		onChange={(e) => setSettings((s) => ({ ...s, whiteLabel: { ...(s.whiteLabel || {}), logo: e.target.value } }))}
																		placeholder="https://…/mark.svg"
																	/>
																	<Button variant="ghost" onClick={() => pickMedia('image', (url) => setSettings((s) => ({ ...s, whiteLabel: { ...(s.whiteLabel || {}), logo: url } })))}>Media library</Button>
																</div>
															</Field>
															{settings.whiteLabel?.logo && (
																<div className="flex items-center gap-3 -mt-2 mb-4">
																	<span className="inline-flex items-center justify-center w-8 h-8 rounded bg-gray-900 p-1">
																		<img src={settings.whiteLabel.logo} alt="" className="max-w-full max-h-full" />
																	</span>
																	<Button variant="clear" size="sm" onClick={() => setSettings((s) => ({ ...s, whiteLabel: { ...(s.whiteLabel || {}), logo: '' } }))}>Remove</Button>
																</div>
															)}
														</>
													)}
													<p className="text-xs text-muted mt-2">Takes effect on the next page load after saving.</p>
												</>
											) : (
												<p className="text-sm text-muted">Upgrade to TruePlayer Pro to rebrand the admin and remove player attribution.</p>
											)}
										</div>
									</Card>
								</div>
							);
						})()
					)}

					{tab === 'logs' && (
						isPro() ? <WebhookLogs /> : <UpsellPanel onNavigate={() => setTab('license')} title="Webhook delivery logs" features={['Every delivery attempt recorded', 'See failures &amp; status codes']} />
					)}

					{tab === 'webhooks' && (
						isPro() ? (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">Global webhooks</h3>
								<p className="text-sm text-gray-500">Fire for every video, in addition to per-video webhooks.</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<EndpointList
										endpoints={settings.webhooks || []}
										onChange={(webhooks) => setSettings((s) => ({ ...s, webhooks }))}
									/>
								</div>
							</Card>
						) : (
							<UpsellPanel onNavigate={() => setTab('license')} title="Automation & webhooks" features={['Signed webhooks on every player event', 'Site-wide + per-video endpoints']} />
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
										<h3 className="font-semibold text-gray-900">License</h3>
										{!isPro() && <Badge tone="gray">Free</Badge>}
										{isPro() && <Badge tone="brand">Pro plugin active</Badge>}
										{isPro() && status === 'active' && <Badge tone="green">License activated</Badge>}
										{isPro() && status === 'inactive' && <Badge tone="amber">License not activated</Badge>}
									</div>
									{!isPro() && (
										<p className="text-sm text-gray-500">
											You’re on the free player. Install <strong>TruePlayer Pro</strong> and activate a license to unlock watch-verification, quiz-gating, analytics, automation, premium sources and playlists.
										</p>
									)}
									{isPro() && status === 'active' && (
										<p className="text-sm text-gray-500">TruePlayer Pro is active and your license key is valid.</p>
									)}
									{isPro() && status === 'inactive' && (
										<p className="text-sm text-gray-500">
											TruePlayer Pro is running, but no license key has been activated — you won’t get automatic updates or support until one is.
										</p>
									)}
									{isPro() && status === 'unconfigured' && (
										<p className="text-sm text-gray-500">
											TruePlayer Pro is active. This build has no license server configured, so there’s no key to activate.
										</p>
									)}
									{url && status !== 'unconfigured' && (
										<div className="mt-4">
											<Button variant="ghost" onClick={() => { window.location.href = url; }}>
												{status === 'active' ? 'Manage license' : 'Activate license'}
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
