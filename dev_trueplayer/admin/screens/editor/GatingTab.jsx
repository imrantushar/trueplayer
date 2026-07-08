import { useEffect, useState } from '@wordpress/element';
import { Card, Field, Input, Select, Toggle, Button, Badge } from '../../components/UI';
import { api } from '../../api';

const uid = () => Math.random().toString( 36 ).slice( 2, 9 );

/**
 * Academy LMS progression: pick the course + lesson this video belongs to; the
 * pro academy-sync addon marks the lesson complete when the video is completed.
 */
function LmsSection( { config, patch } ) {
	const [ options, setOptions ] = useState( null );
	const lms = config.lms || {};
	const set = ( partial ) => patch( { lms: { ...lms, ...partial } } );

	useEffect( () => {
		api.getLmsOptions().then( setOptions ).catch( () => setOptions( { available: false } ) );
	}, [] );

	if ( ! options || ! options.available ) {
		return null; // Academy not installed — keep the tab uncluttered
	}

	return (
		<Card className="p-6 max-w-2xl">
			<div className="flex items-center gap-3 mb-1">
				<h3 className="font-semibold text-gray-900">Academy LMS progression</h3>
				{ lms.courseId && lms.lessonId ? <Badge tone="green">linked</Badge> : null }
			</div>
			<p className="text-sm text-gray-500 mb-4">
				When a logged-in student completes this video, the linked Academy lesson is marked complete automatically.
			</p>
			<div className="grid md:grid-cols-2 gap-x-6">
				<Field label="Course">
					<Select value={ lms.courseId || '' } onChange={ ( e ) => set( { courseId: e.target.value ? parseInt( e.target.value, 10 ) : undefined } ) }>
						<option value="">— none —</option>
						{ ( options.courses || [] ).map( ( c ) => <option key={ c.id } value={ c.id }>{ c.title }</option> ) }
					</Select>
				</Field>
				<Field label="Lesson">
					<Select value={ lms.lessonId || '' } onChange={ ( e ) => set( { lessonId: e.target.value ? parseInt( e.target.value, 10 ) : undefined } ) }>
						<option value="">— none —</option>
						{ ( options.lessons || [] ).map( ( l ) => <option key={ l.id } value={ l.id }>{ l.title }</option> ) }
					</Select>
				</Field>
			</div>
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
						<Button variant="danger" onClick={ () => removeQ( qi ) }>Remove</Button>
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
										{ q.options.length > 2 && <Button variant="danger" onClick={ () => removeOpt( qi, oi ) }>×</Button> }
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
				<div className="grid grid-cols-2 gap-4">
					<Field label="Completion threshold (%)" hint="Coverage required to count as 'watched'.">
						<Input type="number" min="1" max="100" value={ gating.completionThreshold } onChange={ ( e ) => set( { completionThreshold: parseInt( e.target.value, 10 ) || 0 } ) } />
					</Field>
					<Field label="Max quiz attempts" hint="Before the video locks.">
						<Input type="number" min="1" value={ gating.maxAttempts } onChange={ ( e ) => set( { maxAttempts: parseInt( e.target.value, 10 ) || 1 } ) } />
					</Field>
				</div>
				<Toggle checked={ gating.antiSkip } onChange={ ( v ) => set( { antiSkip: v } ) } label="Anti-skip (block seeking past unwatched parts)" />
				<Toggle checked={ gating.requireLoginForGate } onChange={ ( v ) => set( { requireLoginForGate: v } ) } label="Require login to watch (reliable per-person tracking)" />
			</Card>

			<Card className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="font-semibold text-gray-900">Checkpoint questions</h3>
						<p className="text-sm text-gray-500">Pause playback at a timestamp and require a correct answer to continue.</p>
					</div>
					<Button variant="ghost" onClick={ addCheckpoint }>+ Checkpoint</Button>
				</div>
				<div className="space-y-6">
					{ gating.checkpoints.map( ( cp, i ) => (
						<div key={ cp.id } className="border-l-4 border-brand-200 pl-4">
							<div className="flex gap-2 items-end mb-3">
								<Field label="At (seconds)"><Input type="number" className="w-28" value={ cp.at } onChange={ ( e ) => setCheckpoint( i, { at: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
								<Field label="Pass %"><Input type="number" className="w-24" value={ cp.passPercent } onChange={ ( e ) => setCheckpoint( i, { passPercent: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
								<div className="flex-1"><Field label="Title"><Input value={ cp.title || '' } onChange={ ( e ) => setCheckpoint( i, { title: e.target.value } ) } placeholder="Checkpoint" /></Field></div>
								<Button variant="danger" onClick={ () => removeCheckpoint( i ) }>Remove</Button>
							</div>
							<QuestionList questions={ cp.questions || [] } onChange={ ( questions ) => setCheckpoint( i, { questions } ) } />
						</div>
					) ) }
					{ gating.checkpoints.length === 0 && <p className="text-sm text-gray-400">No checkpoints yet.</p> }
				</div>
			</Card>

			<Card className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<h3 className="font-semibold text-gray-900">Final quiz (end gate)</h3>
						{ gating.finalQuiz && <Badge tone="amber">on</Badge> }
					</div>
					<Toggle checked={ !! gating.finalQuiz } onChange={ toggleFinal } label="Enable" />
				</div>
				{ gating.finalQuiz && (
					<div>
						<div className="flex gap-2 items-end mb-4">
							<div className="flex-1"><Field label="Title"><Input value={ gating.finalQuiz.title || '' } onChange={ ( e ) => setFinal( { title: e.target.value } ) } /></Field></div>
							<Field label="Pass %"><Input type="number" className="w-24" value={ gating.finalQuiz.passPercent } onChange={ ( e ) => setFinal( { passPercent: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
						</div>
						<QuestionList questions={ gating.finalQuiz.questions || [] } onChange={ ( questions ) => setFinal( { questions } ) } />
					</div>
				) }
			</Card>

			<LmsSection config={ config } patch={ patch } />
		</div>
	);
}
