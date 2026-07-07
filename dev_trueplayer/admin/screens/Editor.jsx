import { useEffect, useState, useCallback } from '@wordpress/element';
import { api } from '../api';
import { Button, Select } from '../components/UI';
import SourceTab from './editor/SourceTab';
import PlayerOptionsTab from './editor/PlayerOptionsTab';
import AppearanceTab from './editor/AppearanceTab';
import OverlaysTab from './editor/OverlaysTab';
import GatingTab from './editor/GatingTab';
import SubscribeTab from './editor/SubscribeTab';
import WebhooksTab from './editor/WebhooksTab';
import EmbedTab from './editor/EmbedTab';
import PreviewPanel from './editor/PreviewPanel';
import UpsellPanel from '../components/UpsellPanel';
import { isPro } from '../pro';

const TABS = [
	{ key: 'source', label: 'Source', icon: '🎬' },
	{ key: 'player', label: 'Player options', icon: '🎛️' },
	{ key: 'appearance', label: 'Chapters & logo', icon: '🔖' },
	{ key: 'overlays', label: 'Call to action', icon: '📣' },
	{ key: 'gating', label: 'Questions & gating', icon: '✅', pro: true },
	{ key: 'subscribe', label: 'Subscribe', icon: '✉️', pro: true },
	{ key: 'webhooks', label: 'Automation', icon: '🔗', pro: true },
	{ key: 'embed', label: 'Embed', icon: '📋' },
];

const PRO_TAB_INFO = {
	gating: { title: 'Watch-verification & quiz gating', features: [ 'Prove viewers actually watched (anti-skip)', 'Checkpoint & final quizzes', 'Lock the video on failure until re-watch' ] },
	subscribe: { title: 'Subscribe / email capture', features: [ 'In-player opt-in gate', 'Send contacts to GemCRM & other CRMs' ] },
	webhooks: { title: 'Automation & webhooks', features: [ 'Signed webhooks on every event', 'Zapier / gemcrm / zaplane ready' ] },
};

export default function Editor( { id, onBack } ) {
	const [ video, setVideo ] = useState( null );
	const [ tab, setTab ] = useState( 'source' );
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ presets, setPresets ] = useState( [] );

	useEffect( () => {
		api.getVideo( id ).then( ( v ) => setVideo( v ) );
		api.listPresets().then( setPresets ).catch( () => {} );
	}, [ id ] );

	const patchConfig = useCallback( ( partial ) => {
		setVideo( ( v ) => ( { ...v, config: { ...( v.config || {} ), ...partial } } ) );
		setDirty( true );
		setSaved( false );
	}, [] );

	const setTitle = ( title ) => {
		setVideo( ( v ) => ( { ...v, title } ) );
		setDirty( true );
	};

	const save = async () => {
		setSaving( true );
		try {
			const updated = await api.updateVideo( id, { title: video.title, config: video.config || {} } );
			setVideo( updated );
			setDirty( false );
			setSaved( true );
			setTimeout( () => setSaved( false ), 2000 );
		} finally {
			setSaving( false );
		}
	};

	if ( ! video ) {
		return <p className="text-gray-400">Loading…</p>;
	}

	const config = video.config || {};
	const pro = isPro();
	const isProTab = !! TABS.find( ( t ) => t.key === tab )?.pro;

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<Button variant="ghost" onClick={ onBack }>← Back</Button>
				<input
					className="flex-1 text-2xl font-bold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-line"
					value={ video.title }
					onChange={ ( e ) => setTitle( e.target.value ) }
				/>
				{ presets.length > 0 && (
					<label className="flex items-center gap-2 text-[13px] text-gray-500">
						Preset
						<Select
							className="w-40 h-9"
							value={ config.presetId || '' }
							onChange={ ( e ) => patchConfig( { presetId: e.target.value ? parseInt( e.target.value, 10 ) : undefined } ) }
						>
							<option value="">None</option>
							{ presets.map( ( p ) => <option key={ p.id } value={ p.id }>{ p.title }</option> ) }
						</Select>
					</label>
				) }
				{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
				{ dirty && ! saved && <span className="text-sm text-amber-600">Unsaved</span> }
				<Button onClick={ save } disabled={ saving || ! dirty }>{ saving ? 'Saving…' : 'Save' }</Button>
			</div>

			{ /* Steps as a horizontal sub-topbar → the editor content gets full width. */ }
			<div className="border-b border-line mb-6 overflow-x-auto">
				<nav className="flex gap-1 min-w-max">
					{ TABS.map( ( t ) => (
						<button
							key={ t.key }
							onClick={ () => setTab( t.key ) }
							className={ `flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
								tab === t.key ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900'
							}` }
						>
							<span className="text-base leading-none">{ t.icon }</span>
							{ t.label }
							{ t.pro && ! pro && <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 rounded px-1">PRO</span> }
						</button>
					) ) }
				</nav>
			</div>

			<div className="flex flex-col xl:flex-row gap-6 items-start">
				{ /* Active settings panel — now full width */ }
				<div className="flex-1 min-w-0 w-full">
					{ isProTab && ! pro ? (
						<UpsellPanel title={ PRO_TAB_INFO[ tab ].title } features={ PRO_TAB_INFO[ tab ].features } />
					) : (
						<>
							{ tab === 'source' && <SourceTab config={ config } patch={ patchConfig } /> }
							{ tab === 'player' && <PlayerOptionsTab config={ config } patch={ patchConfig } /> }
							{ tab === 'appearance' && <AppearanceTab config={ config } patch={ patchConfig } /> }
							{ tab === 'overlays' && <OverlaysTab config={ config } patch={ patchConfig } /> }
							{ tab === 'gating' && <GatingTab config={ config } patch={ patchConfig } /> }
							{ tab === 'subscribe' && <SubscribeTab config={ config } patch={ patchConfig } /> }
							{ tab === 'webhooks' && <WebhooksTab config={ config } patch={ patchConfig } /> }
							{ tab === 'embed' && <EmbedTab video={ video } /> }
						</>
					) }
				</div>

				{ /* Persistent live preview */ }
				<div className="w-full xl:w-[380px] shrink-0">
					<div className="xl:sticky xl:top-4">
						<PreviewPanel id={ id } config={ config } />
					</div>
				</div>
			</div>
		</div>
	);
}
