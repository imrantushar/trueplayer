import { useEffect, useState, useMemo } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Input, Select, Field, Modal } from '../components/UI';
import { Icon } from '../components/icons';
import { isPro } from '../pro';
import PlayerOptionsTab from './editor/PlayerOptionsTab';
import PreviewPanel from './editor/PreviewPanel';

// A built-in sample so a preset can be previewed even before any video exists.
const SAMPLE_SOURCE = { type: 'url', src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', poster: '' };

function Editor( { preset, onBack, onSaved } ) {
	const [ title, setTitle ] = useState( preset.title );
	const [ config, setConfig ] = useState( preset.config || {} );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );

	// Preview subject: preview the preset's styling on a real video's source.
	const [ videos, setVideos ] = useState( [] );
	const [ previewId, setPreviewId ] = useState( 0 );
	useEffect( () => {
		api.listVideos().then( ( list ) => {
			const withSrc = ( list || [] ).filter( ( v ) => v.config?.source?.src );
			setVideos( withSrc );
			setPreviewId( withSrc[ 0 ]?.id || 0 );
		} );
	}, [] );

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

	// The preset's look (config) applied over a real source, for the live player.
	const previewVideo = videos.find( ( v ) => v.id === previewId );
	const previewConfig = useMemo(
		() => ( { ...config, source: previewVideo?.config?.source || SAMPLE_SOURCE, chapters: previewVideo?.config?.chapters || [] } ),
		[ config, previewVideo ]
	);

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<Button variant="ghost" onClick={ onBack }>← Back</Button>
				<input className="w-full max-w-md text-2xl font-bold text-ink bg-transparent outline-none border-b border-transparent focus:border-line" value={ title } onChange={ ( e ) => setTitle( e.target.value ) } />
				<div className="flex-1" />
				{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
				<Button onClick={ save } disabled={ saving }>{ saving ? 'Saving…' : 'Save' }</Button>
			</div>
			<p className="text-sm text-muted mb-4">These styles &amp; behaviours apply to any video that uses this preset. Individual videos can still override anything.</p>

			<div className="flex flex-col xl:flex-row gap-6 items-start">
				<div className="flex-1 min-w-0">
					<PlayerOptionsTab config={ config } patch={ patch } />
				</div>

				<div className="w-full xl:w-[400px] shrink-0 xl:sticky xl:top-6">
					<Card className="p-4">
						{ videos.length > 0 && (
							<div className="flex items-center gap-2 mb-3">
								<span className="text-xs text-muted whitespace-nowrap">Preview with</span>
								<Select value={ previewId } onChange={ ( e ) => setPreviewId( parseInt( e.target.value, 10 ) ) } className="h-9 text-[13px]">
									{ videos.map( ( v ) => <option key={ v.id } value={ v.id }>{ v.title }</option> ) }
								</Select>
							</div>
						) }
						<PreviewPanel id={ previewId || 0 } config={ previewConfig } />
					</Card>
				</div>
			</div>
		</div>
	);
}

// Predefined starting points (FluentPlayer-style). Users pick one, then tweak
// and save. Each seeds the preset's appearance; 'blank' starts from defaults.
const PRESET_TEMPLATES = [
	{ key: 'blank', label: 'Blank (defaults)', config: {} },
	{ key: 'default', label: 'Default', config: { customize: { appearance: { skin: 'default', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 10 } } } },
	{ key: 'modern', label: 'Modern', config: { customize: { appearance: { skin: 'modern', controlBarStyle: 'solid', playButtonStyle: 'soft', roundness: 14 } } } },
	{ key: 'simple', label: 'Simple', config: { customize: { appearance: { skin: 'simple', controlBarStyle: 'solid', playButtonStyle: 'square', roundness: 6 } } } },
	{ key: 'minimal', label: 'Minimal', config: { customize: { appearance: { skin: 'minimal', controlBarStyle: 'minimal', playButtonStyle: 'square', roundness: 0 } } } },
	{ key: 'standard', label: 'Standard', config: { customize: { appearance: { skin: 'standard', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 8 } } } },
	{ key: 'floating', label: 'Floating (Pro)', pro: true, config: { customize: { appearance: { skin: 'floating', controlBarStyle: 'solid', playButtonStyle: 'soft', roundness: 16 } } } },
	{ key: 'ambient', label: 'Ambient (Pro)', pro: true, config: { customize: { appearance: { skin: 'ambient', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 8 } } } },
];

export default function Presets() {
	const [ presets, setPresets ] = useState( null );
	const [ title, setTitle ] = useState( '' );
	const [ template, setTemplate ] = useState( 'default' );
	const [ adding, setAdding ] = useState( false );
	const [ busy, setBusy ] = useState( false );
	const [ editing, setEditing ] = useState( null );

	const load = () => api.listPresets().then( setPresets );
	useEffect( () => { load(); }, [] );

	const create = async () => {
		setBusy( true );
		try {
			const tpl = PRESET_TEMPLATES.find( ( t ) => t.key === template ) || PRESET_TEMPLATES[ 0 ];
			const p = await api.createPreset( title || tpl.label, JSON.parse( JSON.stringify( tpl.config ) ) );
			setTitle( '' );
			setAdding( false );
			await load();
			setEditing( p );
		} finally {
			setBusy( false );
		}
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
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-ink">Player presets</h1>
					<p className="text-sm text-muted">Reusable styles &amp; behaviour — brand once, use everywhere.</p>
				</div>
				<Button onClick={ () => { setTitle( '' ); setAdding( true ); } }><Icon name="plus" className="w-4 h-4" /> Add preset</Button>
			</div>

			{ adding && (
				<Modal
					title="Add preset"
					onClose={ () => setAdding( false ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setAdding( false ) }>Cancel</Button>
							<Button onClick={ create } disabled={ busy }>{ busy ? 'Creating…' : 'Create & edit' }</Button>
						</>
					}
				>
					<Field label="Preset name">
						<Input autoFocus value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ ( e ) => e.key === 'Enter' && create() } placeholder="e.g. Brand — dark" />
					</Field>
					<Field label="Start from" hint="A predefined look to begin with — you can change everything after.">
						<Select value={ template } onChange={ ( e ) => setTemplate( e.target.value ) }>
							{ PRESET_TEMPLATES.map( ( t ) => (
								<option key={ t.key } value={ t.key } disabled={ t.pro && ! isPro() }>
									{ t.label }{ t.pro && ! isPro() ? ' — needs Pro' : '' }
								</option>
							) ) }
						</Select>
					</Field>
				</Modal>
			) }

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
					const accent = p.config?.customize?.appearance?.accent || '#006BFF';
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
