/**
 * Client-side quiz grading — used ONLY in admin preview mode, where the full
 * config (including correct answers) is available. Mirrors the server-side
 * GradingService::is_correct logic so the preview matches production grading.
 * The live frontend never uses this (answers are stripped before they reach
 * the browser).
 */
function toBool( v ) {
	return v === true || v === 'true' || v === '1' || v === 1;
}

function isCorrect( q, given ) {
	if ( q.type === 'boolean' ) {
		const c = q.correct !== undefined ? q.correct : q.answer;
		return toBool( given ) === toBool( c );
	}
	let correctIds = [];
	if ( q.correct !== undefined && q.correct !== null ) {
		correctIds = Array.isArray( q.correct ) ? q.correct : [ q.correct ];
	} else if ( Array.isArray( q.correctIndexes ) ) {
		correctIds = q.correctIndexes;
	} else if ( Array.isArray( q.options ) ) {
		correctIds = q.options.filter( ( o ) => o && o.isCorrect ).map( ( o ) => o.id );
	}
	const givenIds = Array.isArray( given ) ? given : ( given === undefined || given === null ? [] : [ given ] );
	const a = correctIds.map( String ).sort();
	const b = givenIds.map( String ).sort();
	return a.length > 0 && JSON.stringify( a ) === JSON.stringify( b );
}

export function gradeLocal( quiz, answers ) {
	const questions = quiz.questions || [];
	const perQuestion = {};
	let correct = 0;
	questions.forEach( ( q ) => {
		const ok = isCorrect( q, answers[ q.id ] );
		perQuestion[ q.id ] = ok;
		if ( ok ) {
			correct++;
		}
	} );
	const total = questions.length;
	const score = total ? Math.round( ( correct / total ) * 10000 ) / 100 : 0;
	const passPercent = quiz.passPercent !== undefined ? quiz.passPercent : 70;
	return { passed: score >= passPercent, score, perQuestion };
}
