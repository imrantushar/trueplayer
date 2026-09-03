import { useEffect, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { __, __sprintf } from '@Utils/translation';

const tpGlobal = () => window.TruePlayerGlobal || {};
const qpGlobal = () => window.QuizPressGlobal || {};

// One shared REST nonce action ('wp_rest') across every plugin on the site,
// so TruePlayer's own already-localized nonce authenticates QuizPress's REST
// routes too — no need to read QuizPressGlobal for it.
function qpRest( path, { method = 'GET', body } = {} ) {
	const base = tpGlobal().rest_url || '/wp-json/';
	return fetch( `${ base }quizpress/v1/${ path }`, {
		method,
		headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': tpGlobal().nonce || '' },
		credentials: 'same-origin',
		body: body ? JSON.stringify( body ) : undefined,
	} ).then( ( res ) =>
		res.json().then( ( json ) => {
			if ( ! res.ok ) {
				throw new Error( ( json && json.message ) || __sprintf( 'Request failed (%d)', res.status ) );
			}
			return json;
		} )
	);
}

// QuizPress's own ajax action — its own nonce action (not the shared REST
// one) — for loading a fresh attempt's question set. Same call QuizPress's
// own useQuiz()/startNewAttempt() makes.
function qpAjax( action, payload ) {
	const formData = new FormData();
	formData.append( 'action', `quizpress/${ action }` );
	formData.append( 'security', qpGlobal().quizpress_nonce || '' );
	Object.entries( payload || {} ).forEach( ( [ key, value ] ) => {
		formData.append( key, 'object' === typeof value && null !== value ? JSON.stringify( value ) : value );
	} );
	return fetch( qpGlobal().ajaxurl || '', { method: 'POST', credentials: 'same-origin', body: formData } )
		.then( ( res ) => res.json() )
		.then( ( json ) => {
			if ( ! json || ! json.success ) {
				throw new Error( ( json && json.data && json.data.message ) || __( 'Request failed' ) );
			}
			return json.data;
		} );
}

// Mirrors QuizPress's own quizController.canStartAttempt(), same gate
// QuizPress's Academy LMS integration mirrors in its QuizStart.js.
const canStartAttempt = ( feedbackMode, maxAttempts, totalAttempts ) => {
	if ( 'default' === feedbackMode && 0 === totalAttempts ) {
		return true;
	}
	return 'retry_mode' === feedbackMode && totalAttempts < maxAttempts;
};

const AnswerWidgetFallback = () => (
	<p className="tp-quiz-feedback tp-fail">{ __( "This question type isn't available right now." ) }</p>
);

/**
 * QuizPress-sourced checkpoint/final quiz, rendered inline as its own
 * question-by-question stepper — TruePlayer owns the card/step chrome; only
 * the per-question answer widget is QuizPress's own component, pulled in via
 * its `quizpress.question-answer-widget.content` @wordpress/hooks filter.
 * This is the same seam QuizPress's own Academy LMS integration uses (see
 * academy/addons/quizpress/ + dev_academy/.../QuizPressQuizContent/TakeQuiz)
 * — ported here rather than reinvented. Quiz/attempt data is read/written
 * entirely through QuizPress's own REST/ajax endpoints; grading truth stays
 * there — TruePlayer only asks GradingService to re-verify pass/fail once
 * an attempt finishes (see Quiz.jsx's `submit`).
 */
export default function QuizpressQuiz( { quizId, onAttemptFinished } ) {
	const [ phase, setPhase ] = useState( 'loading' ); // loading | login_required | unavailable | start | taking | finishing | done
	const [ quizMeta, setQuizMeta ] = useState( null );
	const [ attempts, setAttempts ] = useState( [] );
	const [ attempt, setAttempt ] = useState( null );
	const [ questions, setQuestions ] = useState( [] );
	const [ stepIndex, setStepIndex ] = useState( 0 );
	const [ answers, setAnswers ] = useState( {} );
	const [ error, setError ] = useState( '' );
	const [ busy, setBusy ] = useState( false );

	useEffect( () => {
		if ( ! tpGlobal().is_login ) {
			setPhase( 'login_required' );
			return;
		}
		let cancelled = false;
		setPhase( 'loading' );
		const userId = tpGlobal().user_id || 0;
		Promise.all( [
			qpRest( `quizpress_quiz/${ quizId }` ).then( ( res ) => res && res.meta ),
			qpRest( `attempts?quiz_id=${ quizId }&user=${ userId }&per_page=50` ).catch( () => [] ),
		] )
			.then( ( [ meta, attemptList ] ) => {
				if ( cancelled ) {
					return;
				}
				setQuizMeta( meta || {} );
				setAttempts( Array.isArray( attemptList ) ? attemptList : [] );
				setPhase( 'start' );
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setPhase( 'unavailable' );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [ quizId ] );

	const startAttempt = () => {
		setBusy( true );
		setError( '' );
		qpAjax( 'frontend/get_quiz_questions_for_attempt', { quiz_id: quizId } )
			.then( ( data ) => {
				const qs = ( data && data.questions ) || [];
				return qpRest( 'attempts', {
					method: 'POST',
					body: {
						quiz_id: quizId,
						user_id: tpGlobal().user_id || 0,
						attempt_info: { total_correct_answers: 0, render_question_ids: data && data.render_question_ids },
						attempt_started_at: new Date(),
					},
				} ).then( ( newAttempt ) => {
					setAttempt( newAttempt );
					setQuestions( qs );
					setStepIndex( 0 );
					setAnswers( {} );
					setPhase( qs.length ? 'taking' : 'unavailable' );
				} );
			} )
			.catch( ( e ) => setError( e.message ) )
			.finally( () => setBusy( false ) );
	};

	const finishAttempt = ( status ) => {
		setPhase( 'finishing' );
		const answeredCount = Object.values( answers ).filter( ( v ) => null !== v && undefined !== v && '' !== v ).length;
		qpRest( `attempts/${ attempt.attempt_id }`, {
			method: 'POST',
			body: {
				answers,
				total_questions: questions.length,
				total_answered_questions: answeredCount,
				attempt_id: attempt.attempt_id,
				attempt_status: status,
				quiz_id: quizId,
				user_id: tpGlobal().user_id || 0,
				attempt_ended_at: new Date(),
			},
		} )
			.then( () => {
				setPhase( 'done' );
				if ( onAttemptFinished ) {
					// Identifies which attempt to verify — TruePlayer's server reads
					// its real status/marks back from QuizPress rather than trusting
					// anything asserted here (see GradingService::grade_quizpress).
					// Called in preview too now: preview asks the same real endpoint,
					// just flagged so it skips attempt/lock bookkeeping there.
					onAttemptFinished( attempt.attempt_id );
				}
			} )
			.catch( ( e ) => {
				setError( e.message );
				setPhase( 'taking' );
			} );
	};

	const question = questions[ stepIndex ];
	const isLastStep = stepIndex >= questions.length - 1;
	const value = question ? answers[ question.question_id ] : undefined;
	const isAnswered = Array.isArray( value ) || 'string' === typeof value ? value.length > 0 : Boolean( value );
	const isAnswerRequired = Boolean(
		( quizMeta && quizMeta.quizpress_quiz_force_all_questions_required ) ||
			( question && question.question_settings && question.question_settings.answer_required )
	);

	const persistAnswer = () => {
		const submit = applyFilters( 'quizpress.submit-question-answer', null );
		if ( ! submit ) {
			return Promise.resolve();
		}
		return submit( { question, value, quizId, attemptId: attempt.attempt_id } ).catch( () => {} );
	};

	const goNext = () => {
		if ( isAnswerRequired && ! isAnswered ) {
			setError( __( 'This question requires an answer.' ) );
			return;
		}
		setError( '' );
		setBusy( true );
		persistAnswer().finally( () => {
			setBusy( false );
			if ( isLastStep ) {
				finishAttempt( 'pending' );
			} else {
				setStepIndex( ( i ) => i + 1 );
			}
		} );
	};

	const goPrev = () => setStepIndex( ( i ) => Math.max( 0, i - 1 ) );

	if ( 'login_required' === phase ) {
		return <p className="tp-quiz-feedback tp-fail">{ __( 'Log in to take this quiz.' ) }</p>;
	}
	if ( 'loading' === phase ) {
		return <p className="tp-quiz-feedback">{ __( 'Loading…' ) }</p>;
	}
	if ( 'unavailable' === phase ) {
		return <p className="tp-quiz-feedback tp-fail">{ __( "This quiz isn't available right now." ) }</p>;
	}

	if ( 'start' === phase ) {
		const feedbackMode = quizMeta && quizMeta.quizpress_quiz_feedback_mode;
		const maxAttempts = Number( quizMeta && quizMeta.quizpress_quiz_max_attempts_allowed ) || 0;
		const passingGrade = ( quizMeta && quizMeta.quizpress_quiz_passing_grade ) || 0;
		const startable = canStartAttempt( feedbackMode, maxAttempts, attempts.length );
		return (
			<div className="tp-quiz-qp-start">
				<p>{ __sprintf( 'Passing grade: %d%%', passingGrade ) }</p>
				<p>
					{ maxAttempts
						? __sprintf( 'Attempts used: %1$d/%2$d', attempts.length, maxAttempts )
						: __sprintf( 'Attempts used: %d', attempts.length ) }
				</p>
				{ error && <p className="tp-quiz-feedback tp-fail">{ error }</p> }
				{ startable ? (
					<button className="tp-quiz-submit" disabled={ busy } onClick={ startAttempt }>
						{ busy ? __( 'Starting…' ) : attempts.length > 0 ? __( 'Retake quiz' ) : __( 'Start quiz' ) }
					</button>
				) : (
					<p className="tp-quiz-feedback tp-fail">{ __( 'No attempts remaining.' ) }</p>
				) }
			</div>
		);
	}

	if ( ( 'taking' === phase || 'finishing' === phase ) && question ) {
		return (
			<div className="tp-quiz-qp-step">
				<p className="tp-quiz-qp-progress">
					{ __sprintf( 'Question %1$d of %2$d', stepIndex + 1, questions.length ) }
				</p>
				<p className="tp-quiz-prompt">{ question.question_title }</p>
				<div className="tp-quiz-qp-widget">
					{ applyFilters( 'quizpress.question-answer-widget.content', null, {
						question,
						value,
						onChange: ( newValue ) => setAnswers( ( a ) => ( { ...a, [ question.question_id ]: newValue } ) ),
					} ) || <AnswerWidgetFallback /> }
				</div>
				{ error && <p className="tp-quiz-feedback tp-fail">{ error }</p> }
				<div className="tp-quiz-qp-nav">
					<button type="button" className="tp-quiz-qp-prev" disabled={ 0 === stepIndex || busy } onClick={ goPrev }>
						{ __( 'Previous' ) }
					</button>
					<button type="button" className="tp-quiz-submit" disabled={ busy || 'finishing' === phase } onClick={ goNext }>
						{ isLastStep ? __( 'Finish' ) : __( 'Next' ) }
					</button>
				</div>
			</div>
		);
	}

	if ( 'done' === phase ) {
		// onAttemptFinished (Quiz.jsx's own submit) has already fired — in both
		// preview and the real embed it now asks TruePlayer's real /grade
		// endpoint (preview flags it to skip attempt/lock bookkeeping, but
		// still reads QuizPress's actual result). That parent owns every
		// remaining bit of feedback — its own "Checking…" while the request is
		// in flight, then the one final Passed/Not-quite/Pending message —
		// so render nothing here rather than a second, potentially
		// contradicting message.
		return null;
	}

	return null;
}
