import { useEffect, useState } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Input } from '../components/UI';
import { Icon } from '../components/icons';
import PlayerOptionsTab from './editor/PlayerOptionsTab';

function Editor( { preset, onBack, onSaved } ) {
	const [ title, setTitle ] = useState( preset.title );
	const [ config, setConfig ] = useState( preset.config || {} );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );

	// PlayerOptionsTab edits config.customize / config.branding — the exact shape
	// a preset stores, so we reuse it directly.
	const patch = ( partial ) => { setConfig( ( c ) => ( { ...c, ...partial } ) ); setSaved( false ); };

	const save = async () => {
		setSaving( true );
		try {
			await api.updatePreset( preset.id, { title, config } );
			setSaved( true );
			setTimeout( () => setSaved( false ), 2000 );
			onSaved();
		} finally {
			setSaving( false );
		}
	};

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<Button variant="ghost" onClick={ onBack }>← Back</Button>
				<input className="flex-1 text-2xl font-bold text-ink bg-transparent outline-none border-b border-transparent focus:border-line" value={ title } onChange={ ( e ) => setTitle( e.target.value ) } />
				{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
				<Button onClick={ save } disabled={ saving }>{ saving ? 'Saving…' : 'Save' }</Button>
			</div>
			<p className="text-sm text-gray-500 mb-4">These styles &amp; behaviours apply to any video that uses this preset. Individual videos can still override anything.</p>
			<PlayerOptionsTab config={ config } patch={ patch } />
		</div>
	);
}

export default function Presets() {
	const [ presets, setPresets ] = useState( null );
	const [ title, setTitle ] = useState( '' );
	const [ editing, setEditing ] = useState( null );

	const load = () => api.listPresets().then( setPresets );
	useEffect( () => { load(); }, [] );

	const create = async () => {
		const p = await api.createPreset( title || 'Untitled preset' );
		setTitle( '' );
		await load();
		setEditing( p );
	};
	const remove = async ( id ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( 'Delete this preset? Videos using it fall back to defaults.' ) ) {
			return;
		}
		await api.deletePreset( id );
		load();
	};

	if ( editing ) {
		return <Editor preset={ editing } onBack={ () => { setEditing( null ); load(); } } onSaved={ load } />;
	}

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-ink">Player presets</h1>
				<p className="text-sm text-gray-500">Reusable styles &amp; behaviour you can apply to any video — brand once, use everywhere.</p>
			</div>

			<Card className="p-4 mb-6 flex gap-3 items-center">
				<Input placeholder="New preset name…" value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ ( e ) => e.key === 'Enter' && create() } />
				<Button onClick={ create }>+ Create preset</Button>
			</Card>

			{ presets === null && <p className="text-gray-400">Loading…</p> }
			{ presets && presets.length === 0 && (
				<Card className="p-12 text-center border-dashed">
					<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center"><Icon name="presets" className="w-6 h-6" /></div>
					<p className="font-semibold text-gray-900">No presets yet</p>
					<p className="text-sm text-gray-500">Create one to reuse a consistent player style across videos.</p>
				</Card>
			) }

			<div className="space-y-3">
				{ ( presets || [] ).map( ( p ) => {
					const accent = p.config?.customize?.appearance?.accent || '#008dff';
					return (
						<Card key={ p.id } className="p-4 flex items-center gap-4 hover:border-brand-200 transition-colors">
							<span className="w-10 h-10 rounded-lg border border-line shrink-0" style={ { background: accent } } />
							<div className="flex-1 min-w-0">
								<div className="font-semibold text-ink truncate">{ p.title }</div>
								<div className="text-xs text-gray-500">Player preset</div>
							</div>
							<Button variant="ghost" onClick={ () => setEditing( p ) }>Edit</Button>
							<Button variant="danger" onClick={ () => remove( p.id ) }>Delete</Button>
						</Card>
					);
				} ) }
			</div>
		</div>
	);
}
