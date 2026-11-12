import { useEffect, useState } from '@wordpress/element';
import { rest } from '@Utils/rest';
import { __, __sprintf } from '@Utils/translation';

/**
 * Renders in place of the video player when the active playlist item is an
 * assignment rather than a video: the brief, a file-upload form, and — once
 * a submission exists — its status/grade instead of the form. Unlike a
 * video there is nothing to lazy-load here, so Playlist.jsx mounts this
 * directly with no facade/boot gating.
 */
export default function AssignmentPanel( { assignmentId, title } ) {
	const [ assignment, setAssignment ] = useState( null );
	const [ submission, setSubmission ] = useState( null );
	const [ file, setFile ] = useState( null );
	const [ note, setNote ] = useState( '' );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		rest.get( `assignments/${ assignmentId }` ).then( setAssignment ).catch( () => setAssignment( { config: {} } ) );
		rest.get( `assignments/${ assignmentId }/submission` ).then( ( r ) => setSubmission( r.submission || null ) ).catch( () => setSubmission( null ) );
		setFile( null );
		setNote( '' );
		setError( '' );
	}, [ assignmentId ] );

	const submit = async ( e ) => {
		e.preventDefault();
		if ( ! file ) {
			setError( __( 'Choose a file first.' ) );
			return;
		}
		setBusy( true );
		setError( '' );
		try {
			const form = new FormData();
			form.append( 'file', file );
			form.append( 'note', note );
			const result = await rest.postForm( `assignments/${ assignmentId }/submit`, form );
			setSubmission( result );
			setFile( null );
		} catch ( err ) {
			setError( err.message );
		} finally {
			setBusy( false );
		}
	};

	const config = ( assignment && assignment.config ) || {};
	const maxMb = config.maxFileSizeMb || 20;
	const allowed = config.allowedExtensions || [];
	const heading = title || ( assignment && assignment.title ) || __( 'Assignment' );

	return (
		<div className="tp-assignment">
			<h3 className="tp-assignment-title">{ heading }</h3>
			{ config.instructions && <p className="tp-assignment-instructions">{ config.instructions }</p> }
			{ config.dueAt && <p className="tp-assignment-due">{ __sprintf( 'Due %s', config.dueAt ) }</p> }

			{ submission ? (
				<div className="tp-assignment-submission">
					<p className="tp-assignment-file">
						<a href={ submission.downloadUrl } target="_blank" rel="noreferrer">{ submission.fileName }</a>
					</p>
					{ 'graded' === submission.status ? (
						<div className="tp-assignment-grade">
							<p>{ __sprintf( 'Grade: %1$s / %2$s', submission.score, submission.maxScore ) }</p>
							{ submission.feedback && <p className="tp-assignment-feedback">{ submission.feedback }</p> }
						</div>
					) : (
						<p className="tp-assignment-pending">{ __( 'Submitted — waiting to be graded.' ) }</p>
					) }
					<button type="button" className="tp-assignment-resubmit" onClick={ () => setSubmission( null ) }>
						{ __( 'Submit a different file' ) }
					</button>
				</div>
			) : (
				<form className="tp-assignment-form" onSubmit={ submit }>
					<input
						type="file"
						onChange={ ( e ) => setFile( e.target.files && e.target.files[ 0 ] ? e.target.files[ 0 ] : null ) }
						accept={ allowed.length ? allowed.map( ( ext ) => `.${ ext }` ).join( ',' ) : undefined }
					/>
					<textarea
						className="tp-assignment-note"
						value={ note }
						onChange={ ( e ) => setNote( e.target.value ) }
						placeholder={ __( 'Add a note (optional)…' ) }
					/>
					<p className="tp-assignment-hint">
						{ __sprintf( 'Max %s MB.', maxMb ) }
						{ allowed.length ? ' ' + __sprintf( 'Allowed: %s', allowed.join( ', ' ) ) : '' }
					</p>
					{ error && <p className="tp-assignment-error">{ error }</p> }
					<button type="submit" className="tp-assignment-submit" disabled={ busy }>
						{ busy ? __( 'Submitting…' ) : __( 'Submit' ) }
					</button>
				</form>
			) }
		</div>
	);
}
