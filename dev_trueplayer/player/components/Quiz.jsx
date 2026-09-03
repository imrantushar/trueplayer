import { useEffect, useState } from '@wordpress/element';
import { rest } from '@Utils/rest';
import { gradeLocal } from '../grade-local';

/**
 * In-player quiz layer used for both checkpoints and the final gate. Renders
 * question prompts (never answers), submits to the server for grading, and
 * surfaces pass / fail / lock outcomes.
 *
 * In admin `preview` mode the config still carries the correct answers, so we
 * grade client-side (no server call, no locking).
 */
export default function Quiz( { videoId, gateId, quiz, title, onPass, onFail, onLocked, preview = false } ) {
	const [ answers, setAnswers ] = useState( {} );
	const [ busy, setBusy ] = useState( false );
	const [ result, setResult ] = useState( null );

	const isQuizpress = 'quizpress' === quiz.source;
	const questions   = quiz.questions || [];
	const setAnswer = ( qid, val ) => setAnswers( ( a ) => ( { ...a, [ qid ]: val } ) );

	const submit = async () => {
		setBusy( true );
		try {
			const verdict = preview
				? gradeLocal( quiz, answers )
				: await rest.post( 'grade', { video: videoId, gate: gateId, answers } );
			setResult( verdict );
			if ( verdict.passed ) {
				setTimeout( () => onPass( verdict ), 900 );
			} else if ( verdict.locked ) {
				setTimeout( () => onLocked( verdict ), 1500 );
			} else {
				onFail( verdict );
			}
		} catch ( e ) {
			setResult( { error: e.message } );
		} finally {
			setBusy( false );
		}
	};

	// QuizPress grades itself in its own embed; this only asks the server to
	// confirm the resulting pass/fail once QuizPress says an attempt finished
	// — the browser event is a "go check", never the verdict itself (grading
	// stays server-side, same as the native path — see GradingService).
	useEffect( () => {
		if ( ! isQuizpress || preview ) {
			return;
		}
		const onFinished = ( e ) => {
			const finishedQuizId = e?.detail?.quiz_id;
			if ( finishedQuizId && String( finishedQuizId ) !== String( quiz.quizpressId ) ) {
				return; // a different quiz on the same page finished — not ours.
			}
			submit();
		};
		window.addEventListener( 'quizpress:attempt_finished', onFinished );
		return () => window.removeEventListener( 'quizpress:attempt_finished', onFinished );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isQuizpress, preview, quiz.quizpressId ] );

	if ( isQuizpress ) {
		return (
			<div className="tp-overlay tp-quiz tp-quiz--quizpress">
				<div className="tp-quiz-card">
					<h3 className="tp-quiz-title">{ title }</h3>
					{ quiz.html
						? <div className="tp-quiz-embed" dangerouslySetInnerHTML={ { __html: quiz.html } } />
						: <p className="tp-quiz-feedback tp-fail">This quiz isn't available right now.</p> }
					{ busy && <p className="tp-quiz-feedback">Checking…</p> }
					{ result && ! result.passed && ! result.error && (
						<p className="tp-quiz-feedback tp-fail">
							{ result.locked
								? 'Locked — you must re-watch the video to try again.'
								: `Not quite. Attempts left: ${ result.attemptsLeft }.` }
						</p>
					) }
					{ result && result.passed && (
						<p className="tp-quiz-feedback tp-pass">
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
							Passed
						</p>
					) }
					{ result && result.error && <p className="tp-quiz-feedback tp-fail">{ result.error }</p> }
				</div>
			</div>
		);
	}

	const answeredAll = questions.every( ( q ) => answers[ q.id ] !== undefined && answers[ q.id ] !== '' );

	return (
		<div className="tp-overlay tp-quiz">
			<div className="tp-quiz-card">
				<h3 className="tp-quiz-title">{ title }</h3>
				{ questions.map( ( q, idx ) => (
					<div key={ q.id } className="tp-quiz-q">
						<p className="tp-quiz-prompt">
							<span className="tp-quiz-num">{ idx + 1 }.</span> { q.prompt }
						</p>
						<div className="tp-quiz-opts">
							{ q.type === 'boolean'
								? [ { id: 'true', label: 'True' }, { id: 'false', label: 'False' } ].map( ( o ) => (
										<label key={ o.id } className={ `tp-quiz-opt ${ String( answers[ q.id ] ) === o.id ? 'is-picked' : '' }` }>
											<input type="radio" name={ q.id } checked={ String( answers[ q.id ] ) === o.id } onChange={ () => setAnswer( q.id, o.id ) } />
											{ o.label }
										</label>
								  ) )
								: ( q.options || [] ).map( ( o ) => (
										<label key={ o.id } className={ `tp-quiz-opt ${ answers[ q.id ] === o.id ? 'is-picked' : '' }` }>
											<input type="radio" name={ q.id } checked={ answers[ q.id ] === o.id } onChange={ () => setAnswer( q.id, o.id ) } />
											{ o.label }
										</label>
								  ) ) }
						</div>
					</div>
				) ) }

				{ result && ! result.passed && ! result.error && (
					<p className="tp-quiz-feedback tp-fail">
						{ result.locked
							? 'Locked — you must re-watch the video to try again.'
							: `Not quite (${ result.score }%). Attempts left: ${ result.attemptsLeft }.` }
					</p>
				) }
				{ result && result.passed && (
					<p className="tp-quiz-feedback tp-pass">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
						Passed ({ result.score }%)
					</p>
				) }
				{ result && result.error && <p className="tp-quiz-feedback tp-fail">{ result.error }</p> }

				<button className="tp-quiz-submit" disabled={ ! answeredAll || busy } onClick={ submit }>
					{ busy ? 'Checking…' : 'Submit' }
				</button>
			</div>
		</div>
	);
}
