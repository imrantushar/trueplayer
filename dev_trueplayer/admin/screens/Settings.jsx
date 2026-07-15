import { useEffect, useState, createPortal } from '@wordpress/element';
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

export default function Settings( { onEditState } ) {
	const [ settings, setSettings ] = useState( null );
	const [ tab, setTab ] = useState( 'defaults' );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ dirty, setDirty ] = useState( false );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );

	useEffect( () => {
		api.getSettings().then( ( s ) => setSettings( s || {} ) );
		setToolbarSlot( document.getElementById( 'tp-topbar-slot' ) );
	}, [] );

	// Report dirty state up to the app shell so it can warn before navigating away
	// (Settings has no breadcrumb title/back of its own, unlike the entity editors).
	useEffect( () => { onEditState && onEditState( { dirty } ); }, [ dirty ] );
	useEffect( () => () => onEditState && onEditState( null ), [] );

	const patch = ( partial ) => {
		setSettings( ( s ) => ( { ...s, ...partial } ) );
		setDirty( true );
	};

	const save = async () => {
		setSaving( true );
		try {
			await api.saveSettings( settings );
			setDirty( false );
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
			{ /* Save lives in the topbar (portaled) — same pattern as the video editor. */ }
			{ toolbarSlot && createPortal(
				<>
					{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
					<Button onClick={ save } disabled={ saving || ! dirty }>{ saving ? 'Saving…' : 'Save' }</Button>
				</>,
				toolbarSlot
			) }

			<h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

			<div className="flex flex-col md:flex-row gap-6 items-start">
				{ /* Sticky header (top-8) + this h-14 bar are ~88px; top-[104px] clears both with a small gap. */ }
				<Card className="w-full md:w-56 shrink-0 md:sticky md:top-[104px] p-2 space-y-1">
					{ SUBTABS.map( ( t ) => (
						<button
							key={ t.key }
							onClick={ () => setTab( t.key ) }
							className={ `flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition ${
								tab === t.key ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
							}` }
						>
							{ t.label }
						</button>
					) ) }
				</Card>

				<div className="flex-1 min-w-0">
					{ tab === 'defaults' && (
						<>
							<p className="text-sm text-gray-500 mb-4">
								These apply to every video by default. A video's own <strong>Player options</strong> tab overrides them.
							</p>
							<PlayerOptionsTab
								config={ { customize: settings.customize || {} } }
								patch={ patch }
							/>
						</>
					) }

					{ tab === 'webhooks' && (
						isPro() ? (
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 mb-1">Global webhooks</h3>
								<p className="text-sm text-gray-500 mb-4 pb-4 border-b border-line">Fire for every video, in addition to per-video webhooks.</p>
								<EndpointList
									endpoints={ settings.webhooks || [] }
									onChange={ ( webhooks ) => patch( { webhooks } ) }
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
								<p className="text-sm text-gray-500 mb-4 pb-4 border-b border-line">
									Needed for <strong>private</strong> Bunny videos: enable Token Authentication on your pull zone in the Bunny
									dashboard, then paste its key here. TruePlayer signs expiring playback URLs with it.
								</p>
								<Field label="Token Authentication Key">
									<Input
										type="password"
										value={ settings.bunny?.tokenKey || '' }
										onChange={ ( e ) => patch( { bunny: { ...( settings.bunny || {} ), tokenKey: e.target.value } } ) }
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
							<div className="flex items-center gap-3 mb-4 pb-4 border-b border-line">
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
		</>
	);
}
