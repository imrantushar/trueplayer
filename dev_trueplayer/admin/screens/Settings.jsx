import { useEffect, useState } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Badge, Field, Input, Toggle } from '../components/UI';
import { EndpointList } from '../components/EndpointList';
import UpsellPanel from '../components/UpsellPanel';
import { isPro } from '../pro';
import PlayerOptionsTab from './editor/PlayerOptionsTab';

const SUBTABS = [
	{ key: 'defaults', label: 'Player defaults' },
	{ key: 'integrations', label: 'Integrations' },
	{ key: 'whitelabel', label: 'White-label' },
	{ key: 'webhooks', label: 'Global webhooks' },
	{ key: 'logs', label: 'Webhook logs' },
	{ key: 'license', label: 'License' },
];

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

	useEffect( () => {
		api.getSettings().then( ( s ) => setSettings( s || {} ) );
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

			<div className="flex gap-1 border-b border-line mb-6">
				{ SUBTABS.map( ( t ) => (
					<button
						key={ t.key }
						onClick={ () => setTab( t.key ) }
						className={ `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
							tab === t.key ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
						}` }
					>
						{ t.label }
					</button>
				) ) }
			</div>

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

			{ tab === 'integrations' && (
				isPro() ? (
					<Card className="p-6 max-w-xl">
						<h3 className="font-semibold text-gray-900 mb-1">Mailchimp</h3>
						<p className="text-sm text-gray-500 mb-4">Send in-player opt-ins to Mailchimp audiences. Paste your API key (Account → Extras → API keys).</p>
						<Field label="Mailchimp API key" hint="Looks like abc123…-us21. Stored on your site only.">
							<Input
								type="password"
								value={ settings.integrations?.mailchimp?.api_key || '' }
								onChange={ ( e ) => setSettings( ( s ) => ( { ...s, integrations: { ...( s.integrations || {} ), mailchimp: { ...( s.integrations?.mailchimp || {} ), api_key: e.target.value } } } ) ) }
								placeholder="xxxxxxxxxxxxxxxx-us21"
							/>
						</Field>
						<p className="text-xs text-gray-400">Once saved, Mailchimp audiences appear in each video’s Subscribe tab.</p>
					</Card>
				) : (
					<UpsellPanel title="CRM &amp; email integrations" features={ [ 'Mailchimp audiences', 'GemCRM / FluentCRM', 'In-player opt-in capture' ] } />
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
	);
}
