import { useEffect, useRef, useState } from '@wordpress/element';
import { __, __sprintf } from '@Utils/translation';
import { Button, Input } from './UI';
import { Icon } from './icons';
import { FilePicker, Warning, formatBytes } from './UploadFieldParts';
import { api } from '../api';
import { routeUrl } from '../nav';
import { ACCEPTED, uploadToGumlet } from '../utils/gumletUpload';

/**
 * The source field for a video uploaded to Gumlet.
 *
 * Shaped like the Bunny Storage field on purpose — drop a file, browse what is
 * already there, or paste — because the author's problem is the same one. What
 * differs is what happens after the bytes arrive: Bunny serves the file back as
 * it was sent, while Gumlet transcodes it, so this field has a state Bunny's
 * does not need. Transcoding can take minutes and the author is explicitly not
 * held there: the asset id is stored either way and the server resolves the
 * playback URL at render time, so leaving mid-transcode costs nothing.
 *
 * `onChange` receives a partial source object rather than a URL string, since a
 * Gumlet video is identified by its asset id and may legitimately have no URL
 * yet.
 */
export default function GumletField( { value, onChange, type = 'gumletStorage', audio = false } ) {
	// The two types want different things from a connected account: pasting an
	// existing video needs only the API key, uploading a new one also needs to
	// know which collection it lands in.
	const isUpload = 'gumletStorage' === type;
	const [ status, setStatus ] = useState( null ); // null = still asking
	const [ upload, setUpload ] = useState( null ); // { name, percent, stage }
	const [ error, setError ] = useState( '' );
	const [ pasting, setPasting ] = useState( false );
	const [ pasted, setPasted ] = useState( '' );
	const [ resolving, setResolving ] = useState( false );
	const inputRef = useRef( null );
	const token = useRef( { cancelled: false } );

	useEffect( () => {
		let live = true;
		api.gumletStatus()
			.then( ( s ) => live && setStatus( s ) )
			.catch( () => live && setStatus( { configured: false, canUpload: false } ) );
		return () => {
			live = false;
		};
	}, [] );

	// An upload in flight outlives a tab switch inside the editor but not the
	// field being unmounted, so stop it rather than leaving it writing.
	useEffect( () => () => {
		token.current.cancelled = true;
	}, [] );

	/**
	 * Finish resolving a video that was saved before Gumlet had finished with it.
	 *
	 * Encoding outlasts the editing session it started in, so a perfectly good
	 * video can be stored with an asset id and no playback URL. Reopening the
	 * editor is the natural moment to ask again — otherwise the author is left
	 * looking at a video that never becomes playable and has no way to prompt
	 * it. Runs once per asset: `asked` keeps a re-render from re-asking.
	 */
	const asked = useRef( '' );
	useEffect( () => {
		const id = value?.assetId;
		if ( ! id || asked.current === id || ( value.src && 'ready' === value.status ) ) {
			return;
		}
		asked.current = id;
		let live = true;
		api.gumletAsset( id )
			.then( ( a ) => {
				if ( ! live || ! a.ready ) {
					return;
				}
				onChange( {
					src: a.playbackUrl || '',
					status: 'ready',
					...( a.duration ? { duration: a.duration } : {} ),
					// Only when the author hasn't chosen their own.
					...( a.thumbnail && ! value.poster ? { poster: a.thumbnail } : {} ),
				} );
			} )
			.catch( () => {} );
		return () => {
			live = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ value?.assetId, value?.src, value?.status ] );

	const send = async ( file ) => {
		if ( ! file ) {
			return;
		}
		setError( '' );
		token.current = { cancelled: false };
		setUpload( { name: file.name, percent: 0, stage: 'uploading' } );
		try {
			const stored = await uploadToGumlet( file, {
				token: token.current,
				onProgress: ( percent ) => setUpload( ( u ) => ( u ? { ...u, percent } : u ) ),
				onStage: ( stage ) => setUpload( ( u ) => ( u ? { ...u, stage } : u ) ),
			} );
			onChange( {
				assetId: stored.assetId,
				src: stored.src || '',
				status: stored.status,
				fileName: stored.fileName,
				fileSize: stored.fileSize,
				...( stored.poster ? { poster: stored.poster } : {} ),
			} );
		} catch ( e ) {
			if ( ! token.current.cancelled ) {
				setError( e.message || __( 'That file could not be uploaded.' ) );
			}
		} finally {
			setUpload( null );
		}
	};

	/** Resolve whatever was pasted — a bare id, an embed URL or a playback URL. */
	const resolve = async ( input ) => {
		const raw = ( input || '' ).trim();
		if ( ! raw ) {
			return;
		}
		setError( '' );
		setResolving( true );
		try {
			const a = await api.gumletAsset( raw );
			onChange( {
				assetId: a.assetId,
				src: a.playbackUrl || '',
				status: a.ready ? 'ready' : 'processing',
				...( a.duration ? { duration: a.duration } : {} ),
				...( a.thumbnail ? { poster: a.thumbnail } : {} ),
			} );
			setPasting( false );
			setPasted( '' );
		} catch ( e ) {
			setError( e.message || __( 'That video could not be found in your Gumlet workspace.' ) );
		} finally {
			setResolving( false );
		}
	};

	const onDrop = ( e ) => {
		e.preventDefault();
		if ( ! upload ) {
			send( e.dataTransfer.files?.[ 0 ] );
		}
	};

	// Uploading, then transcoding. Two stages with one bar, because to the
	// author it is one wait — but they are named apart, since only the first
	// requires the tab to stay open and saying so wrongly either strands them
	// here or loses their upload.
	if ( upload ) {
		const processing = 'processing' === upload.stage;
		return (
			<div className="border border-line rounded-card p-4">
				<div className="flex items-center gap-3">
					<span className="text-sm text-ink truncate flex-1">{ upload.name }</span>
					<span className="text-sm tabular-nums text-muted">{ __sprintf( '%d%%', upload.percent ) }</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={ () => {
							token.current.cancelled = true;
							token.current.xhr?.abort();
						} }
					>
						{ __( 'Cancel' ) }
					</Button>
				</div>
				<div className="mt-2.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
					<div
						className={ `h-full bg-brand-500 transition-[width] duration-200 ${ processing ? 'animate-pulse' : '' }` }
						style={ { width: `${ upload.percent }%` } }
					/>
				</div>
				<p className="text-xs text-muted !mt-2">
					{ processing
						? __( 'Uploaded. Gumlet is encoding it now — you can save and carry on; it will play once encoding finishes.' )
						: __( 'Sending to Gumlet — keep this tab open.' ) }
				</p>
			</div>
		);
	}

	// Chosen — show what it is and how to change it.
	if ( value?.assetId ) {
		const pending = 'ready' !== value.status && ! value.src;
		return (
			<>
				<div className="flex items-center gap-3 border border-line rounded-card px-3 py-2.5">
					<Icon name={ audio ? 'music' : 'film' } className="w-4 h-4 text-muted shrink-0" />
					<span className="min-w-0 flex-1">
						<span className="block text-sm text-ink truncate">{ value.fileName || value.assetId }</span>
						<span className="block text-xs text-muted truncate">{ value.src || value.assetId }</span>
					</span>
					{ status?.canUpload && (
						<Button variant="ghost" size="sm" onClick={ () => inputRef.current?.click() }>{ __( 'Replace' ) }</Button>
					) }
					<Button variant="ghost" size="sm" onClick={ () => onChange( { assetId: '', src: '', status: '', fileName: '', fileSize: 0 } ) }>{ __( 'Remove' ) }</Button>
				</div>
				<FilePicker inputRef={ inputRef } onPick={ send } accept={ ACCEPTED } />
				{ error && <p className="text-xs text-danger !mt-1.5">{ error }</p> }
				{ pending && <Warning text={ audio ? __( 'Gumlet is still encoding this file. It is saved and will start playing on its own once encoding finishes — no need to re-upload.' ) : __( 'Gumlet is still encoding this video. It is saved and will start playing on its own once encoding finishes — no need to re-upload.' ) } /> }
			</>
		);
	}

	// Which affordance belongs here depends on whether Gumlet is connected, so
	// hold the space until the answer arrives rather than offering an upload
	// button that turns into a paste box a moment later.
	if ( ! status ) {
		return <div className="border border-line rounded-card px-3 py-6 text-center text-sm text-muted">{ __( 'Checking your Gumlet workspace…' ) }</div>;
	}

	/**
	 * Nothing is offered until the account behind it exists.
	 *
	 * An upload box with no API key behind it, or a paste box that will answer
	 * every ID with "not found", is worse than no field: it invites the author
	 * to do the work twice and only tells them it was pointless afterwards. So
	 * the field is replaced by what has to happen first, with the way to do it.
	 */
	if ( ! status.configured ) {
		return (
			<NotConnected
				title={ __( 'Gumlet isn’t connected yet' ) }
				body={ __( 'Add your Gumlet API key and this source will be ready to use. Nothing else about this video is affected in the meantime.' ) }
			/>
		);
	}

	// Connected, but uploading also needs somewhere to put the file. Pasting an
	// existing video still works without it, which is what the Gumlet Stream
	// source type is for — so say that rather than just refusing.
	if ( isUpload && ! status.canUpload ) {
		return (
			<NotConnected
				title={ __( 'Gumlet needs a collection ID' ) }
				body={ __( 'Uploading has to know which workspace the video lands in. Add your collection ID to upload from here — or switch this video’s source type to Gumlet Stream to use a video you have already uploaded.' ) }
			/>
		);
	}

	// Gumlet Stream: the video already exists, so the whole job is naming it.
	if ( ! isUpload ) {
		return (
			<>
				{ /* Resolved on blur rather than per keystroke: an ID is pasted in
				     one go, and looking one up on every character would ask Gumlet
				     about two dozen prefixes that were never meant to be valid. */ }
				<Input
					value={ pasted }
					onChange={ ( e ) => setPasted( e.target.value ) }
					onBlur={ () => resolve( pasted ) }
					placeholder={ audio ? __( 'Gumlet asset ID or URL' ) : __( 'Gumlet video ID or URL' ) }
				/>
				{ resolving && <p className="text-xs text-muted !mt-1.5">{ __( 'Looking it up…' ) }</p> }
				{ error && <p className="text-xs text-danger !mt-1.5">{ error }</p> }
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
				className="w-full border border-dashed border-line rounded-card px-3 py-7 text-center hover:border-brand-200 hover:bg-gray-50 transition-colors"
			>
				<Icon name="upload" className="w-5 h-5 mx-auto text-muted" />
				<span className="block text-sm text-ink !mt-2">{ audio ? __( 'Upload audio to Gumlet' ) : __( 'Upload a video to Gumlet' ) }</span>
				<span className="block text-xs text-muted !mt-0.5">
					{ status.maxBytes
						? __sprintf( 'or drop it here · up to %s', formatBytes( status.maxBytes ) )
						: __( 'or drop it here' ) }
				</span>
			</button>

			<div className="flex items-center gap-3 !mt-2">
				<button type="button" className="text-xs text-brand-500 hover:underline" onClick={ () => setPasting( ( v ) => ! v ) }>
					{ __( 'Paste an ID instead' ) }
				</button>
			</div>

			{ pasting && (
				<div className="!mt-2">
					<Input
						value={ pasted }
						onChange={ ( e ) => setPasted( e.target.value ) }
						onBlur={ () => resolve( pasted ) }
						placeholder={ audio ? __( 'Gumlet asset ID or URL' ) : __( 'Gumlet video ID or URL' ) }
					/>
					{ resolving && <p className="text-xs text-muted !mt-1.5">{ __( 'Looking it up…' ) }</p> }
				</div>
			) }

			<FilePicker inputRef={ inputRef } onPick={ send } accept={ ACCEPTED } />
			{ error && <p className="text-xs text-danger !mt-1.5">{ error }</p> }

		</>
	);
}

/**
 * Shown in place of the field when the account behind it isn't ready.
 *
 * Deliberately not styled as an error: nothing has gone wrong, a step simply
 * hasn't happened yet. It states what is missing and links straight to the
 * screen that fixes it, rather than naming a settings path and leaving the
 * author to go find it.
 */
function NotConnected( { title, body } ) {
	return (
		<div className="border border-dashed border-line rounded-card px-4 py-6 text-center bg-gray-50">
			<Icon name="cloud" className="w-5 h-5 mx-auto text-muted" />
			<p className="text-sm font-medium text-ink !mt-2 !mb-1">{ title }</p>
			<p className="text-xs text-muted leading-5 !m-0 max-w-sm mx-auto">{ body }</p>
			{ /* A real link, not a pushState nav: this component has no route
			     context, and the editor's own unsaved-changes guard already
			     covers a hard navigation away (see App.jsx beforeunload). */ }
			<Button
				variant="secondary"
				size="sm"
				className="!mt-3"
				onClick={ () => {
					window.location.href = routeUrl( 'settings', { tab: 'sources' } );
				} }
			>
				{ __( 'Open Sources & CDN settings' ) }
			</Button>
		</div>
	);
}
