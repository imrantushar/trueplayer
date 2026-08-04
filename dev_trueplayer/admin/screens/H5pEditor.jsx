import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Card, Field, Input, Button, Toast, Badge, SubSidebar } from '../components/UI';
import SemanticsForm from '../h5p/SemanticsForm';
import { api } from '../api';

/**
 * Authoring screen for an H5P item. Mirrors the native video editor: a
 * contextual sidebar of sections (a "Content" section plus one tab per
 * top-level setting group), the semantics-driven form in the middle, and a live
 * preview of the real H5P content on the right. Edits auto-save (debounced) and
 * the preview reloads.
 */
export default function H5pEditor( { video = null, machineName = '', onBack } ) {
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ status, setStatus ] = useState( 'idle' ); // idle | saving | saved

	const [ vid, setVid ] = useState( video );
	const [ title, setTitle ] = useState( '' );
	const [ library, setLibrary ] = useState( '' );
	const [ semantics, setSemantics ] = useState( [] );
	const [ params, setParams ] = useState( {} );
	const [ typeTitle, setTypeTitle ] = useState( '' );
	const [ preview, setPreview ] = useState( '' );
	const [ previewKey, setPreviewKey ] = useState( 0 );
	const [ sub, setSub ] = useState( '__content' );

	const hydrated = useRef( false );
	const saveTimer = useRef( null );

	// Split the top-level semantics into a "Content" bucket (scalars, lists,
	// single-field + library groups) and one navigable tab per multi-field
	// setting group (Behaviour, Text overrides, Feedback, …).
	const { contentFields, groupTabs } = useMemo( () => {
		const isTab = ( f ) => f.type === 'group' && ( f.fields || [] ).length > 1;
		return {
			contentFields: semantics.filter( ( f ) => ! isTab( f ) ),
			groupTabs: semantics.filter( isTab ),
		};
	}, [ semantics ] );

	const sidebarItems = useMemo(
		() => [ [ '__content', 'Content' ], ...groupTabs.map( ( g ) => [ g.name, g.label || g.name ] ) ],
		[ groupTabs ]
	);

	useEffect( () => {
		let alive = true;
		( async () => {
			setLoading( true );
			setError( null );
			hydrated.current = false;
			try {
				let machine = machineName;
				let nextTitle = '';
				let nextParams = {};
				let nextPreview = '';

				if ( video ) {
					const content = await api.h5pGetContent( video );
					nextTitle = content.title || '';
					nextParams = content.params || {};
					nextPreview = content.preview || '';
					machine = ( content.library || machineName ).split( ' ' )[ 0 ];
				}

				const sem = await api.h5pSemantics( machine );
				if ( ! alive ) return;
				setLibrary( sem.library );
				setSemantics( sem.semantics || [] );
				setTypeTitle( sem.title || machine.replace( 'H5P.', '' ) );
				setTitle( nextTitle || sem.title || '' );
				setParams( nextParams || {} );
				setPreview( nextPreview );
				setSub( '__content' );
			} catch ( e ) {
				if ( alive ) setError( e.message || 'Failed to load the content type.' );
			} finally {
				if ( alive ) {
					setLoading( false );
					setTimeout( () => { hydrated.current = true; }, 0 );
				}
			}
		} )();
		return () => { alive = false; };
	}, [ video, machineName ] );

	const persist = async () => {
		setStatus( 'saving' );
		setError( null );
		try {
			const res = await api.h5pSaveContent( { video: vid || 0, title, library, params } );
			setVid( res.video );
			if ( res.preview ) setPreview( res.preview );
			setPreviewKey( ( k ) => k + 1 );
			setStatus( 'saved' );
		} catch ( e ) {
			setStatus( 'idle' );
			setError( e.message || 'Save failed.' );
		}
	};

	useEffect( () => {
		if ( ! hydrated.current ) return;
		if ( saveTimer.current ) clearTimeout( saveTimer.current );
		saveTimer.current = setTimeout( persist, 900 );
		return () => saveTimer.current && clearTimeout( saveTimer.current );
	}, [ params, title ] ); // eslint-disable-line react-hooks/exhaustive-deps

	if ( loading ) {
		return <div className="p-8 text-gray-400">Loading builder…</div>;
	}

	const previewSrc = preview ? `${ preview }${ preview.includes( '?' ) ? '&' : '?' }k=${ previewKey }` : '';
	const activeGroup = groupTabs.find( ( g ) => g.name === sub );

	return (
		<div>
			<div className="flex items-center justify-between mb-5">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="sm" onClick={ onBack }>← Back</Button>
					<Badge tone="blue">{ typeTitle }</Badge>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-xs text-gray-400 min-w-[64px] text-right">
						{ status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : '' }
					</span>
					<Button onClick={ persist } disabled={ status === 'saving' }>Save</Button>
				</div>
			</div>

			<div className="flex flex-col lg:flex-row gap-6 items-start">
				<SubSidebar value={ sub } onChange={ setSub } items={ sidebarItems } />

				{ /* Active section */ }
				<div className="flex-1 min-w-0 w-full">
					<Card className="p-6">
						{ sub === '__content' ? (
							<>
								<Field label="Title" hint="Shown in your Media library (not to viewers).">
									<Input value={ title } onChange={ ( e ) => setTitle( e.target.value ) } placeholder="Untitled interactive" />
								</Field>
								<div className="mt-6 pt-6 border-t border-line">
									<SemanticsForm semantics={ contentFields } value={ params } onChange={ setParams } />
								</div>
							</>
						) : activeGroup ? (
							<>
								<h3 className="font-medium text-gray-900 text-[15px] mb-1">{ activeGroup.label || activeGroup.name }</h3>
								{ activeGroup.description && <p className="text-sm text-gray-500 mb-4">{ activeGroup.description }</p> }
								<div className={ activeGroup.description ? '' : 'mt-2' }>
									<SemanticsForm
										semantics={ activeGroup.fields }
										value={ params[ activeGroup.name ] || {} }
										onChange={ ( v ) => setParams( { ...params, [ activeGroup.name ]: v } ) }
									/>
								</div>
							</>
						) : null }
					</Card>
				</div>

				{ /* Live preview */ }
				<div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-[104px]">
					<Card className="overflow-hidden">
						<div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-gray-50">
							<span className="text-[13px] font-medium text-gray-700">Live preview</span>
							{ previewSrc && (
								<button type="button" className="text-xs text-brand-500 hover:underline" onClick={ () => setPreviewKey( ( k ) => k + 1 ) }>
									Refresh
								</button>
							) }
						</div>
						{ previewSrc ? (
							<iframe
								key={ previewKey }
								title="H5P preview"
								src={ previewSrc }
								className="w-full block"
								style={ { height: 460, border: 0, background: '#fff' } }
							/>
						) : (
							<div className="h-[300px] flex items-center justify-center text-sm text-gray-400 px-6 text-center">
								Start editing — your interactive content will preview here.
							</div>
						) }
					</Card>
					<p className="text-xs text-gray-400 mt-2 px-1">Changes save automatically and refresh the preview.</p>
				</div>
			</div>

			{ error && <Toast message={ error } onDismiss={ () => setError( null ) } /> }
		</div>
	);
}
