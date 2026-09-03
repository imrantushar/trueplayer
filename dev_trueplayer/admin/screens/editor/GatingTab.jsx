import { useEffect, useState } from '@wordpress/element';
import { Card, Field, Input, Select, Toggle, Button, Badge } from '../../components/UI';
import { Icon } from '../../components/icons';
import { api } from '../../api';
import { BsTrash } from 'react-icons/bs';

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
				<h3 className="font-semibold text-gray-900 mb-1">Course completion (LMS)</h3>
				<p className="text-sm text-gray-400">Install Academy LMS to link this video to a course lesson.</p>
			</Card>
		);
	}

	return (
		<Card className="p-6 max-w-2xl">
			<h3 className="font-semibold text-gray-900 mb-1">Course completion (Academy LMS)</h3>
			<p className="text-sm text-gray-500 mb-4">Link this video to a lesson: gate it by enrollment and mark it complete when watched/passed.</p>
			<Toggle checked={ enabled } onChange={ ( v ) => set( { provider: v ? 'academy' : '' } ) } label="Link to an Academy course" />
			{ enabled && (
				<div className="mt-4 space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<Field label="Course">
							{ /* Changing the course clears the lesson — a lesson id from
							     the previous course would complete the wrong topic. */ }
							<Select value={ lms.course || '' } onChange={ ( e ) => set( { course: parseInt( e.target.value, 10 ) || 0, topic: 0 } ) }>
								<option value="">— select —</option>
								{ courses.map( ( c ) => <option key={ c.id } value={ c.id }>{ c.title }</option> ) }
							</Select>
						</Field>
						<Field
							label="Lesson"
							hint={ ! lms.course ? 'Pick a course first.' : ( ! lessons.length ? 'This course has no lessons in its curriculum yet.' : 'Marked complete when the viewer completes this video.' ) }
						>
							<Select
								value={ lms.topic || '' }
								disabled={ ! lessons.length }
								onChange={ ( e ) => set( { topic: parseInt( e.target.value, 10 ) || 0, topicType: 'lesson' } ) }
							>
								<option value="">— select —</option>
								{ lessons.map( ( l ) => <option key={ l.id } value={ l.id }>{ l.title }</option> ) }
							</Select>
						</Field>
					</div>
					<Toggle checked={ lms.gateAccess !== false } onChange={ ( v ) => set( { gateAccess: v } ) } label="Block playback for non-enrolled viewers" />
				</div>
			) }
		</Card>
	);
}

function QuestionList( { questions, onChange } ) {
	const setQ = ( i, partial ) => onChange( questions.map( ( q, idx ) => ( idx === i ? { ...q, ...partial } : q ) ) );
	const addQ = () =>
		onChange( [
			...questions,
			{ id: uid(), type: 'mcq', prompt: '', options: [ { id: uid(), label: '' }, { id: uid(), label: '' } ], correct: '' },
		] );
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

	return (
		<div className="space-y-4">
			{ questions.map( ( q, qi ) => (
				<div key={ q.id } className="border border-line rounded-lg p-4">
					<div className="flex gap-2 items-center mb-3">
						<span className="text-sm font-semibold text-gray-500">Q{ qi + 1 }</span>
						<Select className="w-40" value={ q.type } onChange={ ( e ) => setQ( qi, { type: e.target.value, correct: '' } ) }>
							<option value="mcq">Multiple choice</option>
							<option value="boolean">True / False</option>
						</Select>
						<div className="flex-1" />
						<Button variant="danger" onClick={ () => removeQ( qi ) }><BsTrash /></Button>
					</div>
					<Input className="mb-3" value={ q.prompt } onChange={ ( e ) => setQ( qi, { prompt: e.target.value } ) } placeholder="Question prompt…" />

					{ q.type === 'boolean' ? (
						<Field label="Correct answer">
							<Select className="w-40" value={ q.correct } onChange={ ( e ) => setQ( qi, { correct: e.target.value } ) }>
								<option value="">— pick —</option>
								<option value="true">True</option>
								<option value="false">False</option>
							</Select>
						</Field>
					) : (
						<div>
							<span className="block text-xs text-gray-500 mb-2">Options (select the correct one)</span>
							<div className="space-y-2">
								{ q.options.map( ( o, oi ) => (
									<div key={ o.id } className="flex gap-2 items-center">
										<input type="radio" name={ `correct-${ q.id }` } checked={ q.correct === o.id } onChange={ () => setQ( qi, { correct: o.id } ) } />
										<Input value={ o.label } onChange={ ( e ) => setOpt( qi, oi, e.target.value ) } placeholder={ `Option ${ oi + 1 }` } />
										{ q.options.length > 2 && <Button variant="danger" onClick={ () => removeOpt( qi, oi ) }><BsTrash /></Button> }
									</div>
								) ) }
							</div>
							<Button variant="ghost" className="mt-2" onClick={ () => addOpt( qi ) }>+ Option</Button>
						</div>
					) }
				</div>
			) ) }
			<Button variant="ghost" onClick={ addQ }>+ Add question</Button>
		</div>
	);
}

const QUIZPRESS_FEEDBACK_MODE_LABELS = {
	default: 'one attempt only',
	retry_mode: 'retries allowed',
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
				<Field label="Questions" className={ 'quizpress' === source && quizpressReady ? 'w-64 shrink-0' : '' }>
					<Select
						className={ 'quizpress' === source && quizpressReady ? '' : 'w-64' }
						value={ source }
						onChange={ ( e ) => onChange( { source: 'quizpress' === e.target.value ? 'quizpress' : 'native' } ) }
					>
						<option value="native">Author here</option>
						<option value="quizpress">Use a QuizPress quiz</option>
					</Select>
				</Field>
				{ 'quizpress' === source && quizpressReady && (
					<Field label="Quiz" className="flex-1" hint="Question types, scoring and feedback all come from QuizPress.">
						<Select value={ quiz.quizpressId || '' } onChange={ ( e ) => onChange( { quizpressId: parseInt( e.target.value, 10 ) || 0 } ) }>
							<option value="">— select —</option>
							{ quizzes.map( ( q ) => (
								<option key={ q.id } value={ q.id }>
									{ q.title }{ q.hasManualReview ? ' — has manual-review questions' : '' }
								</option>
							) ) }
						</Select>
					</Field>
				) }
			</div>
			{ 'quizpress' === source ? (
				quizpressOpts && ! quizpressOpts.available ? (
					<p className="text-sm text-gray-400">Install QuizPress to link a quiz here.</p>
				) : (
					<>
						{ selectedQuiz && (
							<div className="mb-4 rounded-lg border border-solid border-line bg-gray-50 p-3 text-sm text-gray-700">
								<p className="mb-1">
									<strong>Passing grade:</strong> { selectedQuiz.passingGrade || 0 }%
									{ ' · ' }
									<strong>QuizPress attempts:</strong> { selectedQuiz.maxAttempts ? selectedQuiz.maxAttempts : 'Unlimited' }
									{ selectedQuiz.feedbackMode && QUIZPRESS_FEEDBACK_MODE_LABELS[ selectedQuiz.feedbackMode ]
										? ` (${ QUIZPRESS_FEEDBACK_MODE_LABELS[ selectedQuiz.feedbackMode ] })`
										: '' }
								</p>
								<p className="text-xs text-gray-500">
									Set on the quiz itself in QuizPress — this checkpoint's own "Pass %" field isn't used
									for a QuizPress quiz. QuizPress's attempt limit above is separate from TruePlayer's
									own "Max quiz attempts" (Watch verification, above): that one still applies too and
									locks the whole video (requiring a rewatch) independently, once it's reached.
								</p>
							</div>
						) }
						{ selectedQuiz && selectedQuiz.hasManualReview && (
							<div className="mb-4 rounded-lg border border-solid border-warning bg-warning-light p-3 text-sm text-warning">
								<strong>Heads up:</strong> this quiz includes a manually-reviewed question type (short
								answer, paragraph, date, or number). QuizPress won't mark an attempt passed or failed
								until an admin reviews it in <em>QuizPress → Quiz Insights</em> — until then, a viewer
								gated on this quiz can't complete the video.
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
		? ( quizpressTitle || 'No QuizPress quiz selected yet' )
		: `${ questionCount } question${ 1 === questionCount ? '' : 's' }`;

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
				<span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none px-0.5" title="Drag to reorder" aria-hidden="true">⠿</span>
				<Icon name="chevronRight" className={ `w-4 h-4 text-gray-400 shrink-0 transition-transform ${ isOpen ? 'rotate-90' : '' }` } />
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-ink truncate">{ cp.title || `Checkpoint ${ index + 1 }` }</p>
					<p className="text-xs text-gray-400 truncate">At { cp.at }s · { summary }</p>
				</div>
				<Button variant="danger" size="sm" onClick={ ( e ) => { e.stopPropagation(); onRemove(); } }><BsTrash /></Button>
			</div>
			{ isOpen && (
				<div className="p-3">
					<div className="flex gap-2 items-end mb-3">
						<Field label="At (seconds)"><Input type="number" className="w-28" value={ cp.at } onChange={ ( e ) => onChange( { at: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
						{ 'quizpress' !== cp.source && (
							<Field label="Pass %"><Input type="number" className="w-24" value={ cp.passPercent } onChange={ ( e ) => onChange( { passPercent: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
						) }
						<div className="flex-1"><Field label="Title"><Input value={ cp.title || '' } onChange={ ( e ) => onChange( { title: e.target.value } ) } placeholder="Checkpoint" /></Field></div>
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
		requireLoginForGate: !! e.requireLogin,
	};
}

// Keys this tab inherits from the site policy. Everything else on `gating`
// (checkpoints, finalQuiz, …) is this video's own content and always persists.
const POLICY_KEYS = [ 'completionThreshold', 'antiSkip', 'maxAttempts', 'requireLoginForGate' ];

export default function GatingTab( { config, patch } ) {
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

	const toggleFinal = ( on ) => set( { finalQuiz: on ? { title: 'Final quiz', passPercent: 70, questions: [] } : null } );
	const setFinal = ( partial ) => set( { finalQuiz: { ...gating.finalQuiz, ...partial } } );

	// Whether "Max quiz attempts" above needs to explain it's a separate limit
	// from QuizPress's own — only worth mentioning once any gate actually uses one.
	const anyQuizpress =
		gating.checkpoints.some( ( cp ) => 'quizpress' === cp.source ) ||
		( gating.finalQuiz && 'quizpress' === gating.finalQuiz.source );

	return (
		<div className="space-y-6">
			<Card className="p-6 max-w-2xl">
				<h3 className="font-semibold text-gray-900 mb-4">Watch verification</h3>
				<div className="grid grid-cols-2 gap-4 mt-4 pt-5 border-t border-solid border-line">
					<Field label="Completion threshold (%)" hint="Coverage required to count as 'watched'.">
						<Input type="number" min="1" max="100" value={ gating.completionThreshold } onChange={ ( e ) => set( { completionThreshold: parseInt( e.target.value, 10 ) || 0 } ) } />
					</Field>
					<Field
						label="Max quiz attempts"
						hint={
							anyQuizpress
								? "Before the video locks — a separate limit from QuizPress's own attempt limit on a linked quiz below; both apply independently."
								: 'Before the video locks.'
						}
					>
						<Input type="number" min="1" value={ gating.maxAttempts } onChange={ ( e ) => set( { maxAttempts: parseInt( e.target.value, 10 ) || 1 } ) } />
					</Field>
				</div>
				<Toggle className="mb-6" checked={ gating.antiSkip } onChange={ ( v ) => set( { antiSkip: v } ) } label="Anti-skip (block seeking past unwatched parts)" />
				<Toggle checked={ gating.requireLoginForGate } onChange={ ( v ) => set( { requireLoginForGate: v } ) } label="Require login to watch (reliable per-person tracking)" />
				<p className="text-xs text-muted mt-4">These start from your site-wide policy (Settings → Enforcement). Change one here and this video keeps your value; leave it and it follows the site.</p>
			</Card>

			<Card className="p-6 max-w-2xl">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="font-semibold text-gray-900">Checkpoint questions</h3>
						<p className="text-sm text-gray-500">Pause playback at a timestamp and require a correct answer to continue. Drag { gating.checkpoints.length > 1 ? '⠿ to reorder, click' : 'click' } a row to expand it.</p>
					</div>
					<Button variant="ghost" onClick={ addCheckpoint }>+ Checkpoint</Button>
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
					{ gating.checkpoints.length === 0 && <p className="text-sm text-gray-400">No checkpoints yet.</p> }
				</div>
			</Card>

			<Card className="p-6 max-w-2xl">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<h3 className="font-semibold text-gray-900">Final quiz (end gate)</h3>
						{ gating.finalQuiz && <Badge tone="amber">on</Badge> }
					</div>
					<Toggle checked={ !! gating.finalQuiz } onChange={ toggleFinal } label="Enable" />
				</div>
				{ gating.finalQuiz && (
					<div className='mt-4 pt-5 border-t border-solid border-line'>
						<div className="flex gap-2 items-end mb-4">
							<div className="flex-1"><Field label="Title"><Input value={ gating.finalQuiz.title || '' } onChange={ ( e ) => setFinal( { title: e.target.value } ) } /></Field></div>
							{ 'quizpress' !== gating.finalQuiz.source && (
								<Field label="Pass %"><Input type="number" className="w-24" value={ gating.finalQuiz.passPercent } onChange={ ( e ) => setFinal( { passPercent: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
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
