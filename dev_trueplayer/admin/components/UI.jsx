/** Shared Tailwind UI primitives — StoreEngine-inspired design language. */
import { useState, Children, isValidElement } from '@wordpress/element';
import ReactSelect from 'react-select';

export function Button( { children, variant = 'primary', size = 'md', className = '', type = 'button', ...rest } ) {
	const styles = {
		primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-card',
		ghost: 'bg-white hover:bg-gray-50 text-ink border border-line',
		subtle: 'bg-brand-50 hover:bg-brand-100 text-brand-700',
		danger: 'bg-white hover:bg-red-50 text-red-600 border border-red-200',
	};
	const sizes = {
		sm: 'px-2.5 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm',
	};
	return (
		<button
			type={ type }
			className={ `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${ styles[ variant ] } ${ sizes[ size ] } ${ className }` }
			{ ...rest }
		>
			{ children }
		</button>
	);
}

export function Field( { label, hint, children, className = '' } ) {
	return (
		<label className={ `block mb-5 ${ className }` }>
			{ label && <span className="block text-[13px] font-medium text-ink mb-1.5">{ label }</span> }
			{ children }
			{ hint && <span className="block text-xs text-gray-400 mt-1.5">{ hint }</span> }
		</label>
	);
}

const controlBase =
	'w-full h-10 rounded-md border border-line px-3 text-sm text-ink bg-white transition-shadow placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none';

export function Input( { className = '', ...props } ) {
	return <input { ...props } className={ `${ controlBase } ${ className }` } />;
}

export function Textarea( { className = '', ...props } ) {
	return <textarea { ...props } className={ `w-full rounded-md border border-line px-3 py-2 text-sm text-ink bg-white transition-shadow placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none ${ className }` } />;
}

/** Reads <option> children (including ones produced by .map()) into react-select's { value, label } shape. */
function optionsFromChildren( children ) {
	const options = [];
	Children.forEach( children, ( child ) => {
		if ( ! isValidElement( child ) ) {
			return;
		}
		if ( child.type === 'option' ) {
			options.push( { value: child.props.value, label: child.props.children, isDisabled: !! child.props.disabled } );
		} else if ( child.props && child.props.children ) {
			options.push( ...optionsFromChildren( child.props.children ) );
		}
	} );
	return options;
}

/** className is user-facing sizing (w-40, h-9, text-xs…) — applied to the visible control box, not react-select's layout wrapper. */
const selectClassNames = ( className ) => ( {
	control: ( state ) =>
		`min-h-10 rounded-md border px-2 text-sm bg-white transition-shadow ${ className } ${
			state.isDisabled ? 'opacity-50 bg-gray-50' : ''
		} ${ state.isFocused ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line' }`,
	valueContainer: () => 'gap-1 py-0.5',
	placeholder: () => 'text-gray-400',
	singleValue: () => 'text-ink',
	input: () => 'text-ink',
	indicatorSeparator: () => 'hidden',
	dropdownIndicator: () => 'text-gray-500 px-1',
	menu: () => 'mt-1 rounded-md border border-line bg-white shadow-card overflow-hidden z-50',
	menuList: () => 'py-1 max-h-60',
	option: ( state ) =>
		`px-3 py-2 text-sm cursor-pointer ${ state.isDisabled ? 'opacity-40 cursor-not-allowed' : '' } ${
			state.isSelected ? 'bg-brand-500 text-white' : state.isFocused ? 'bg-brand-50 text-ink' : 'text-ink'
		}`,
} );

/** Drop-in for a native <select> — takes <option> children and a scalar value/onChange( e ) pair. */
export function Select( { className = '', children, value, onChange, disabled, ...props } ) {
	const options = optionsFromChildren( children );
	const selected = options.find( ( o ) => String( o.value ) === String( value ) ) || null;

	return (
		<ReactSelect
			unstyled
			classNamePrefix="tp-select"
			className={ className.includes( 'w-' ) ? '' : 'w-full' }
			classNames={ selectClassNames( className ) }
			options={ options }
			value={ selected }
			isOptionDisabled={ ( o ) => !! o.isDisabled }
			isDisabled={ !! disabled }
			onChange={ ( option ) => onChange && onChange( { target: { value: option ? option.value : '' } } ) }
			{ ...props }
		/>
	);
}

export function Card( { children, className = '' } ) {
	return <div className={ `bg-white rounded-card border border-line shadow-card ${ className }` }>{ children }</div>;
}

/** Centered confirm dialog — e.g. the "unsaved changes" prompt before leaving a dirty screen. */
export function ConfirmModal( { title, children, confirmLabel = 'Discard changes', cancelLabel = 'Keep editing', onConfirm, onCancel } ) {
	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={ onCancel }>
			<div className="bg-white rounded-card shadow-pop max-w-sm w-full p-6" onClick={ ( e ) => e.stopPropagation() }>
				{ title && <h3 className="text-lg font-semibold text-ink mb-2">{ title }</h3> }
				<div className="text-sm text-gray-500 mb-6">{ children }</div>
				<div className="flex justify-end gap-2">
					<Button variant="ghost" onClick={ onCancel }>{ cancelLabel }</Button>
					<Button variant="danger" onClick={ onConfirm }>{ confirmLabel }</Button>
				</div>
			</div>
		</div>
	);
}

export function SectionTitle( { title, description } ) {
	return (
		<div className="mb-5">
			<h3 className="text-[15px] font-semibold text-ink">{ title }</h3>
			{ description && <p className="text-[13px] text-gray-500 mt-0.5">{ description }</p> }
		</div>
	);
}

export function Toggle( { checked, onChange, label, disabled = false } ) {
	return (
		<label className={ `flex items-center gap-3 mb-3.5 select-none ${ disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer' }` }>
			<span
				onClick={ () => ! disabled && onChange( ! checked ) }
				className={ `relative inline-block w-[38px] h-[22px] rounded-full transition-colors ${ checked ? 'bg-brand-500' : 'bg-gray-300' }` }
			>
				<span className={ `absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${ checked ? 'translate-x-4' : '' }` } />
			</span>
			{ label && <span className="text-[13px] text-ink">{ label }</span> }
		</label>
	);
}

export function Badge( { children, tone = 'gray' } ) {
	const tones = {
		gray: 'bg-gray-100 text-gray-600',
		brand: 'bg-brand-50 text-brand-700',
		green: 'bg-green-100 text-green-700',
		amber: 'bg-amber-100 text-amber-700',
		red: 'bg-red-100 text-red-700',
	};
	return <span className={ `inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ tones[ tone ] }` }>{ children }</span>;
}

/** Per-source-type display metadata (label + badge tone) for a video's source. */
export function sourceMeta( source = {} ) {
	const type = source.mediaType === 'audio' ? 'audio' : source.type;
	const map = {
		url: { label: 'MP4', tone: 'brand' },
		hls: { label: 'HLS', tone: 'amber' },
		youtube: { label: 'YouTube', tone: 'red' },
		vimeo: { label: 'Vimeo', tone: 'brand' },
		bunny: { label: 'Bunny', tone: 'green' },
		mux: { label: 'Mux', tone: 'brand' },
		audio: { label: 'Audio', tone: 'gray' },
	};
	return map[ type ] || { label: type || 'no source', tone: 'gray' };
}

/** 16:9 poster thumbnail with a graceful fallback tile keyed to the source type. */
export function Thumb( { poster, type, className = '' } ) {
	const [ broken, setBroken ] = useState( false );
	const isAudio = type === 'audio';
	const showPoster = poster && ! broken;
	return (
		<div className={ `relative shrink-0 w-24 aspect-video rounded-lg overflow-hidden border border-line bg-gray-100 ${ className }` }>
			{ showPoster ? (
				<img src={ poster } alt="" loading="lazy" onError={ () => setBroken( true ) } className="w-full h-full object-cover" />
			) : (
				<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 text-gray-400">
					<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
						<path d={ isAudio ? 'M12 3v10.55A4 4 0 1014 17V7h4V3h-6z' : 'M8 5v14l11-7z' } />
					</svg>
				</div>
			) }
		</div>
	);
}
