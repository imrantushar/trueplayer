import { Button } from './UI';
import { pickMedia } from '../utils/media';
import { __ } from '@Utils/translation';

/**
 * Upload-first media field — no URL text input. Empty shows a dashed upload
 * target; once set, a preview (images) or filename plus Replace / Remove.
 * `onChange` receives the URL string ('' when removed).
 */
export default function MediaPicker( { value, onChange, accept = 'image', label = __( 'Upload' ) } ) {
	const pick = () => pickMedia( accept, ( url ) => onChange( url ) );
	const isImage = accept === 'image';

	if ( value ) {
		return (
			<div className="flex items-center gap-3">
				{ isImage ? (
					<div className="p-1.5 bg-gray-100 rounded border border-line shrink-0">
						<img src={ value } alt="" className="max-h-10 max-w-[100px] block" />
					</div>
				) : (
					<span className="text-sm text-muted truncate max-w-[220px]">{ value.split( '/' ).pop() }</span>
				) }
				<Button variant="ghost" size="sm" onClick={ pick }>{ __( 'Replace' ) }</Button>
				<Button variant="ghost" size="sm" onClick={ () => onChange( '' ) }>{ __( 'Remove' ) }</Button>
			</div>
		);
	}
	return (
		<button
			type="button"
			onClick={ pick }
			className="w-full border border-dashed border-line rounded-card py-6 text-center text-sm text-muted hover:border-brand-400 hover:text-brand-500 transition-colors"
		>
			<span className="block text-xl leading-none mb-1">+</span>
			{ label }
		</button>
	);
}
