import { useEffect, useState } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Badge, Field, Input } from '../components/UI';
import { EndpointList } from '../components/EndpointList';
import UpsellPanel from '../components/UpsellPanel';
import { isPro } from '../pro';
import PlayerOptionsTab from './editor/PlayerOptionsTab';

const SUBTABS = [
	{ key: 'defaults', label: 'Player defaults' },
	{ key: 'webhooks', label: 'Global webhooks' },
	{ key: 'bunny', label: 'Bunny.net' },
	{ key: 'license', label: 'License' },
];

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
		<>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold text-gray-900">Settings</h1>

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

			{ tab === 'bunny' && (
				isPro() ? (
					<Card className="p-6 max-w-xl">
						<h3 className="font-semibold text-gray-900 mb-1">Bunny.net token authentication</h3>
						<p className="text-sm text-gray-500 mb-4">
							Needed for <strong>private</strong> Bunny videos: enable Token Authentication on your pull zone in the Bunny
							dashboard, then paste its key here. TruePlayer signs expiring playback URLs with it.
						</p>
						<Field label="Token Authentication Key">
							<Input
								type="password"
								value={ settings.bunny?.tokenKey || '' }
								onChange={ ( e ) => setSettings( ( s ) => ( { ...s, bunny: { ...( s.bunny || {} ), tokenKey: e.target.value } } ) ) }
								placeholder="••••••••-••••-••••"
							/>
						</Field>
					</Card>
				) : (
					<UpsellPanel title="Private video via Bunny.net" features={ [ 'Token-signed, expiring playback URLs', 'Content protection for Bunny Stream' ] } />
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
		</>
	);
}
