import { useState } from '@wordpress/element';
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

	const questions = quiz.questions || [];
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
