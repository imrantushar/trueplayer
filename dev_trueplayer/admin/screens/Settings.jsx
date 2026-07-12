import { useEffect, useState } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Badge, Field, Input, Select, Textarea, Toggle } from '../components/UI';
import { EndpointList } from '../components/EndpointList';
import UpsellPanel from '../components/UpsellPanel';
import { isPro } from '../pro';
import PlayerOptionsTab from './editor/PlayerOptionsTab';

const SUBTABS = [
	{ key: 'defaults', label: 'Player defaults' },
	{ key: 'general', label: 'General' },
	{ key: 'enforcement', label: 'Enforcement' },
	{ key: 'compliance', label: 'Compliance & privacy' },
	{ key: 'analytics', label: 'Analytics' },
	{ key: 'sources', label: 'Sources & CDN' },
	{ key: 'integrations', label: 'Integrations' },
	{ key: 'whitelabel', label: 'White-label' },
	{ key: 'webhooks', label: 'Global webhooks' },
	{ key: 'logs', label: 'Webhook logs' },
	{ key: 'license', label: 'License' },
];

// Global defaults so a control is never uncontrolled before first save.
const ENFORCEMENT_DEFAULTS = { completionThreshold: 90, antiSkip: true, strict: false, maxAttempts: 3, requireLogin: false, trackGuests: true };
const COMPLIANCE_DEFAULTS = { certIssuer: '', certLogo: '', certSignature: '', certFooter: '', retentionEnabled: false, retentionDays: 365 };

function WebhookLogs() {
	const [ rows, setRows ] = useState( null );
	useEffect( () => { api.getWebhookLogs( 100 ).then( setRows ).catch( () => setRows( [] ) ); }, [] );
	return (
		<Card className="overflow-hidden">
			<table className="w-full text-sm">
				<thead className="bg-gray-50 text-gray-500 text-left">
					<tr><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Event</th><th className="px-4 py-3 font-medium">Endpoint</th><th className="px-4 py-3 font-medium">Result</th></tr>
				</thead>
				<tbody>
					{ ( rows || [] ).map( ( r ) => (
						<tr key={ r.id } className="border-t border-gray-100">
							<td className="px-4 py-3 text-gray-500 whitespace-nowrap">{ r.created }</td>
							<td className="px-4 py-3">{ r.event }</td>
							<td className="px-4 py-3 text-gray-500 truncate max-w-xs">{ r.url }</td>
							<td className="px-4 py-3"><Badge tone={ r.ok ? 'green' : 'red' }>{ r.code || 'error' }</Badge>{ r.error ? <span className="text-xs text-red-500 ml-2">{ r.error }</span> : '' }</td>
						</tr>
					) ) }
					{ rows && rows.length === 0 && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">No deliveries logged yet.</td></tr> }
					{ ! rows && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">Loading…</td></tr> }
				</tbody>
			</table>
		</Card>
	);
}

export default function Settings() {
	const [ settings, setSettings ] = useState( null );
	const [ tab, setTab ] = useState( 'defaults' );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ presets, setPresets ] = useState( [] );

	useEffect( () => {
		api.getSettings().then( ( s ) => setSettings( s || {} ) );
		api.listPresets().then( ( p ) => setPresets( p || [] ) );
	}, [] );

	const save = async () => {
		setSaving( true );
		try {
			await api.saveSettings( settings );
			setSaved( true );
			setTimeout( () => setSaved( false ), 2000 );
		} finally {
			setSaving( false );
		}
	};

	if ( ! settings ) {
		return <p className="text-gray-400">Loading…</p>;
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Settings</h1>
					<p className="text-sm text-gray-500">Site-wide defaults. Any single video can override these in its own editor.</p>
				</div>
				<div className="flex items-center gap-3">
					{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
					<Button onClick={ save } disabled={ saving }>{ saving ? 'Saving…' : 'Save' }</Button>
				</div>
			</div>

			<div className="flex gap-6 items-start">
				<aside className="w-52 shrink-0">
					<nav className="space-y-1 sticky top-6">
						{ SUBTABS.map( ( t ) => (
							<button
								key={ t.key }
								onClick={ () => setTab( t.key ) }
								className={ `flex w-full px-3 py-2 rounded text-sm font-medium text-left transition-colors ${
									tab === t.key ? 'bg-brand-100 text-brand-500' : 'text-label hover:bg-gray-100'
								}` }
							>
								{ t.label }
							</button>
						) ) }
					</nav>
				</aside>

				<div className="flex-1 min-w-0">

			{ tab === 'defaults' && (
				<>
					<p className="text-sm text-gray-500 mb-4">
						These apply to every video by default. A video's own <strong>Player options</strong> tab overrides them.
					</p>
					<PlayerOptionsTab
						config={ { customize: settings.customize || {} } }
						patch={ ( partial ) => setSettings( ( s ) => ( { ...s, ...partial } ) ) }
					/>
				</>
			) }

			{ tab === 'general' && (
				<div className="max-w-xl space-y-6">
					<Card className="p-6">
						<h3 className="font-semibold text-gray-900 mb-1">Default preset</h3>
						<p className="text-sm text-muted mb-4">Applied to any video that doesn't pick its own preset.</p>
						<Field label="Default preset">
							<Select value={ settings.general?.defaultPreset || '' } onChange={ ( e ) => setSettings( ( s ) => ( { ...s, general: { ...( s.general || {} ), defaultPreset: e.target.value ? parseInt( e.target.value, 10 ) : 0 } } ) ) }>
								<option value="">— none —</option>
								{ presets.map( ( p ) => <option key={ p.id } value={ p.id }>{ p.title }</option> ) }
							</Select>
						</Field>
					</Card>
					<Card className="p-6">
						<h3 className="font-semibold text-gray-900 mb-1">Custom CSS</h3>
						<p className="text-sm text-muted mb-4">Injected on every page a TruePlayer player renders. Target <code>.tp-*</code> classes.</p>
						<Textarea rows={ 6 } className="font-mono text-xs" value={ settings.customize?.css || '' } onChange={ ( e ) => setSettings( ( s ) => ( { ...s, customize: { ...( s.customize || {} ), css: e.target.value } } ) ) } placeholder=".tp-controls { --tp-accent: #4F46E5; }" />
					</Card>
				</div>
			) }

			{ tab === 'enforcement' && (
				isPro() ? (
					<Card className="p-6 max-w-xl">
						<h3 className="font-semibold text-gray-900 mb-1">Enforcement defaults</h3>
						<p className="text-sm text-muted mb-4">The watch-verification &amp; gating policy applied to new videos. Any video can override these in its own <strong>Questions &amp; gating</strong> tab.</p>
						{ ( () => {
							const enf = { ...ENFORCEMENT_DEFAULTS, ...( settings.enforcement || {} ) };
							const setEnf = ( partial ) => setSettings( ( s ) => ( { ...s, enforcement: { ...ENFORCEMENT_DEFAULTS, ...( s.enforcement || {} ), ...partial } } ) );
							return (
								<>
									<div className="grid grid-cols-2 gap-4">
										<Field label="Completion threshold (%)" hint="Coverage required to count as 'watched'.">
											<Input type="number" min="1" max="100" value={ enf.completionThreshold } onChange={ ( e ) => setEnf( { completionThreshold: parseInt( e.target.value, 10 ) || 0 } ) } />
										</Field>
										<Field label="Max quiz attempts" hint="Before the video locks.">
											<Input type="number" min="1" value={ enf.maxAttempts } onChange={ ( e ) => setEnf( { maxAttempts: parseInt( e.target.value, 10 ) || 1 } ) } />
										</Field>
									</div>
									<Toggle checked={ enf.antiSkip } onChange={ ( v ) => setEnf( { antiSkip: v } ) } label="Anti-skip (block seeking past unwatched parts)" />
									<Toggle checked={ enf.strict } onChange={ ( v ) => setEnf( { strict: v } ) } label="Must-watch (strict): force 100% coverage + anti-skip" />
									<Toggle checked={ enf.requireLogin } onChange={ ( v ) => setEnf( { requireLogin: v } ) } label="Require login to watch (reliable per-person tracking)" />
									<Toggle checked={ enf.trackGuests } onChange={ ( v ) => setEnf( { trackGuests: v } ) } label="Track logged-out guests (cookie-based, best-effort)" />
								</>
							);
						} )() }
					</Card>
				) : (
					<UpsellPanel title="Enforcement policy" features={ [ 'Site-wide watch-verification defaults', 'Anti-skip & must-watch (strict) mode', 'Quiz lock-on-fail & login gating' ] } />
				)
			) }

			{ tab === 'compliance' && (
				isPro() ? (
					<div className="max-w-xl space-y-6">
						<Card className="p-6">
							<h3 className="font-semibold text-gray-900 mb-1">Certificate branding</h3>
							<p className="text-sm text-muted mb-4">Shown on completion certificates &amp; the public verification page.</p>
							{ ( () => {
								const c = { ...COMPLIANCE_DEFAULTS, ...( settings.compliance || {} ) };
								const setC = ( partial ) => setSettings( ( s ) => ( { ...s, compliance: { ...COMPLIANCE_DEFAULTS, ...( s.compliance || {} ), ...partial } } ) );
								return (
									<>
										<Field label="Issuer name" hint="Defaults to your site name.">
											<Input value={ c.certIssuer } onChange={ ( e ) => setC( { certIssuer: e.target.value } ) } placeholder={ ( window.TruePlayerGlobal && window.TruePlayerGlobal.site_name ) || 'Your organization' } />
										</Field>
										<Field label="Logo URL">
											<Input value={ c.certLogo } onChange={ ( e ) => setC( { certLogo: e.target.value } ) } placeholder="https://…/logo.png" />
										</Field>
										<Field label="Signature line" hint="e.g. a name / title printed under the certificate.">
											<Input value={ c.certSignature } onChange={ ( e ) => setC( { certSignature: e.target.value } ) } placeholder="Jane Doe, Head of Training" />
										</Field>
										<Field label="Footer note">
											<Input value={ c.certFooter } onChange={ ( e ) => setC( { certFooter: e.target.value } ) } placeholder="This certificate can be verified online." />
										</Field>
									</>
								);
							} )() }
						</Card>

						<Card className="p-6">
							<h3 className="font-semibold text-gray-900 mb-1">Data retention</h3>
							<p className="text-sm text-muted mb-4">Automatically purge watch &amp; quiz records older than a set age — for privacy &amp; GDPR compliance.</p>
							{ ( () => {
								const c = { ...COMPLIANCE_DEFAULTS, ...( settings.compliance || {} ) };
								const setC = ( partial ) => setSettings( ( s ) => ( { ...s, compliance: { ...COMPLIANCE_DEFAULTS, ...( s.compliance || {} ), ...partial } } ) );
								return (
									<>
										<Toggle checked={ c.retentionEnabled } onChange={ ( v ) => setC( { retentionEnabled: v } ) } label="Auto-purge old records" />
										{ c.retentionEnabled && (
											<Field label="Keep records for (days)" hint="Progress + quiz attempts past this age are deleted daily.">
												<Input type="number" min="7" value={ c.retentionDays } onChange={ ( e ) => setC( { retentionDays: parseInt( e.target.value, 10 ) || 0 } ) } />
											</Field>
										) }
									</>
								);
							} )() }
						</Card>
					</div>
				) : (
					<UpsellPanel title="Compliance &amp; privacy" features={ [ 'White-labelled completion certificates', 'Public verification page', 'Data-retention auto-purge (GDPR)' ] } />
				)
			) }

			{ tab === 'analytics' && (
				isPro() ? (
					<Card className="p-6 max-w-xl">
						<h3 className="font-semibold text-gray-900 mb-1">Analytics collection</h3>
						<p className="text-sm text-muted mb-4">Retention, replay heatmap &amp; daily rollups. Turning this off keeps watch-verification working but stops aggregate data collection.</p>
						<Toggle
							checked={ settings.analytics?.enabled !== false }
							onChange={ ( v ) => setSettings( ( s ) => ( { ...s, analytics: { ...( s.analytics || {} ), enabled: v } } ) ) }
							label="Collect video analytics"
						/>
						<p className="text-xs text-muted mt-2">Data retention (auto-purge) is under <strong>Compliance &amp; privacy</strong>.</p>
					</Card>
				) : (
					<UpsellPanel title="Video analytics" features={ [ 'Audience retention & replay heatmap', 'Completion funnel & per-viewer drill-down', 'Toggle collection site-wide' ] } />
				)
			) }

			{ tab === 'sources' && (
				<div className="max-w-xl space-y-6">
					<Card className="p-6">
						<h3 className="font-semibold text-gray-900 mb-1">YouTube</h3>
						<p className="text-sm text-muted mb-4">Privacy-enhanced mode plays via youtube-nocookie.com — no cookies until a visitor presses play.</p>
						<Toggle checked={ !! settings.sources?.youtubeNoCookie } onChange={ ( v ) => setSettings( ( s ) => ( { ...s, sources: { ...( s.sources || {} ), youtubeNoCookie: v } } ) ) } label="Enable privacy-enhanced mode (no-cookie)" />
					</Card>

					{ isPro() ? (
						<>
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 mb-1">Bunny.net token authentication</h3>
								<p className="text-sm text-muted mb-4">For <strong>private</strong> Bunny videos: enable Token Authentication on your pull zone, then paste its key. TruePlayer signs expiring playback URLs.</p>
								<Field label="Token Authentication Key">
									<Input type="password" value={ settings.bunny?.tokenKey || '' } onChange={ ( e ) => setSettings( ( s ) => ( { ...s, bunny: { ...( s.bunny || {} ), tokenKey: e.target.value } } ) ) } placeholder="••••••••-••••-••••" />
								</Field>
							</Card>
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 mb-1">Signed link expiry</h3>
								<p className="text-sm text-muted mb-4">How long a signed / private playback URL stays valid before it must be re-issued.</p>
								<Field label="Expiry (hours)" hint="Applies to private self-hosted files and Bunny token links.">
									<Input type="number" min="1" value={ settings.sources?.signedUrlTtlHours || 6 } onChange={ ( e ) => setSettings( ( s ) => ( { ...s, sources: { ...( s.sources || {} ), signedUrlTtlHours: parseInt( e.target.value, 10 ) || 0 } } ) ) } />
								</Field>
							</Card>
						</>
					) : (
						<UpsellPanel title="Private &amp; premium sources" features={ [ 'Bunny.net token authentication', 'Signed, expiring playback URLs', 'Mux & HLS streaming' ] } />
					) }
				</div>
			) }

			{ tab === 'integrations' && (
				isPro() ? (
					<div className="max-w-xl space-y-6">
						<Card className="p-6">
							<h3 className="font-semibold text-gray-900 mb-1">Mailchimp</h3>
							<p className="text-sm text-muted mb-4">Send in-player opt-ins to Mailchimp audiences. Paste your API key (Account → Extras → API keys).</p>
							<Field label="Mailchimp API key" hint="Looks like abc123…-us21. Stored on your site only.">
								<Input
									type="password"
									value={ settings.integrations?.mailchimp?.api_key || '' }
									onChange={ ( e ) => setSettings( ( s ) => ( { ...s, integrations: { ...( s.integrations || {} ), mailchimp: { ...( s.integrations?.mailchimp || {} ), api_key: e.target.value } } } ) ) }
									placeholder="xxxxxxxxxxxxxxxx-us21"
								/>
							</Field>
							<p className="text-xs text-muted">Once saved, Mailchimp audiences appear in each video’s Subscribe tab.</p>
						</Card>

						<Card className="p-6">
							<h3 className="font-semibold text-gray-900 mb-1">Google Analytics</h3>
							<p className="text-sm text-muted mb-4">Send player events (video_start, video_complete) to GA4. Uses your existing site tag, or loads one from a measurement ID.</p>
							<Toggle
								checked={ !! settings.integrations?.ga?.enabled }
								onChange={ ( v ) => setSettings( ( s ) => ( { ...s, integrations: { ...( s.integrations || {} ), ga: { ...( s.integrations?.ga || {} ), enabled: v } } } ) ) }
								label="Send player events to Google Analytics"
							/>
							{ settings.integrations?.ga?.enabled && (
								<Field label="Measurement ID" hint="Optional — leave blank to use the site's existing GA tag.">
									<Input value={ settings.integrations?.ga?.measurementId || '' } onChange={ ( e ) => setSettings( ( s ) => ( { ...s, integrations: { ...( s.integrations || {} ), ga: { ...( s.integrations?.ga || {} ), measurementId: e.target.value.trim() } } } ) ) } placeholder="G-XXXXXXXXXX" />
								</Field>
							) }
						</Card>
					</div>
				) : (
					<UpsellPanel title="CRM &amp; email integrations" features={ [ 'Mailchimp audiences', 'Google Analytics events', 'GemCRM / FluentCRM opt-in capture' ] } />
				)
			) }

			{ tab === 'whitelabel' && (
				isPro() ? (
					<Card className="p-6 max-w-xl">
						<h3 className="font-semibold text-gray-900 mb-1">White-label</h3>
						<p className="text-sm text-gray-500 mb-4">Replace the TruePlayer name across the admin and hide the player attribution.</p>
						<Toggle
							checked={ !! settings.whiteLabel?.enabled }
							onChange={ ( v ) => setSettings( ( s ) => ( { ...s, whiteLabel: { ...( s.whiteLabel || {} ), enabled: v } } ) ) }
							label="Enable white-label"
						/>
						{ settings.whiteLabel?.enabled && (
							<Field label="Brand name" hint="Shown in the admin menu &amp; titles.">
								<Input
									value={ settings.whiteLabel?.brand || '' }
									onChange={ ( e ) => setSettings( ( s ) => ( { ...s, whiteLabel: { ...( s.whiteLabel || {} ), brand: e.target.value } } ) ) }
									placeholder="Acme Video"
								/>
							</Field>
						) }
						<p className="text-xs text-gray-400 mt-2">Takes effect on the next page load after saving.</p>
					</Card>
				) : (
					<UpsellPanel title="White-label" features={ [ 'Rebrand the admin', 'Remove player attribution' ] } />
				)
			) }

			{ tab === 'logs' && (
				isPro() ? <WebhookLogs /> : <UpsellPanel title="Webhook delivery logs" features={ [ 'Every delivery attempt recorded', 'See failures &amp; status codes' ] } />
			) }

			{ tab === 'webhooks' && (
				isPro() ? (
					<Card className="p-6">
						<h3 className="font-semibold text-gray-900 mb-4">Global webhooks</h3>
						<p className="text-sm text-gray-500 mb-4">Fire for every video, in addition to per-video webhooks.</p>
						<EndpointList
							endpoints={ settings.webhooks || [] }
							onChange={ ( webhooks ) => setSettings( ( s ) => ( { ...s, webhooks } ) ) }
						/>
					</Card>
				) : (
					<UpsellPanel title="Automation & webhooks" features={ [ 'Signed webhooks on every player event', 'Site-wide + per-video endpoints' ] } />
				)
			) }

			{ tab === 'license' && (
				<Card className="p-6 max-w-xl">
					<div className="flex items-center gap-3 mb-2">
						<h3 className="font-semibold text-gray-900">License</h3>
						<Badge tone={ isPro() ? 'green' : 'gray' }>{ isPro() ? 'Pro active' : 'Free' }</Badge>
					</div>
					{ isPro() ? (
						<p className="text-sm text-gray-500">TruePlayer Pro is active and your license is valid. Manage your key from the plugin’s license panel (Plugins → TruePlayer Pro).</p>
					) : (
						<p className="text-sm text-gray-500">
							You’re on the free player. Install <strong>TruePlayer Pro</strong> and activate a license to unlock watch-verification, quiz-gating, analytics, automation, premium sources and playlists.
						</p>
					) }
				</Card>
			) }
				</div>
			</div>
		</div>
	);
}
