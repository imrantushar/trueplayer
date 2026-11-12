import { useEffect, useState } from '@wordpress/element';
import { __, __sprintf } from '@Utils/translation';
import { Button, Input } from './UI';
import { Icon } from './icons';
import { api } from '../api';
import { routeUrl } from '../nav';

/**
 * The source field for a video already uploaded to TruePlayer Cloud —
 * browse/search the account's library and pick one, or paste a video id
 * directly. Reuses the cloud addon's existing `cloud/videos` list endpoint
 * (the same one the connector's own block-editor picker used).
 *
 * Uploading a new video straight from this field isn't built yet — that
 * needs the connector's chunked, resumable uploader ported too, which this
 * change doesn't do. Pick a video already in your TruePlayer Cloud library
 * for now.
 */
export default function CloudVideoField( { value, onChange } ) {
	const [ status, setStatus ] = useState( null ); // null = still asking
	const [ browsing, setBrowsing ] = useState( false );
	const [ query, setQuery ] = useState( '' );
	const [ results, setResults ] = useState( null );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		api.cloudStatus()
			.then( setStatus )
			.catch( () => setStatus( { connected: false } ) );
	}, [] );

	useEffect( () => {
		if ( ! browsing ) {
			return;
		}
		let live = true;
		setError( '' );
		api.cloudVideos( { q: query, per_page: 20 } )
			.then( ( r ) => live && setResults( r.items || r.data || [] ) )
			.catch( ( e ) => live && setError( e.message || __( 'Could not load your TruePlayer Cloud library.' ) ) );
		return () => {
			live = false;
		};
	}, [ browsing, query ] );

	const pick = ( video ) => {
		onChange( { videoId: video.id, title: video.title || '' } );
		setBrowsing( false );
	};

	if ( ! status ) {
		return <div className="border border-line rounded-card px-3 py-6 text-center text-sm text-muted">{ __( 'Checking your TruePlayer Cloud library…' ) }</div>;
	}

	if ( ! status.connected ) {
		return (
			<div className="border border-dashed border-line rounded-card px-4 py-6 text-center bg-gray-50">
				<Icon name="cloud" className="w-5 h-5 mx-auto text-muted" />
				<p className="text-sm font-medium text-ink !mt-2 !mb-1">{ __( 'TruePlayer Cloud isn’t connected yet' ) }</p>
				<p className="text-xs text-muted leading-5 !m-0 max-w-sm mx-auto">{ __( 'Connect an API key and this source will be ready to use. Nothing else about this video is affected in the meantime.' ) }</p>
				<Button
					variant="secondary"
					size="sm"
					className="!mt-3"
					onClick={ () => {
						window.location.href = status.settingsUrl || routeUrl( 'settings' );
					} }
				>
					{ __( 'Open TruePlayer Cloud settings' ) }
				</Button>
			</div>
		);
	}

	// Chosen — show what it is and how to change it.
	if ( value?.videoId && ! browsing ) {
		return (
			<div className="flex items-center gap-3 border border-line rounded-card px-3 py-2.5">
				<Icon name="cloud" className="w-4 h-4 text-muted shrink-0" />
				<span className="min-w-0 flex-1">
					<span className="block text-sm text-ink truncate">{ value.title || value.videoId }</span>
					<span className="block text-xs text-muted truncate">{ value.videoId }</span>
				</span>
				<Button variant="ghost" size="sm" onClick={ () => setBrowsing( true ) }>{ __( 'Change' ) }</Button>
				<Button variant="ghost" size="sm" onClick={ () => onChange( { videoId: '', title: '' } ) }>{ __( 'Remove' ) }</Button>
			</div>
		);
	}

	if ( ! browsing ) {
		return (
			<Button variant="secondary" onClick={ () => { setBrowsing( true ); setQuery( '' ); } }>
				{ __( 'Browse your TruePlayer Cloud library…' ) }
			</Button>
		);
	}

	return (
		<div className="border border-line rounded-card p-2">
			<Input autoFocus placeholder={ __( 'Search your TruePlayer Cloud library…' ) } value={ query } onChange={ ( e ) => setQuery( e.target.value ) } />
			<div className="space-y-1 max-h-56 overflow-y-auto mt-2">
				{ null === results && <p className="text-sm text-gray-400 px-2 py-3">{ __( 'Loading…' ) }</p> }
				{ results && 0 === results.length && <p className="text-sm text-gray-400 px-2 py-3">{ __( 'No videos found.' ) }</p> }
				{ ( results || [] ).map( ( v ) => (
					<button key={ v.id } className="flex items-center gap-2 w-full text-left rounded-md p-2 hover:bg-gray-50" onClick={ () => pick( v ) }>
						<Icon name="film" className="w-4 h-4 text-muted shrink-0" />
						<span className="flex-1 text-sm truncate">{ v.title || v.id }</span>
						{ v.status && 'ready' !== v.status && <span className="text-xs text-muted shrink-0">{ __sprintf( '(%s)', v.status ) }</span> }
					</button>
				) ) }
			</div>
			{ error && <p className="text-xs text-danger !mt-1.5">{ error }</p> }
			<div className="flex justify-end mt-2 pt-2 border-t border-line">
				<Button variant="ghost" size="sm" onClick={ () => setBrowsing( false ) }>{ __( 'Done' ) }</Button>
			</div>
		</div>
	);
}
