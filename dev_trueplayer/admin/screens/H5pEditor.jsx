import { useEffect, useState } from '@wordpress/element';
import { Card, Field, Input, Button, Toast, Badge, SectionTitle } from '../components/UI';
import SemanticsForm from '../h5p/SemanticsForm';
import { api } from '../api';

/**
 * Authoring screen for an H5P item. Loads the content type's semantics and
 * renders them with SemanticsForm (our own UI kit), then saves through the H5P
 * REST controller. Renders the same for a brand-new item (given a machineName)
 * or an existing one (given a video id).
 */
export default function H5pEditor( { video = null, machineName = '', onBack } ) {
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ savedShortcode, setSavedShortcode ] = useState( '' );

	const [ title, setTitle ] = useState( '' );
	const [ library, setLibrary ] = useState( '' );
	const [ semantics, setSemantics ] = useState( [] );
	const [ params, setParams ] = useState( {} );
	const [ typeTitle, setTypeTitle ] = useState( '' );

	useEffect( () => {
		let alive = true;
		( async () => {
			setLoading( true );
			setError( null );
			try {
				let machine = machineName;
				let nextTitle = '';
				let nextParams = {};

				if ( video ) {
					const content = await api.h5pGetContent( video );
					nextTitle = content.title || '';
					nextParams = content.params || {};
					machine = ( content.library || machineName ).split( ' ' )[ 0 ];
				}

				const sem = await api.h5pSemantics( machine );
				if ( ! alive ) return;
				setLibrary( sem.library );
				setSemantics( sem.semantics || [] );
				setTypeTitle( sem.title || machine.replace( 'H5P.', '' ) );
				setTitle( nextTitle || sem.title || '' );
				setParams( nextParams || {} );
			} catch ( e ) {
				if ( alive ) setError( e.message || 'Failed to load the content type.' );
			} finally {
				if ( alive ) setLoading( false );
			}
		} )();
		return () => { alive = false; };
	}, [ video, machineName ] );

	const save = async () => {
		setSaving( true );
		setError( null );
		try {
			const res = await api.h5pSaveContent( { video: video || 0, title, library, params } );
			setSavedShortcode( res.shortcode );
		} catch ( e ) {
			setError( e.message || 'Save failed.' );
		} finally {
			setSaving( false );
		}
	};

	if ( loading ) {
		return <div className="p-8 text-gray-400">Loading builder…</div>;
	}

	return (
		<div className="max-w-3xl">
			<div className="flex items-center justify-between mb-5">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="sm" onClick={ onBack }>← Back</Button>
					<Badge tone="blue">{ typeTitle }</Badge>
				</div>
				<Button onClick={ save } disabled={ saving }>{ saving ? 'Saving…' : 'Save' }</Button>
			</div>

			<SectionTitle title={ video ? 'Edit interactive content' : 'New interactive content' } description="Authored with TruePlayer, rendered by H5P." />

			<Card className="p-6 mt-4">
				<Field label="Title" hint="Shown in your Media library (not to viewers).">
					<Input value={ title } onChange={ ( e ) => setTitle( e.target.value ) } placeholder="Untitled interactive" />
				</Field>
			</Card>

			<div className="mt-6">
				<SemanticsForm semantics={ semantics } value={ params } onChange={ setParams } />
			</div>

			{ savedShortcode && (
				<Card className="p-5 mt-6 border-green-200 bg-green-50">
					<p className="text-sm text-gray-700 mb-2">Saved. Embed it anywhere with:</p>
					<code className="block bg-white border border-line rounded px-3 py-2 text-sm select-all">{ savedShortcode }</code>
				</Card>
			) }

			{ error && <Toast message={ error } onDismiss={ () => setError( null ) } /> }
		</div>
	);
}
