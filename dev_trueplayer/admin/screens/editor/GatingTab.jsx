import { useEffect, useState } from '@wordpress/element';
import { Card, Field, Input, Select, Toggle, Button, Badge } from '../../components/UI';
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

export default function GatingTab( { config, patch } ) {
	const gating = {
		completionThreshold: 90,
		antiSkip: true,
		maxAttempts: 3,
		requireLoginForGate: false,
		checkpoints: [],
		finalQuiz: null,
		...( config.gating || {} ),
	};
	const set = ( partial ) => patch( { gating: { ...gating, ...partial } } );

	const addCheckpoint = () =>
		set( { checkpoints: [ ...gating.checkpoints, { id: uid(), at: 30, title: '', passPercent: 70, questions: [] } ] } );
	const setCheckpoint = ( i, partial ) =>
		set( { checkpoints: gating.checkpoints.map( ( c, idx ) => ( idx === i ? { ...c, ...partial } : c ) ) } );
	const removeCheckpoint = ( i ) => set( { checkpoints: gating.checkpoints.filter( ( _, idx ) => idx !== i ) } );

	const toggleFinal = ( on ) => set( { finalQuiz: on ? { title: 'Final quiz', passPercent: 70, questions: [] } : null } );
	const setFinal = ( partial ) => set( { finalQuiz: { ...gating.finalQuiz, ...partial } } );

	return (
		<div className="space-y-6">
			<Card className="p-6 max-w-2xl">
				<h3 className="font-semibold text-gray-900 mb-4">Watch verification</h3>
				<div className="grid grid-cols-2 gap-4 mt-4 pt-5 border-t border-solid border-line">
					<Field label="Completion threshold (%)" hint="Coverage required to count as 'watched'.">
						<Input type="number" min="1" max="100" value={ gating.completionThreshold } onChange={ ( e ) => set( { completionThreshold: parseInt( e.target.value, 10 ) || 0 } ) } />
					</Field>
					<Field label="Max quiz attempts" hint="Before the video locks.">
						<Input type="number" min="1" value={ gating.maxAttempts } onChange={ ( e ) => set( { maxAttempts: parseInt( e.target.value, 10 ) || 1 } ) } />
					</Field>
				</div>
				<Toggle className="mb-6" checked={ gating.antiSkip } onChange={ ( v ) => set( { antiSkip: v } ) } label="Anti-skip (block seeking past unwatched parts)" />
				<Toggle checked={ gating.requireLoginForGate } onChange={ ( v ) => set( { requireLoginForGate: v } ) } label="Require login to watch (reliable per-person tracking)" />
			</Card>

			<Card className="p-6 max-w-2xl">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="font-semibold text-gray-900">Checkpoint questions</h3>
						<p className="text-sm text-gray-500">Pause playback at a timestamp and require a correct answer to continue.</p>
					</div>
					<Button variant="ghost" onClick={ addCheckpoint }>+ Checkpoint</Button>
				</div>
				<div className="space-y-6 mt-4 pt-5 border-t border-solid border-line">
					{ gating.checkpoints.map( ( cp, i ) => (
						<div key={ cp.id } className="border-l-4 border-brand-200 pl-4">
							<div className="flex gap-2 items-end mb-3">
								<Field label="At (seconds)"><Input type="number" className="w-28" value={ cp.at } onChange={ ( e ) => setCheckpoint( i, { at: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
								<Field label="Pass %"><Input type="number" className="w-24" value={ cp.passPercent } onChange={ ( e ) => setCheckpoint( i, { passPercent: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
								<div className="flex-1"><Field label="Title"><Input value={ cp.title || '' } onChange={ ( e ) => setCheckpoint( i, { title: e.target.value } ) } placeholder="Checkpoint" /></Field></div>
								<Button variant="danger" onClick={ () => removeCheckpoint( i ) }><BsTrash /></Button>
							</div>
							<QuestionList questions={ cp.questions || [] } onChange={ ( questions ) => setCheckpoint( i, { questions } ) } />
						</div>
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
							<Field label="Pass %"><Input type="number" className="w-24" value={ gating.finalQuiz.passPercent } onChange={ ( e ) => setFinal( { passPercent: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
						</div>
						<QuestionList questions={ gating.finalQuiz.questions || [] } onChange={ ( questions ) => setFinal( { questions } ) } />
					</div>
				) }
			</Card>

			{ SHOW_LMS_LINK && <LmsLink config={ config } patch={ patch } /> }
		</div>
	);
}
