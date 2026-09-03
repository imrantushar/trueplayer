import { useState } from '@wordpress/element';
import { rest } from '@Utils/rest';
import { __, __sprintf } from '@Utils/translation';
import { gradeLocal } from '../grade-local';
import QuizpressQuiz from './QuizpressQuiz';

// GradingService::grade_quizpress returns these as raw internal codes — map
// the ones a viewer can actually hit to plain language instead of surfacing
// e.g. "login_required" verbatim.
const quizpressErrorMessages = () => ( {
	login_required: __( 'Log in to have this attempt count.' ),
	quiz_not_completed: __( 'Finish the quiz above first.' ),
	quizpress_unavailable: __( "This quiz isn't available right now." ),
	quiz_not_found: __( "This quiz isn't set up correctly — contact the site owner." ),
	pro_required: __( 'This feature requires TruePlayer Pro.' ),
} );
const quizpressErrorMessage = ( code ) => quizpressErrorMessages()[ code ] || code;

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
	// Bumped to remount <QuizpressQuiz> from scratch on "Try again" — it goes
	// quiet (renders nothing) once an attempt finishes, so a fresh key is what
	// brings back its own start screen (Retake quiz button, updated attempt
	// count) rather than teaching it about grading outcomes it doesn't own.
	const [ resetKey, setResetKey ] = useState( 0 );
	const retryQuizpress = () => {
		setResult( null );
		setResetKey( ( k ) => k + 1 );
	};

	const isQuizpress = 'quizpress' === quiz.source;
	const questions   = quiz.questions || [];
	const setAnswer = ( qid, val ) => setAnswers( ( a ) => ( { ...a, [ qid ]: val } ) );

	const submit = async ( quizpressAttemptId ) => {
		setBusy( true );
		try {
			// A native quiz's correct answers already sit in the local config in
			// preview, so grading it locally is just an optimization. A QuizPress
			// quiz has no local answer key either way — grading truth is always
			// server-side there — so preview still asks the real server, just
			// with `preview: true` so it skips attempt/lock bookkeeping (see
			// GradingService::grade — an admin re-testing a checkpoint shouldn't
			// lock the video or spam real webhooks).
			const verdict = ( preview && ! isQuizpress )
				? gradeLocal( quiz, answers )
				: await rest.post( 'grade', {
						video: videoId,
						gate: gateId,
						answers,
						...( isQuizpress && quizpressAttemptId ? { quizpressAttemptId } : {} ),
						...( preview ? { preview: true } : {} ),
				  } );
			setResult( verdict );
			if ( preview ) {
				// No real playback to unlock/lock from a preview verdict.
				return;
			}
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

	// QuizPress grades itself; once its attempt finishes, this only asks
	// TruePlayer's server to confirm the resulting pass/fail — grading stays
	// server-side, same as the native path (see GradingService).
	if ( isQuizpress ) {
		return (
			<div className="tp-overlay tp-quiz tp-quiz--quizpress">
				<div className="tp-quiz-card">
					<h3 className="tp-quiz-title">{ title }</h3>
					<QuizpressQuiz key={ resetKey } quizId={ quiz.quizpressId } onAttemptFinished={ submit } />
					{ busy && <p className="tp-quiz-feedback">{ __( 'Checking your result…' ) }</p> }
					{ result && result.passed && (
						<p className="tp-quiz-feedback tp-pass tp-quiz-verdict">
							<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
							{ __sprintf( 'You passed! (%d%%)', result.score ) }
						</p>
					) }
					{ result && result.pending && (
						<p className="tp-quiz-feedback tp-quiz-verdict">
							{ __( "Your answers are awaiting manual review. You'll be able to continue once they're graded." ) }
						</p>
					) }
					{ result && ! result.passed && ! result.pending && ! result.error && (
						<>
							<p className="tp-quiz-feedback tp-fail tp-quiz-verdict">
								{ result.locked
									? __sprintf( "You didn't pass (%d%%) — locked. Re-watch the video to try again.", result.score )
									: result.preview
										? __sprintf( "You didn't pass this attempt (%d%%).", result.score )
										: __sprintf( "You didn't pass this attempt (%1$d%%). Attempts left: %2$d.", result.score, result.attemptsLeft ) }
							</p>
							{ /* Locked already swaps this whole overlay for the re-watch
							     screen (Player.jsx's onQuizLocked) — nothing to retry here. */ }
							{ ! result.locked && (
								<button type="button" className="tp-quiz-submit" onClick={ retryQuizpress }>
									{ __( 'Try again' ) }
								</button>
							) }
						</>
					) }
					{ result && result.error && (
						<p className="tp-quiz-feedback tp-fail tp-quiz-verdict">
							{ preview && 'quiz_not_found' === result.error
								? __( 'Save your changes to preview grading.' )
								: quizpressErrorMessage( result.error ) }
						</p>
					) }
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
								? [ { id: 'true', label: __( 'True' ) }, { id: 'false', label: __( 'False' ) } ].map( ( o ) => (
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
							? __( 'Locked — you must re-watch the video to try again.' )
							: __sprintf( 'Not quite (%1$d%%). Attempts left: %2$d.', result.score, result.attemptsLeft ) }
					</p>
				) }
				{ result && result.passed && (
					<p className="tp-quiz-feedback tp-pass">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
						{ __sprintf( 'Passed (%d%%)', result.score ) }
					</p>
				) }
				{ result && result.error && <p className="tp-quiz-feedback tp-fail">{ result.error }</p> }

				<button className="tp-quiz-submit" disabled={ ! answeredAll || busy } onClick={ submit }>
					{ busy ? __( 'Checking…' ) : __( 'Submit' ) }
				</button>
			</div>
		</div>
	);
}
