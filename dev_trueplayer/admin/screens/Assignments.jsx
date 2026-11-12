import { useEffect, useState, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Input, Textarea, Field, Modal, OptionMenu, Badge } from '../components/UI';
import { Icon } from '../components/icons';
import UpsellPanel from '../components/UpsellPanel';
import { isPro } from '../pro';
import { __, __sprintf } from '@Utils/translation';

const DEFAULT_EXTENSIONS = [ 'pdf', 'doc', 'docx', 'zip', 'png', 'jpg', 'jpeg' ];

function statusBadge( status ) {
	return 'graded' === status
		? <Badge tone="green">{ __( 'Graded' ) }</Badge>
		: <Badge tone="amber">{ __( 'Needs grading' ) }</Badge>;
}

/** One learner's submission: the file, their note, and the score/feedback form. */
function SubmissionRow( { submission, onGraded } ) {
	const [ score, setScore ] = useState( submission.score ?? '' );
	const [ feedback, setFeedback ] = useState( submission.feedback || '' );
	const [ saving, setSaving ] = useState( false );

	const save = async () => {
		setSaving( true );
		try {
			const updated = await api.gradeSubmission( submission.id, parseFloat( score ) || 0, feedback );
			onGraded( updated );
		} finally {
			setSaving( false );
		}
	};

	return (
		<Card className="p-4">
			<div className="flex items-start justify-between gap-4 mb-3">
				<div className="min-w-0">
					<a className="font-medium text-brand-700 hover:underline break-all" href={ api.submissionFileUrl( submission.id ) } target="_blank" rel="noreferrer">
						{ submission.fileName }
					</a>
					<p className="text-xs text-gray-400 mt-0.5">
						{ submission.submittedAt
							? __sprintf( 'Submitted %s', new Date( submission.submittedAt.replace( ' ', 'T' ) + 'Z' ).toLocaleString() )
							: '' }
						{ ' · ' }
						{ __sprintf( '%1$s %2$s', submission.subject.type, submission.subject.id ) }
					</p>
					{ submission.note && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{ submission.note }</p> }
				</div>
				{ statusBadge( submission.status ) }
			</div>
			<div className="flex items-end gap-3">
				<Field label={ __sprintf( 'Score (/ %s)', submission.maxScore ) } className="w-32">
					<Input type="number" min="0" max={ submission.maxScore } value={ score } onChange={ ( e ) => setScore( e.target.value ) } />
				</Field>
				<Field label={ __( 'Feedback' ) } className="flex-1">
					<Input value={ feedback } onChange={ ( e ) => setFeedback( e.target.value ) } placeholder={ __( 'Optional note back to the learner…' ) } />
				</Field>
				<Button onClick={ save } disabled={ saving }>{ saving ? __( 'Saving…' ) : __( 'Save grade' ) }</Button>
			</div>
		</Card>
	);
}

/** The assignment definition editor, with its submissions/grading list alongside. */
function Editor( { assignment, onBack, onSaved, onEditState } ) {
	const [ title, setTitle ] = useState( assignment.title );
	const [ config, setConfig ] = useState( assignment.config || {} );
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );
	const [ submissions, setSubmissions ] = useState( null );

	useEffect( () => { setToolbarSlot( document.getElementById( 'tp-topbar-slot' ) ); }, [] );
	useEffect( () => {
		api.getAssignmentSubmissions( assignment.id ).then( setSubmissions ).catch( () => setSubmissions( [] ) );
	}, [ assignment.id ] );

	useEffect( () => { onEditState && onEditState( { title, dirty, onBack, onTitleChange: setTitleDirty } ); }, [ title, dirty ] );
	useEffect( () => () => onEditState && onEditState( null ), [] );

	const patch = ( partial ) => { setConfig( ( c ) => ( { ...c, ...partial } ) ); setDirty( true ); setSaved( false ); };
	const setTitleDirty = ( value ) => { setTitle( value ); setDirty( true ); };

	const save = async () => {
		setSaving( true );
		try {
			await api.updateAssignment( assignment.id, { title, config } );
			setDirty( false );
			setSaved( true );
			setTimeout( () => setSaved( false ), 2000 );
			onSaved();
		} finally {
			setSaving( false );
		}
	};

	const setExtensions = ( value ) => patch( {
		allowedExtensions: value.split( ',' ).map( ( s ) => s.trim().toLowerCase() ).filter( Boolean ),
	} );

	const gradedCount = ( submissions || [] ).filter( ( s ) => 'graded' === s.status ).length;

	return (
		<div>
			{ toolbarSlot && createPortal(
				<>
					{ saved && <span className="inline-flex items-center gap-1 text-sm text-green-600"><Icon name="checkmark" className="w-4 h-4" /> { __( 'Saved' ) }</span> }
					<Button onClick={ save } disabled={ saving || ! dirty }>{ saving ? __( 'Saving…' ) : __( 'Save' ) }</Button>
				</>,
				toolbarSlot
			) }

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
				<Card className="p-6">
					<h3 className="font-semibold text-gray-900 mb-4">{ __( 'Assignment' ) }</h3>
					<Field label={ __( 'Title' ) } className="mb-4">
						<Input value={ title } onChange={ ( e ) => setTitleDirty( e.target.value ) } />
					</Field>
					<Field label={ __( 'Instructions' ) } className="mb-4">
						<Textarea rows={ 5 } value={ config.instructions || '' } onChange={ ( e ) => patch( { instructions: e.target.value } ) } placeholder={ __( 'What should the learner submit?' ) } />
					</Field>
					<div className="grid grid-cols-2 gap-4 mb-4">
						<Field label={ __( 'Due date' ) } hint={ __( 'Informational only — not enforced.' ) }>
							<Input type="date" value={ ( config.dueAt || '' ).slice( 0, 10 ) } onChange={ ( e ) => patch( { dueAt: e.target.value } ) } />
						</Field>
						<Field label={ __( 'Max score' ) }>
							<Input type="number" min="1" value={ config.maxScore ?? 100 } onChange={ ( e ) => patch( { maxScore: parseFloat( e.target.value ) || 0 } ) } />
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<Field label={ __( 'Max file size (MB)' ) }>
							<Input type="number" min="1" value={ config.maxFileSizeMb ?? 20 } onChange={ ( e ) => patch( { maxFileSizeMb: parseInt( e.target.value, 10 ) || 1 } ) } />
						</Field>
						<Field label={ __( 'Allowed file types' ) } hint={ __( 'Comma-separated extensions, no dot.' ) }>
							<Input value={ ( config.allowedExtensions || DEFAULT_EXTENSIONS ).join( ', ' ) } onChange={ ( e ) => setExtensions( e.target.value ) } />
						</Field>
					</div>
				</Card>

				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="font-semibold text-gray-900">{ __( 'Submissions' ) }</h3>
						{ submissions && submissions.length > 0 && (
							<Badge tone="gray">{ __sprintf( '%1$d / %2$d graded', gradedCount, submissions.length ) }</Badge>
						) }
					</div>
					{ null === submissions && <p className="text-sm text-gray-400">{ __( 'Loading…' ) }</p> }
					{ submissions && 0 === submissions.length && <p className="text-sm text-gray-400">{ __( 'No submissions yet.' ) }</p> }
					<div className="space-y-3">
						{ ( submissions || [] ).map( ( s ) => (
							<SubmissionRow
								key={ s.id }
								submission={ s }
								onGraded={ ( updated ) => setSubmissions( ( list ) => list.map( ( row ) => ( row.id === updated.id ? updated : row ) ) ) }
							/>
						) ) }
					</div>
				</Card>
			</div>
		</div>
	);
}

export default function Assignments( { onEditState } ) {
	const [ assignments, setAssignments ] = useState( null );
	const [ adding, setAdding ] = useState( false );
	const [ title, setTitle ] = useState( '' );
	const [ busy, setBusy ] = useState( false );
	const [ editing, setEditing ] = useState( null );

	const load = () => api.listAssignments().then( setAssignments );
	useEffect( () => { load(); }, [] );

	const create = async () => {
		setBusy( true );
		try {
			const a = await api.createAssignment( title || __( 'Untitled assignment' ) );
			setTitle( '' );
			setAdding( false );
			await load();
			setEditing( a );
		} finally {
			setBusy( false );
		}
	};

	const remove = async ( id ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( __( 'Delete this assignment? Every submission for it is deleted too.' ) ) ) {
			return;
		}
		await api.deleteAssignment( id );
		load();
	};

	// Pro-only, same as the video editor's Access & gating tab: the whole
	// screen upsells rather than gating field-by-field, since nothing here
	// works at all without trueplayer-pro's assignments addon.
	if ( ! isPro() ) {
		return (
			<UpsellPanel
				title={ __( 'Assignments' ) }
				features={ [
					__( 'An assignment item learners submit a file against' ),
					__( 'Per-learner grading with a score and written feedback' ),
					__( 'Due dates, file-type and size limits' ),
				] }
			/>
		);
	}

	if ( editing ) {
		return <Editor assignment={ editing } onBack={ () => { setEditing( null ); load(); } } onSaved={ load } onEditState={ onEditState } />;
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-ink">{ __( 'Assignments' ) }</h1>
					<p className="text-sm text-muted">{ __( 'A file a learner submits and you grade — link one into a course from the playlist editor.' ) }</p>
				</div>
				<Button onClick={ () => { setTitle( '' ); setAdding( true ); } }><Icon name="plus" className="w-4 h-4" /> { __( 'Add assignment' ) }</Button>
			</div>

			{ adding && (
				<Modal
					title={ __( 'Create assignment' ) }
					onClose={ () => setAdding( false ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setAdding( false ) }>{ __( 'Cancel' ) }</Button>
							<Button onClick={ create } disabled={ busy }>{ busy ? __( 'Creating…' ) : __( 'Create assignment' ) }</Button>
						</>
					}
				>
					<Field label={ __( 'Title' ) }>
						<Input autoFocus value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ ( e ) => 'Enter' === e.key && create() } placeholder={ __( 'e.g. "Submit your draft outline"' ) } />
					</Field>
				</Modal>
			) }

			{ null === assignments && <p className="text-gray-400">{ __( 'Loading…' ) }</p> }
			{ assignments && 0 === assignments.length && (
				<Card className="p-12 text-center border-dashed">
					<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center"><Icon name="edit" className="w-6 h-6" /></div>
					<p className="font-semibold text-gray-900">{ __( 'No assignments yet' ) }</p>
					<p className="text-sm text-gray-500">{ __( 'Create one, then link it into a course from the playlist editor.' ) }</p>
				</Card>
			) }

			<div className="space-y-3">
				{ ( assignments || [] ).map( ( a ) => (
					<Card key={ a.id } className="p-4 flex items-center gap-4 hover:border-brand-200 transition-colors">
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-ink truncate">{ a.title }</div>
							<div className="text-xs text-gray-500">
								{ __sprintf( 'Max score %s', a.config?.maxScore ?? 100 ) }
								{ a.config?.dueAt ? __sprintf( ' · Due %s', a.config.dueAt ) : '' }
							</div>
						</div>
						<OptionMenu items={ [
							{ label: __( 'Edit' ), icon: 'edit', onClick: () => setEditing( a ) },
							{ label: __( 'Delete' ), icon: 'trash', danger: true, onClick: () => remove( a.id ) },
						] } />
					</Card>
				) ) }
			</div>
		</div>
	);
}
