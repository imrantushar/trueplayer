import { useEffect, useRef, useState } from '@wordpress/element';
import { Button, Modal, Input } from './UI';
import { Icon } from './icons';
import { api } from '../api';
import { ACCEPTED, uploadToBunny } from '../utils/bunnyUpload';

/**
 * The source field for a Bunny.net Storage video.
 *
 * Typing a CDN path by hand is the one thing an author cannot do from memory —
 * it means leaving the editor, finding the file in Bunny's dashboard, copying
 * its URL and coming back — so this offers the two things they actually have:
 * the file on their machine, or a file already sitting in the zone. Pasting a
 * URL stays available underneath, because a zone can hold files this plugin
 * never uploaded, and because it is the only path left when the credentials
 * aren't configured yet.
 *
 * `onChange` receives the URL string, exactly like MediaPicker, so the caller
 * doesn't care which of the three routes produced it.
 */
export default function BunnyStorageField( { value, onChange } ) {
	const [ status, setStatus ] = useState( null ); // null = still asking
	const [ upload, setUpload ] = useState( null ); // { name, percent }
	const [ error, setError ] = useState( '' );
	// Distinct from `error`: the file did upload, it just may not play. The URL
	// is kept either way — discarding a finished transfer over a config mistake
	// would cost the author the whole upload to fix a hostname.
	const [ warning, setWarning ] = useState( '' );
	const [ browsing, setBrowsing ] = useState( false );
	const [ pasting, setPasting ] = useState( false );
	const inputRef = useRef( null );
	const token = useRef( { cancelled: false } );

	useEffect( () => {
		let live = true;
		api.bunnyStatus()
			.then( ( s ) => live && setStatus( s ) )
			.catch( () => live && setStatus( { configured: false } ) );
		return () => {
			live = false;
		};
	}, [] );

	// An upload in flight outlives a tab switch inside the editor but not the
	// field being unmounted, so stop it rather than leaving it writing.
	useEffect( () => () => {
		token.current.cancelled = true;
	}, [] );

	const send = async ( file ) => {
		if ( ! file ) {
			return;
		}
		setError( '' );
		setWarning( '' );
		token.current = { cancelled: false };
		setUpload( { name: file.name, percent: 0 } );
		try {
			const stored = await uploadToBunny( file, {
				token: token.current,
				onProgress: ( percent ) => setUpload( ( u ) => ( u ? { ...u, percent } : u ) ),
			} );
			onChange( stored.url );
			if ( stored.warning ) {
				setWarning( stored.warning );
			}
		} catch ( e ) {
			if ( ! token.current.cancelled ) {
				setError( e.message || 'That file could not be uploaded.' );
			}
		} finally {
			setUpload( null );
		}
	};

	const onDrop = ( e ) => {
		e.preventDefault();
		if ( ! upload ) {
			send( e.dataTransfer.files?.[ 0 ] );
		}
	};

	// Uploading — the picker is replaced by the progress of the file in flight.
	if ( upload ) {
		return (
			<div className="border border-line rounded-card p-4">
				<div className="flex items-center gap-3">
					<span className="text-sm text-ink truncate flex-1">{ upload.name }</span>
					<span className="text-sm tabular-nums text-muted">{ upload.percent }%</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={ () => {
							token.current.cancelled = true;
						} }
					>
						Cancel
					</Button>
				</div>
				<div className="mt-2.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
					<div className="h-full bg-brand-500 transition-[width] duration-200" style={ { width: `${ upload.percent }%` } } />
				</div>
				<p className="text-xs text-muted !mt-2">
					{ upload.percent < 100 ? 'Sending to your storage zone — keep this tab open.' : 'Finishing up…' }
				</p>
			</div>
		);
	}

	// Chosen — show what it is and how to change it.
	if ( value ) {
		return (
			<>
				<div className="flex items-center gap-3 border border-line rounded-card px-3 py-2.5">
					<Icon name="film" className="w-4 h-4 text-muted shrink-0" />
					<span className="min-w-0 flex-1">
						<span className="block text-sm text-ink truncate">{ value.split( '/' ).pop().split( '?' )[ 0 ] }</span>
						<span className="block text-xs text-muted truncate">{ value }</span>
					</span>
					{ status?.configured && (
						<Button variant="ghost" size="sm" onClick={ () => inputRef.current?.click() }>Replace</Button>
					) }
					<Button variant="ghost" size="sm" onClick={ () => onChange( '' ) }>Remove</Button>
				</div>
				<FilePicker inputRef={ inputRef } onPick={ send } />
				{ error && <p className="text-xs text-danger !mt-1.5">{ error }</p> }
				{ warning && <Warning text={ warning } /> }
			</>
		);
	}

	// Which affordance belongs here depends on whether a zone is connected, so
	// hold the space until the answer arrives rather than offering an upload
	// button that turns into a URL box a moment later.
	if ( ! status ) {
		return <div className="border border-dashed border-line rounded-card py-6 text-center text-sm text-placeholder">Checking your storage zone…</div>;
	}

	// Not configured yet — a URL is the only thing that can work, so lead with it.
	if ( ! status.configured ) {
		return (
			<>
				<Input
					value={ value || '' }
					onChange={ ( e ) => onChange( e.target.value.trim() ) }
					placeholder="https://your-zone.b-cdn.net/path/video.mp4"
				/>
				<p className="text-xs text-muted !mt-1.5">
					Connect your storage zone under <strong>Settings → Sources &amp; CDN</strong> to upload files straight from here.
				</p>
			</>
		);
	}

	return (
		<>
			<button
				type="button"
				onClick={ () => inputRef.current?.click() }
				onDragOver={ ( e ) => e.preventDefault() }
				onDrop={ onDrop }
				className="w-full border border-dashed border-line rounded-card py-6 text-center text-sm text-muted hover:border-brand-400 hover:text-brand-500 transition-colors"
			>
				<span className="block text-xl leading-none mb-1">+</span>
				Upload a video to Bunny.net
				<span className="block text-xs text-gray-400 mt-1">
					or drop it here{ status?.maxBytes ? ` · up to ${ formatBytes( status.maxBytes ) }` : '' }
				</span>
			</button>

			<div className="flex items-center gap-3 mt-2 text-xs">
				<button type="button" className="text-brand-500 hover:underline" onClick={ () => setBrowsing( true ) }>
					Browse your zone
				</button>
				<span className="text-gray-300">·</span>
				<button type="button" className="text-muted hover:text-ink" onClick={ () => setPasting( ( p ) => ! p ) }>
					Paste a URL instead
				</button>
			</div>

			{ pasting && (
				<Input
					className="mt-2"
					autoFocus
					value={ value || '' }
					onChange={ ( e ) => onChange( e.target.value.trim() ) }
					placeholder="https://your-zone.b-cdn.net/path/video.mp4"
				/>
			) }

			<FilePicker inputRef={ inputRef } onPick={ send } />
			{ error && <p className="text-xs text-danger !mt-1.5">{ error }</p> }
			{ status.streamHost && (
				<Warning text={ `${ status.pullZone } is a Bunny Stream pull zone, not a storage one — files uploaded here will not play from it. Fix the pull-zone hostname under Settings → Sources & CDN first.` } />
			) }

			{ browsing && (
				<ZoneBrowser
					onClose={ () => setBrowsing( false ) }
					onPick={ ( file ) => {
						onChange( file.url );
						setBrowsing( false );
					} }
				/>
			) }
		</>
	);
}

/**
 * A problem worth stopping for that isn't a failure — the upload worked, the
 * playback URL is doubtful. Amber rather than red, and never in place of the
 * file: the author still has their upload, they just have a hostname to fix.
 */
function Warning( { text } ) {
	return (
		// The body is `text-ink`, not `text-warning`: #FDB022 on its own 12%
		// tint is about 1.9:1, which is fine for a one-word badge and
		// unreadable for a sentence. The amber carries in the icon and border.
		<div className="flex gap-2 mt-2 p-3 rounded border border-warning/40 bg-warning-light">
			<Icon name="help" className="w-4 h-4 shrink-0 text-warning mt-px" />
			<p className="text-xs text-ink leading-5 !m-0">{ text }</p>
		</div>
	);
}

/**
 * The file input itself, kept out of the layout. It is rendered rather than
 * created on demand so the same element can be reused for Replace, and it is
 * reset after every pick — choosing the same file twice in a row fires no
 * change event otherwise, which reads as the button being broken.
 */
function FilePicker( { inputRef, onPick } ) {
	return (
		<input
			ref={ inputRef }
			type="file"
			accept={ ACCEPTED }
			className="hidden"
			onChange={ ( e ) => {
				const file = e.target.files?.[ 0 ];
				e.target.value = '';
				onPick( file );
			} }
		/>
	);
}

/** Files already in the zone, so an author can reuse one without re-sending it. */
function ZoneBrowser( { onClose, onPick } ) {
	const [ files, setFiles ] = useState( null );
	const [ error, setError ] = useState( '' );
	const [ query, setQuery ] = useState( '' );

	useEffect( () => {
		api.bunnyFiles()
			.then( ( r ) => setFiles( r.files || [] ) )
			.catch( ( e ) => setError( e.message || 'Your storage zone could not be listed.' ) );
	}, [] );

	const q = query.trim().toLowerCase();
	const shown = ( files || [] ).filter( ( f ) => ! q || f.name.toLowerCase().includes( q ) );

	return (
		<Modal title="Files in your storage zone" onClose={ onClose } className="max-w-lg">
			<div className="relative mb-3">
				<Icon name="search" className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-placeholder" />
				<Input value={ query } onChange={ ( e ) => setQuery( e.target.value ) } placeholder="Search files" className="!pl-8" />
			</div>

			{ error && <p className="text-sm text-danger">{ error }</p> }
			{ ! files && ! error && <p className="text-sm text-muted py-8 text-center">Loading…</p> }
			{ files && 0 === files.length && (
				<p className="text-sm text-muted py-8 text-center">Nothing here yet — upload a video and it will appear.</p>
			) }
			{ files && files.length > 0 && 0 === shown.length && (
				<p className="text-sm text-muted py-8 text-center">No file matches “{ query }”.</p>
			) }

			<div className="max-h-80 overflow-y-auto -mx-1 px-1">
				{ shown.map( ( f ) => (
					<button
						key={ f.path }
						type="button"
						onClick={ () => onPick( f ) }
						className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded border border-line bg-white hover:border-brand-200 hover:bg-gray-50 transition-colors mb-2 last:mb-0"
					>
						<Icon name="film" className="w-4 h-4 text-muted shrink-0" />
						<span className="min-w-0 flex-1 text-[13px] text-ink truncate">{ f.name }</span>
						<span className="text-xs text-muted shrink-0">{ formatBytes( f.size ) }</span>
					</button>
				) ) }
			</div>
		</Modal>
	);
}

function formatBytes( bytes ) {
	if ( ! bytes ) {
		return '';
	}
	const units = [ 'B', 'KB', 'MB', 'GB' ];
	let n = bytes;
	let i = 0;
	while ( n >= 1024 && i < units.length - 1 ) {
		n /= 1024;
		i++;
	}
	return `${ n >= 10 || 0 === i ? Math.round( n ) : n.toFixed( 1 ) } ${ units[ i ] }`;
}
