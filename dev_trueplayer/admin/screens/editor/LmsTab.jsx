import { useEffect, useState } from '@wordpress/element';
import { api } from '../../api';
import { Card, Field, Input, Select, Badge } from '../../components/UI';

/**
 * Maps this video to an Academy LMS lesson so watch-completion + quiz-pass
 * mark the lesson complete, and playback is gated by enrollment.
 * Stored as config.lms = { provider:'academy', course, topic }.
 */
export default function LmsTab( { config, patch } ) {
	const lms = config.lms || { provider: 'academy' };
	const [ courses, setCourses ] = useState( null );

	useEffect( () => {
		api.getAcademyCourses().then( setCourses ).catch( () => setCourses( [] ) );
	}, [] );

	const set = ( partial ) => patch( { lms: { ...lms, ...partial } } );

	const academyDetected = courses !== null;
	const noCourses = academyDetected && courses.length === 0;

	return (
		<Card className="p-6 max-w-2xl">
			<div className="flex items-center gap-3 mb-4">
				<h3 className="font-semibold text-gray-900">Course mapping (LMS)</h3>
				<Badge tone={ academyDetected && ! noCourses ? 'green' : 'gray' }>
					{ courses === null ? 'checking…' : noCourses ? 'no Academy courses' : 'Academy detected' }
				</Badge>
			</div>
			<p className="text-sm text-gray-500 mb-4">
				Link this video to an Academy lesson. Watching it (and passing its quiz) marks the lesson complete and rolls up to the course certificate. Playback is gated by enrollment.
			</p>

			<Field label="LMS">
				<Select value={ lms.provider || 'academy' } onChange={ ( e ) => set( { provider: e.target.value } ) }>
					<option value="">— None —</option>
					<option value="academy">Academy LMS</option>
				</Select>
			</Field>

			{ lms.provider === 'academy' && (
				<>
					<Field label="Course" hint="Playback requires enrollment in this course.">
						<Select value={ lms.course || '' } onChange={ ( e ) => set( { course: parseInt( e.target.value, 10 ) || 0 } ) }>
							<option value="">— Select a course —</option>
							{ ( courses || [] ).map( ( c ) => (
								<option key={ c.id } value={ c.id }>{ c.title }</option>
							) ) }
						</Select>
					</Field>
					<Field label="Lesson ID" hint="The Academy lesson (topic) ID this video belongs to. Marked complete on watch.">
						<Input type="number" className="w-40" value={ lms.topic || '' } onChange={ ( e ) => set( { topic: parseInt( e.target.value, 10 ) || 0 } ) } placeholder="e.g. 142" />
					</Field>
					{ noCourses && <p className="text-xs text-amber-600">No Academy courses found — create a course first, or this mapping stays inactive.</p> }
				</>
			) }
		</Card>
	);
}
