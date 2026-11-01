import { createInterpolateElement, useEffect, useState } from '@wordpress/element';
import { Card, Field, Input, Select, Toggle, Button, Badge } from '../../components/UI';
import { Icon } from '../../components/icons';
import { api } from '../../api';
import { BsTrash } from 'react-icons/bs';
import { resolveCustomize } from '@Player/customize';
import { __, __sprintf, _nSprintf } from '@Utils/translation';

const uid = () => Math.random().toString( 36 ).slice( 2, 9 );

/**
 * Hides the "Course completion (Academy LMS)" card in the Questions & gating
 * tab. The <LmsLink> component below and everything behind it (the lms/options
 * endpoint, the academy-sync addon, any `config.lms` already saved on a video)
 * are untouched — this only controls whether the card is offered in the editor.
 * Flip to true to show it again.
 */
const SHOW_LMS_LINK = false;

/**
 * Video → Academy course/lesson link. When set, the academy-sync pro addon
 * gates playback by enrollment and marks the mapped lesson complete when the
 * viewer passes watch-verification / the quiz.
 */
function LmsLink( { config, patch } ) {
	const lms = config.lms || {};
	const [ opts, setOpts ] = useState( null );
	useEffect( () => { api.getLmsOptions().then( setOpts ).catch( () => setOpts( { available: false, courses: [] } ) ); }, [] );

	const set = ( partial ) => patch( { lms: { ...lms, ...partial } } );
	const enabled = ( lms.provider || '' ) === 'academy';

	// Lessons belong to a course, so the list follows the course picker — every
	// lesson on the site in one dropdown made it easy to attach the wrong one.
	const courses = ( opts && opts.courses ) || [];
	const course = courses.find( ( c ) => c.id === lms.course );
	const lessons = course ? course.lessons || [] : [];

	if ( opts && ! opts.available ) {
		return (
			<Card className="p-6 max-w-2xl">
				<h3 className="font-semibold text-gray-900 mb-1">{ __( 'Course completion (LMS)' ) }</h3>
				<p className="text-sm text-gray-400">{ __( 'Install Academy LMS to link this video to a course lesson.' ) }</p>
			</Card>
		);
	}

	return (
		<Card className="p-6 max-w-2xl">
			<h3 className="font-semibold text-gray-900 mb-1">{ __( 'Course completion (Academy LMS)' ) }</h3>
			<p className="text-sm text-gray-500 mb-4">{ __( 'Link this video to a lesson: gate it by enrollment and mark it complete when watched/passed.' ) }</p>
			<Toggle checked={ enabled } onChange={ ( v ) => set( { provider: v ? 'academy' : '' } ) } label={ __( 'Link to an Academy course' ) } />
			{ enabled && (
				<div className="mt-4 space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<Field label={ __( 'Course' ) }>
							{ /* Changing the course clears the lesson — a lesson id from
							     the previous course would complete the wrong topic. */ }
							<Select value={ lms.course || '' } onChange={ ( e ) => set( { course: parseInt( e.target.value, 10 ) || 0, topic: 0 } ) }>
								<option value="">{ __( '— select —' ) }</option>
								{ courses.map( ( c ) => <option key={ c.id } value={ c.id }>{ c.title }</option> ) }
							</Select>
						</Field>
						<Field
							label={ __( 'Lesson' ) }
							hint={ ! lms.course ? __( 'Pick a course first.' ) : ( ! lessons.length ? __( 'This course has no lessons in its curriculum yet.' ) : __( 'Marked complete when the viewer completes this video.' ) ) }
						>
							<Select
								value={ lms.topic || '' }
								disabled={ ! lessons.length }
								onChange={ ( e ) => set( { topic: parseInt( e.target.value, 10 ) || 0, topicType: 'lesson' } ) }
							>
								<option value="">{ __( '— select —' ) }</option>
								{ lessons.map( ( l ) => <option key={ l.id } value={ l.id }>{ l.title }</option> ) }
							</Select>
						</Field>
					</div>
					<Toggle checked={ lms.gateAccess !== false } onChange={ ( v ) => set( { gateAccess: v } ) } label={ __( 'Block playback for non-enrolled viewers' ) } />
				</div>
			) }
		</Card>
	);
}

function QuestionList( { questions, onChange } ) {
	// Same collapsed-summary / click-to-expand accordion as the checkpoint
	// list above (and QuizPress's own Questions-step builder) — a newly
	// added question opens by default.
	const [ openQuestions, setOpenQuestions ] = useState( () => new Set() );
	const toggleOpen = ( id ) =>
		setOpenQuestions( ( open ) => {
			const next = new Set( open );
			next.has( id ) ? next.delete( id ) : next.add( id );
			return next;
		} );

	const setQ = ( i, partial ) => onChange( questions.map( ( q, idx ) => ( idx === i ? { ...q, ...partial } : q ) ) );
	const addQ = () => {
		const id = uid();
		onChange( [
			...questions,
			{ id, type: 'mcq', prompt: '', options: [ { id: uid(), label: '' }, { id: uid(), label: '' } ], correct: '' },
		] );
		setOpenQuestions( ( open ) => new Set( open ).add( id ) );
	};
	const removeQ = ( i ) => onChange( questions.filter( ( _, idx ) => idx !== i ) );

	const setOpt = ( qi, oi, label ) => {
		const q = questions[ qi ];
		const options = q.options.map( ( o, idx ) => ( idx === oi ? { ...o, label } : o ) );
		setQ( qi, { options } );
	};
	const addOpt = ( qi ) => setQ( qi, { options: [ ...questions[ qi ].options, { id: uid(), label: '' } ] } );
	const removeOpt = ( qi, oi ) => {
		const q = questions[ qi ];
		setQ( qi, { options: q.options.filter( ( _, idx ) => idx !== oi ) } );
	};

	// Native HTML5 drag reorder — same as the checkpoint list above. The
	// source index rides in the drag event's own dataTransfer payload rather
	// than being read back out of React state at drop time, which is what
	// made the checkpoint list's first version silently fail to reorder.
	const [ dragIndex, setDragIndex ] = useState( null );
	const [ overIndex, setOverIndex ] = useState( null );
	const reorderQ = ( from, to ) => {
		if ( null === from || null === to || Number.isNaN( from ) || from === to ) {
			return;
		}
		const next = [ ...questions ];
		const [ moved ] = next.splice( from, 1 );
		next.splice( to, 0, moved );
		onChange( next );
	};

	return (
		<div className="space-y-3">
			{ questions.map( ( q, qi ) => {
				const isOpen = openQuestions.has( q.id );
				const typeLabel = 'boolean' === q.type ? __( 'True / False' ) : __( 'Multiple choice' );
				return (
					<div
						key={ q.id }
						draggable
						onDragStart={ ( e ) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData( 'text/plain', String( qi ) ); setDragIndex( qi ); } }
						onDragOver={ ( e ) => { e.preventDefault(); if ( overIndex !== qi ) { setOverIndex( qi ); } } }
						onDrop={ ( e ) => { e.preventDefault(); reorderQ( parseInt( e.dataTransfer.getData( 'text/plain' ), 10 ), qi ); setDragIndex( null ); setOverIndex( null ); } }
						onDragEnd={ () => { setDragIndex( null ); setOverIndex( null ); } }
						className={ `border rounded-lg bg-white transition ${ overIndex === qi && dragIndex !== qi ? 'border-brand-400 ring-2 ring-brand-100' : 'border-line' } ${ dragIndex === qi ? 'opacity-50' : '' }` }
					>
						<div
							className={ `flex items-center gap-2 p-3 cursor-pointer ${ isOpen ? 'border-b border-solid border-line' : '' }` }
							onClick={ () => toggleOpen( q.id ) }
						>
							<span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none px-0.5" title={ __( 'Drag to reorder' ) } aria-hidden="true">⠿</span>
							<Icon name="chevronRight" className={ `w-4 h-4 text-gray-400 shrink-0 transition-transform ${ isOpen ? 'rotate-90' : '' }` } />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-ink truncate">{ q.prompt || __sprintf( 'Question %d', qi + 1 ) }</p>
								<p className="text-xs text-gray-400 truncate">{ __sprintf( 'Q%1$d · %2$s', qi + 1, typeLabel ) }</p>
							</div>
							<Button variant="danger" size="sm" onClick={ ( e ) => { e.stopPropagation(); removeQ( qi ); } }><BsTrash /></Button>
						</div>
						{ isOpen && (
							<div className="p-3">
								<div className="flex gap-2 items-center mb-3">
									<span className="text-sm font-semibold text-gray-500">{ __sprintf( 'Q%d', qi + 1 ) }</span>
									<Select className="w-40" value={ q.type } onChange={ ( e ) => setQ( qi, { type: e.target.value, correct: '' } ) }>
										<option value="mcq">{ __( 'Multiple choice' ) }</option>
										<option value="boolean">{ __( 'True / False' ) }</option>
									</Select>
								</div>
								<Input className="mb-3" value={ q.prompt } onChange={ ( e ) => setQ( qi, { prompt: e.target.value } ) } placeholder={ __( 'Question prompt…' ) } />

								{ q.type === 'boolean' ? (
									<Field label={ __( 'Correct answer' ) }>
										<Select className="w-40" value={ q.correct } onChange={ ( e ) => setQ( qi, { correct: e.target.value } ) }>
											<option value="">{ __( '— pick —' ) }</option>
											<option value="true">{ __( 'True' ) }</option>
											<option value="false">{ __( 'False' ) }</option>
										</Select>
									</Field>
								) : (
									<div>
										<span className="block text-xs text-gray-500 mb-2">{ __( 'Options (select the correct one)' ) }</span>
										<div className="space-y-2">
											{ q.options.map( ( o, oi ) => (
												<div key={ o.id } className="flex gap-2 items-center">
													<input type="radio" name={ `correct-${ q.id }` } checked={ q.correct === o.id } onChange={ () => setQ( qi, { correct: o.id } ) } />
													<Input value={ o.label } onChange={ ( e ) => setOpt( qi, oi, e.target.value ) } placeholder={ __sprintf( 'Option %d', oi + 1 ) } />
													{ q.options.length > 2 && <Button variant="danger" onClick={ () => removeOpt( qi, oi ) }><BsTrash /></Button> }
												</div>
											) ) }
										</div>
										<Button variant="ghost" className="mt-2" onClick={ () => addOpt( qi ) }>{ __( '+ Option' ) }</Button>
									</div>
								) }
							</div>
						) }
					</div>
				);
			} ) }
			<Button variant="ghost" onClick={ addQ }>{ __( '+ Add question' ) }</Button>
		</div>
	);
}

const QUIZPRESS_FEEDBACK_MODE_LABELS = {
	default: __( 'one attempt only' ),
	retry_mode: __( 'retries allowed' ),
};

/**
 * Question source for one checkpoint/final quiz: authored here (native, 2
 * question types) or picked from an existing QuizPress quiz — QuizPress owns
 * authoring, question types and grading for that case; TruePlayer only gates
 * on pass/fail (see GradingService::grade_quizpress).
 */
function QuizSourceFields( { quiz, quizpressOpts, onChange } ) {
	const source  = 'quizpress' === quiz.source ? 'quizpress' : 'native';
	const quizzes = ( quizpressOpts && quizpressOpts.quizzes ) || [];
	const selectedQuiz = quizzes.find( ( q ) => q.id === quiz.quizpressId );

	const quizpressReady = ! quizpressOpts || quizpressOpts.available;

	return (
		<div>
			<div className="flex gap-3 items-start mb-3">
				<Field label={ __( 'Questions' ) } className={ 'quizpress' === source && quizpressReady ? 'w-64 shrink-0' : '' }>
					<Select
						className={ 'quizpress' === source && quizpressReady ? '' : 'w-64' }
						value={ source }
						onChange={ ( e ) => onChange( { source: 'quizpress' === e.target.value ? 'quizpress' : 'native' } ) }
					>
						<option value="native">{ __( 'Author here' ) }</option>
						<option value="quizpress">{ __( 'Use a QuizPress quiz' ) }</option>
					</Select>
				</Field>
				{ 'quizpress' === source && quizpressReady && (
					<Field label={ __( 'Quiz' ) } className="flex-1" hint={ __( 'Question types, scoring and feedback all come from QuizPress.' ) }>
						<Select value={ quiz.quizpressId || '' } onChange={ ( e ) => onChange( { quizpressId: parseInt( e.target.value, 10 ) || 0 } ) }>
							<option value="">{ __( '— select —' ) }</option>
							{ quizzes.map( ( q ) => (
								<option key={ q.id } value={ q.id }>
									{ q.title }{ q.hasManualReview ? __( ' — has manual-review questions' ) : '' }
								</option>
							) ) }
						</Select>
					</Field>
				) }
			</div>
			{ 'quizpress' === source ? (
				quizpressOpts && ! quizpressOpts.available ? (
					<p className="text-sm text-gray-400">{ __( 'Install QuizPress to link a quiz here.' ) }</p>
				) : (
					<>
						{ selectedQuiz && (
							<div className="mb-4 rounded-lg border border-solid border-line bg-gray-50 p-3 text-sm text-gray-700">
								<p className="mb-1">
									{ createInterpolateElement(
										__sprintf( '<b>Passing grade:</b> %d%%', selectedQuiz.passingGrade || 0 ),
										{ b: <strong /> }
									) }
									{ ' · ' }
									{ createInterpolateElement(
										__sprintf(
											'<b>QuizPress attempts:</b> %s',
											selectedQuiz.maxAttempts ? selectedQuiz.maxAttempts : __( 'Unlimited' )
										),
										{ b: <strong /> }
									) }
									{ selectedQuiz.feedbackMode && QUIZPRESS_FEEDBACK_MODE_LABELS[ selectedQuiz.feedbackMode ]
										? __sprintf( ' (%s)', QUIZPRESS_FEEDBACK_MODE_LABELS[ selectedQuiz.feedbackMode ] )
										: '' }
								</p>
								<p className="text-xs text-gray-500">
									{ __( 'Set on the quiz itself in QuizPress — this checkpoint\'s own "Pass %" field isn\'t used for a QuizPress quiz. QuizPress\'s attempt limit above is separate from TruePlayer\'s own "Max quiz attempts" (Watch verification, above): that one still applies too and locks the whole video (requiring a rewatch) independently, once it\'s reached.' ) }
								</p>
							</div>
						) }
						{ selectedQuiz && selectedQuiz.hasManualReview && (
							<div className="mb-4 rounded-lg border border-solid border-warning bg-warning-light p-3 text-sm text-warning">
								{ createInterpolateElement(
									__( "<b>Heads up:</b> this quiz includes a manually-reviewed question type (short answer, paragraph, date, or number). QuizPress won't mark an attempt passed or failed until an admin reviews it in <i>QuizPress → Quiz Insights</i> — until then, a viewer gated on this quiz can't complete the video." ),
									{ b: <strong />, i: <em /> }
								) }
							</div>
						) }
					</>
				)
			) : (
				<QuestionList questions={ quiz.questions || [] } onChange={ ( questions ) => onChange( { questions } ) } />
			) }
		</div>
	);
}

/**
 * One collapsible checkpoint row — mirrors QuizPress's own Questions-step
 * accordion in the quiz builder (collapsed summary, click to expand into the
 * full editor) and reuses the same drag-to-reorder pattern already used for
 * playlist items (Playlists.jsx: native HTML5 drag, no added dependency).
 */
function CheckpointRow( {
	cp,
	index,
	isOpen,
	onToggle,
	onChange,
	onRemove,
	quizpressOpts,
	isDragging,
	isOver,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
} ) {
	const questionCount = ( cp.questions || [] ).length;
	const quizpressTitle = 'quizpress' === cp.source
		? ( ( quizpressOpts && quizpressOpts.quizzes ) || [] ).find( ( q ) => q.id === cp.quizpressId )?.title
		: null;
	const summary = 'quizpress' === cp.source
		? ( quizpressTitle || __( 'No QuizPress quiz selected yet' ) )
		: _nSprintf( '%d question', '%d questions', questionCount );

	return (
		<div
			draggable
			onDragStart={ onDragStart }
			onDragOver={ onDragOver }
			onDrop={ onDrop }
			onDragEnd={ onDragEnd }
			className={ `border rounded-lg bg-white transition ${ isOver ? 'border-brand-400 ring-2 ring-brand-100' : 'border-line' } ${ isDragging ? 'opacity-50' : '' }` }
		>
			<div
				className={ `flex items-center gap-2 p-3 cursor-pointer ${ isOpen ? 'border-b border-solid border-line' : '' }` }
				onClick={ onToggle }
			>
				<span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none px-0.5" title={ __( 'Drag to reorder' ) } aria-hidden="true">⠿</span>
				<Icon name="chevronRight" className={ `w-4 h-4 text-gray-400 shrink-0 transition-transform ${ isOpen ? 'rotate-90' : '' }` } />
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-ink truncate">{ cp.title || __sprintf( 'Checkpoint %d', index + 1 ) }</p>
					<p className="text-xs text-gray-400 truncate">{ __sprintf( 'At %1$ds · %2$s', cp.at, summary ) }</p>
				</div>
				<Button variant="danger" size="sm" onClick={ ( e ) => { e.stopPropagation(); onRemove(); } }><BsTrash /></Button>
			</div>
			{ isOpen && (
				<div className="p-3">
					<div className="flex gap-2 items-end mb-3">
						<Field label={ __( 'At (seconds)' ) }><Input type="number" className="w-28" value={ cp.at } onChange={ ( e ) => onChange( { at: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
						{ 'quizpress' !== cp.source && (
							<Field label={ __( 'Pass %' ) }><Input type="number" className="w-24" value={ cp.passPercent } onChange={ ( e ) => onChange( { passPercent: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
						) }
						<div className="flex-1"><Field label={ __( 'Title' ) }><Input value={ cp.title || '' } onChange={ ( e ) => onChange( { title: e.target.value } ) } placeholder={ __( 'Checkpoint' ) } /></Field></div>
					</div>
					<QuizSourceFields quiz={ cp } quizpressOpts={ quizpressOpts } onChange={ onChange } />
				</div>
			) }
		</div>
	);
}

/**
 * The site-wide watch-verification policy (Settings → Enforcement), which this
 * tab inherits from. Localized by PHP so both sides agree on one set of
 * defaults — see Helper::enforcement_defaults().
 */
function sitePolicy() {
	const e = ( window.TruePlayerGlobal && window.TruePlayerGlobal.enforcement ) || {};
	return {
		completionThreshold: typeof e.completionThreshold === 'number' ? e.completionThreshold : 90,
		antiSkip: e.antiSkip !== undefined ? !! e.antiSkip : true,
		maxAttempts: typeof e.maxAttempts === 'number' ? e.maxAttempts : 3,
		onFail: 'never_lock' === e.onFail ? 'never_lock' : 'lock_retry_after_rewatch',
		requireLoginForGate: !! e.requireLogin,
	};
}

// Mirrors Helper::ON_FAIL_POLICIES — the enforcing copy.
const ON_FAIL_POLICIES = [
	{ value: 'lock_retry_after_rewatch', label: __( 'Lock the video — re-watch it to earn another try' ) },
	{ value: 'never_lock', label: __( 'Nothing — let them keep retrying' ) },
];

// Keys this tab inherits from the site policy. Everything else on `gating`
// (checkpoints, finalQuiz, …) is this video's own content and always persists.
const POLICY_KEYS = [ 'completionThreshold', 'antiSkip', 'maxAttempts', 'onFail', 'requireLoginForGate' ];

export default function GatingTab( { config, patch } ) {
	// Anti-skip is redundant while the Rapid Engage Bar is on — that locks the
	// timeline outright, so "block seeking past unwatched parts" has nothing
	// left to block. Resolved the way the player resolves it so a value
	// inherited from a preset or the site-wide layer counts too.
	const rapidOn = 'rapid-engage' === resolveCustomize( config ).appearance.seekBarStyle;
	const policy = sitePolicy();
	const [ quizpressOpts, setQuizpressOpts ] = useState( null );
	useEffect( () => { api.getQuizpressOptions().then( setQuizpressOpts ).catch( () => setQuizpressOpts( { available: false, quizzes: [] } ) ); }, [] );
	const gating = {
		...policy,
		checkpoints: [],
		finalQuiz: null,
		...( config.gating || {} ),
	};

	/**
	 * Persist only genuine overrides.
	 *
	 * This tab used to seed hardcoded defaults and write the whole object back,
	 * so merely opening it stamped `requireLoginForGate: false` onto the video —
	 * which then shadowed the site-wide "Require login to watch" for good, with
	 * nothing in the UI to say so. A policy key that still matches the site
	 * value is dropped instead, leaving the video to inherit it.
	 */
	const set = ( partial ) => {
		const next = { ...gating, ...partial };
		POLICY_KEYS.forEach( ( key ) => {
			if ( next[ key ] === policy[ key ] ) {
				delete next[ key ];
			}
		} );
		patch( { gating: next } );
	};

	// Which checkpoint accordion rows are expanded — a newly added checkpoint
	// opens by default, same as QuizPress's own Questions-step builder.
	const [ openCheckpoints, setOpenCheckpoints ] = useState( () => new Set() );
	const toggleCheckpointOpen = ( id ) =>
		setOpenCheckpoints( ( open ) => {
			const next = new Set( open );
			next.has( id ) ? next.delete( id ) : next.add( id );
			return next;
		} );

	const addCheckpoint = () => {
		const id = uid();
		set( { checkpoints: [ ...gating.checkpoints, { id, at: 30, title: '', passPercent: 70, questions: [] } ] } );
		setOpenCheckpoints( ( open ) => new Set( open ).add( id ) );
	};
	const setCheckpoint = ( i, partial ) =>
		set( { checkpoints: gating.checkpoints.map( ( c, idx ) => ( idx === i ? { ...c, ...partial } : c ) ) } );
	const removeCheckpoint = ( i ) => set( { checkpoints: gating.checkpoints.filter( ( _, idx ) => idx !== i ) } );

	// Native HTML5 drag reorder. The source index rides in the drag event's own
	// dataTransfer payload (the standard way to do this) rather than being read
	// back out of React state at drop time — reading it from state instead (the
	// playlist editor's approach) depends on a state update having flushed and
	// re-rendered new closures onto the drop target before the drop fires,
	// which raced and silently dropped reorders here. dragIndex/overIndex below
	// still exist, but purely for the drag-source/drag-over highlight styling.
	const [ dragIndex, setDragIndex ] = useState( null );
	const [ overIndex, setOverIndex ] = useState( null );
	const reorderCheckpoints = ( from, to ) => {
		if ( null === from || null === to || Number.isNaN( from ) || from === to ) {
			return;
		}
		const next = [ ...gating.checkpoints ];
		const [ moved ] = next.splice( from, 1 );
		next.splice( to, 0, moved );
		set( { checkpoints: next } );
	};

	const toggleFinal = ( on ) => set( { finalQuiz: on ? { title: __( 'Final quiz' ), passPercent: 70, questions: [] } : null } );
	const setFinal = ( partial ) => set( { finalQuiz: { ...gating.finalQuiz, ...partial } } );

	// Whether "Max quiz attempts" above needs to explain it's a separate limit
	// from QuizPress's own — only worth mentioning once any gate actually uses one.
	const anyQuizpress =
		gating.checkpoints.some( ( cp ) => 'quizpress' === cp.source ) ||
		( gating.finalQuiz && 'quizpress' === gating.finalQuiz.source );

	return (
		<div className="space-y-6">
			<Card className="p-6 max-w-2xl">
				<h3 className="font-semibold text-gray-900 mb-4">{ __( 'Watch verification' ) }</h3>
				<div className="grid grid-cols-2 gap-4 mt-4 pt-5 border-t border-solid border-line">
					<Field label={ __( 'Completion threshold (%)' ) } hint={ __( "Coverage required to count as 'watched'." ) }>
						<Input type="number" min="1" max="100" value={ gating.completionThreshold } onChange={ ( e ) => set( { completionThreshold: parseInt( e.target.value, 10 ) || 0 } ) } />
					</Field>
					<Field
						label={ __( 'Max quiz attempts' ) }
						hint={
							anyQuizpress
								? __( "A separate limit from QuizPress's own attempt limit on a linked quiz below; both apply independently." )
								: ( 'never_lock' === gating.onFail ? __( 'Counted and reported, but never enforced.' ) : __( 'Before the video locks.' ) )
						}
					>
						<Input type="number" min="1" value={ gating.maxAttempts } onChange={ ( e ) => set( { maxAttempts: parseInt( e.target.value, 10 ) || 1 } ) } />
					</Field>
				</div>
				<Field
					label={ __( 'When attempts run out' ) }
					hint={ 'never_lock' === gating.onFail
						? __( 'Attempts are still counted and reported — they just never lock anything, and watch progress is kept so the video resumes.' )
						: __( 'Locking clears the viewer\u2019s watch progress, so the re-watch has to be genuine.' ) }
				>
					<Select value={ gating.onFail } onChange={ ( e ) => set( { onFail: e.target.value } ) }>
						{ ON_FAIL_POLICIES.map( ( o ) => <option key={ o.value } value={ o.value }>{ o.label }</option> ) }
					</Select>
				</Field>
				<Toggle
					className="mb-6"
					checked={ gating.antiSkip || rapidOn }
					disabled={ rapidOn }
					onChange={ ( v ) => set( { antiSkip: v } ) }
					label={<>{ __( 'Anti-skip (block seeking past unwatched parts)' ) }{ rapidOn && <em className="block not-italic text-[11px] text-gray-400 mt-0.5">{ __( 'Already covered — the Rapid Engage Bar locks the timeline entirely.' ) }</em> }</>}
				/>
				<Toggle checked={ gating.requireLoginForGate } onChange={ ( v ) => set( { requireLoginForGate: v } ) } label={ __( 'Require login to watch (reliable per-person tracking)' ) } />
				<p className="text-xs text-muted mt-4">{ __( 'These start from your site-wide policy (Settings → Enforcement). Change one here and this video keeps your value; leave it and it follows the site.' ) }</p>
			</Card>

			<Card className="p-6 max-w-2xl">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="font-semibold text-gray-900">{ __( 'Checkpoint questions' ) }</h3>
						<p className="text-sm text-gray-500">
							{ gating.checkpoints.length > 1
								? __( 'Pause playback at a timestamp and require a correct answer to continue. Drag ⠿ to reorder, click a row to expand it.' )
								: __( 'Pause playback at a timestamp and require a correct answer to continue. Click a row to expand it.' ) }
						</p>
					</div>
					<Button variant="ghost" onClick={ addCheckpoint }>{ __( '+ Checkpoint' ) }</Button>
				</div>
				<div className="space-y-3 mt-4 pt-5 border-t border-solid border-line">
					{ gating.checkpoints.map( ( cp, i ) => (
						<CheckpointRow
							key={ cp.id }
							cp={ cp }
							index={ i }
							isOpen={ openCheckpoints.has( cp.id ) }
							onToggle={ () => toggleCheckpointOpen( cp.id ) }
							onChange={ ( partial ) => setCheckpoint( i, partial ) }
							onRemove={ () => removeCheckpoint( i ) }
							quizpressOpts={ quizpressOpts }
							isDragging={ dragIndex === i }
							isOver={ overIndex === i && dragIndex !== i }
							onDragStart={ ( e ) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData( 'text/plain', String( i ) ); setDragIndex( i ); } }
							onDragOver={ ( e ) => { e.preventDefault(); if ( overIndex !== i ) { setOverIndex( i ); } } }
							onDrop={ ( e ) => { e.preventDefault(); reorderCheckpoints( parseInt( e.dataTransfer.getData( 'text/plain' ), 10 ), i ); setDragIndex( null ); setOverIndex( null ); } }
							onDragEnd={ () => { setDragIndex( null ); setOverIndex( null ); } }
						/>
					) ) }
					{ gating.checkpoints.length === 0 && <p className="text-sm text-gray-400">{ __( 'No checkpoints yet.' ) }</p> }
				</div>
			</Card>

			<Card className="p-6 max-w-2xl">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<h3 className="font-semibold text-gray-900">{ __( 'Final quiz (end gate)' ) }</h3>
						{ gating.finalQuiz && <Badge tone="amber">{ __( 'on' ) }</Badge> }
					</div>
					<Toggle checked={ !! gating.finalQuiz } onChange={ toggleFinal } label={ __( 'Enable' ) } />
				</div>
				{ gating.finalQuiz && (
					<div className='mt-4 pt-5 border-t border-solid border-line'>
						<div className="flex gap-2 items-end mb-4">
							<div className="flex-1"><Field label={ __( 'Title' ) }><Input value={ gating.finalQuiz.title || '' } onChange={ ( e ) => setFinal( { title: e.target.value } ) } /></Field></div>
							{ 'quizpress' !== gating.finalQuiz.source && (
								<Field label={ __( 'Pass %' ) }><Input type="number" className="w-24" value={ gating.finalQuiz.passPercent } onChange={ ( e ) => setFinal( { passPercent: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
							) }
						</div>
						<QuizSourceFields quiz={ gating.finalQuiz } quizpressOpts={ quizpressOpts } onChange={ setFinal } />
					</div>
				) }
			</Card>

			{ SHOW_LMS_LINK && <LmsLink config={ config } patch={ patch } /> }
		</div>
	);
}
