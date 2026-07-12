/** Shared Tailwind UI primitives — GemCRM design language (see gemcrm/ui_rule.md). */
import { useState, Children } from '@wordpress/element';
import ReactSelect from 'react-select';

export function Button( { children, variant = 'primary', size = 'md', className = '', ...rest } ) {
	// GemCRM button presets: primary (solid blue), secondary/ghost (outline),
	// light/subtle (soft blue), clear (text), danger (soft red).
	const styles = {
		primary: 'bg-brand-500 hover:opacity-90 text-white border border-brand-500',
		ghost: 'bg-white hover:bg-brand-50 text-ink border border-line',
		secondary: 'bg-transparent hover:bg-brand-50 text-ink border border-line',
		subtle: 'bg-brand-100 hover:opacity-90 text-brand-500 border border-transparent',
		clear: 'bg-transparent hover:bg-brand-50 text-brand-500 border border-transparent',
		danger: 'bg-danger-light hover:opacity-90 text-danger border border-transparent',
	};
	// Compact, medium-weight sizing (md is the comfortable default).
	const sizes = {
		xs: 'px-2.5 py-1 text-xs',
		sm: 'px-3 py-1.5 text-[13px]',
		md: 'px-4 py-2 text-sm',
		lg: 'px-5 py-2.5 text-sm',
	};
	return (
		<button
			className={ `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium leading-5 transition-[opacity,background-color,color] disabled:opacity-50 disabled:pointer-events-none ${ styles[ variant ] || styles.primary } ${ sizes[ size ] || sizes.md } ${ className }` }
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
	'w-full h-10 rounded border border-line px-3 text-sm text-ink bg-white transition-shadow placeholder:text-placeholder focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none';

export function Input( { className = '', ...props } ) {
	return <input { ...props } className={ `${ controlBase } ${ className }` } />;
}

export function Textarea( { className = '', ...props } ) {
	return <textarea { ...props } className={ `w-full rounded border border-line px-3 py-2 text-sm text-ink bg-white transition-shadow placeholder:text-placeholder focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none ${ className }` } />;
}

/** Flatten a React children tree to its text (for react-select option labels). */
function nodeText( node ) {
	if ( node == null || node === false || node === true ) {
		return '';
	}
	if ( typeof node === 'string' || typeof node === 'number' ) {
		return String( node );
	}
	if ( Array.isArray( node ) ) {
		return node.map( nodeText ).join( '' );
	}
	if ( node.props && node.props.children != null ) {
		return nodeText( node.props.children );
	}
	return '';
}

const RS_STYLES = {
	control: ( base, s ) => ( {
		...base, minHeight: 40, borderRadius: 4, fontSize: 14, backgroundColor: '#fff',
		borderColor: s.isFocused ? '#006BFF' : '#e5e7eb',
		boxShadow: s.isFocused ? '0 0 0 2px #E3E7FF' : 'none',
		'&:hover': { borderColor: s.isFocused ? '#006BFF' : '#cbd1d7' },
	} ),
	valueContainer: ( base ) => ( { ...base, padding: '0 4px 0 10px' } ),
	placeholder: ( base ) => ( { ...base, color: '#A2ADB9' } ),
	singleValue: ( base ) => ( { ...base, color: '#1f2937' } ),
	indicatorSeparator: () => ( { display: 'none' } ),
	dropdownIndicator: ( base ) => ( { ...base, color: '#738496', padding: 6 } ),
	menu: ( base ) => ( { ...base, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 8px 28px rgba(16,24,40,0.12)' } ),
	menuPortal: ( base ) => ( { ...base, zIndex: 100000 } ),
	option: ( base, s ) => ( {
		...base, fontSize: 14, cursor: 'pointer',
		backgroundColor: s.isSelected ? '#006BFF' : s.isFocused ? '#E3E7FF' : '#fff',
		color: s.isSelected ? '#fff' : s.isDisabled ? '#9ca3af' : '#1f2937',
		':active': { backgroundColor: s.isSelected ? '#006BFF' : '#E3E7FF' },
	} ),
};

/**
 * react-select, kept API-compatible with the old native `<Select>`: accepts
 * `<option>` children, a string `value`, and an event-shaped `onChange`
 * ({ target: { value } }) so every call site works unchanged.
 */
export function Select( { className = '', children, value, onChange, disabled = false, ...rest } ) {
	const options = [];
	Children.toArray( children ).forEach( ( c ) => {
		if ( c && c.type === 'option' ) {
			options.push( { value: c.props.value, label: nodeText( c.props.children ), isDisabled: !! c.props.disabled } );
		}
	} );
	const selected = options.find( ( o ) => String( o.value ) === String( value ?? '' ) ) || null;
	return (
		<ReactSelect
			className={ className }
			classNamePrefix="tp-rs"
			options={ options }
			value={ selected }
			isDisabled={ disabled }
			isSearchable={ options.length > 6 }
			menuPortalTarget={ typeof document !== 'undefined' ? document.body : null }
			menuPlacement="auto"
			styles={ RS_STYLES }
			onChange={ ( opt ) => onChange && onChange( { target: { value: opt ? opt.value : '' } } ) }
			{ ...rest }
		/>
	);
}

export function Card( { children, className = '' } ) {
	return <div className={ `bg-white rounded-card border border-line shadow-card ${ className }` }>{ children }</div>;
}

/**
 * Vertical sub-navigation column for a tab with many groups. `items` is a list
 * of [key, label] pairs; pairs may include a third `pro` flag for a badge.
 */
export function SubSidebar( { items, value, onChange, className = '' } ) {
	return (
		<aside className={ `w-44 shrink-0 ${ className }` }>
			<nav className="space-y-1 sticky top-4 bg-white border border-line rounded-card p-2">
				{ items.map( ( [ key, label, pro ] ) => (
					<button
						key={ key }
						onClick={ () => onChange( key ) }
						className={ `flex items-center justify-between w-full px-3 py-2 rounded text-sm font-medium text-left transition-colors ${
							value === key ? 'bg-brand-100 text-brand-500' : 'text-label hover:bg-gray-100'
						}` }
					>
						<span className="truncate">{ label }</span>
						{ pro && <span className="text-[10px] font-semibold text-brand-500">PRO</span> }
					</button>
				) ) }
			</nav>
		</aside>
	);
}

/** Centered modal dialog. Click the backdrop or ✕ to close. */
export function Modal( { title, onClose, children, footer, className = '' } ) {
	return (
		<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={ onClose }>
			<div className={ `bg-white rounded-card shadow-pop w-full max-w-md ${ className }` } onClick={ ( e ) => e.stopPropagation() }>
				<div className="flex items-center justify-between px-6 py-4 border-b border-line">
					<h3 className="text-base font-semibold text-ink">{ title }</h3>
					<button onClick={ onClose } className="text-muted hover:text-ink text-lg leading-none" aria-label="Close">×</button>
				</div>
				<div className="p-6">{ children }</div>
				{ footer && <div className="px-6 py-4 border-t border-line flex justify-end gap-2">{ footer }</div> }
			</div>
		</div>
	);
}

/** GemCRM section heading: 16px / 600 / 24px with an underline rule. */
export function SectionTitle( { title, description, children } ) {
	return (
		<div className="mb-6 pb-4 border-b border-line">
			<h3 className="text-base font-semibold leading-6 text-ink">{ title || children }</h3>
			{ description && <p className="text-[13px] text-muted mt-1">{ description }</p> }
		</div>
	);
}

/** Aligned color swatch + hex input. `onChange` receives the value string. */
export function ColorInput( { value, onChange, placeholder = '' } ) {
	return (
		<div className="flex gap-2 items-center">
			<input
				type="color"
				value={ value || '#000000' }
				onChange={ ( e ) => onChange( e.target.value ) }
				className="h-10 w-11 shrink-0 rounded border border-line p-1 bg-white cursor-pointer"
			/>
			<Input value={ value || '' } onChange={ ( e ) => onChange( e.target.value ) } placeholder={ placeholder } />
		</div>
	);
}

export function Toggle( { checked, onChange, label, disabled = false } ) {
	return (
		<label className={ `flex items-start gap-3 mb-3.5 select-none ${ disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer' }` }>
			<span
				onClick={ () => ! disabled && onChange( ! checked ) }
				className={ `relative inline-block shrink-0 mt-px w-[38px] h-[22px] rounded-full transition-colors ${ checked ? 'bg-brand-500' : 'bg-gray-300' }` }
			>
				<span className={ `absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${ checked ? 'translate-x-4' : '' }` } />
			</span>
			{ label && <span className="text-[13px] text-ink leading-5">{ label }</span> }
		</label>
	);
}

/** Compact numbered pagination. Hidden when there's only one page. */
export function Pagination( { page, pages, onPage } ) {
	if ( pages <= 1 ) {
		return null;
	}
	// Windowed page list with ellipses: 1 … (p-1) p (p+1) … last.
	const nums = [];
	for ( let i = 1; i <= pages; i++ ) {
		if ( i === 1 || i === pages || Math.abs( i - page ) <= 1 ) {
			nums.push( i );
		} else if ( nums[ nums.length - 1 ] !== '…' ) {
			nums.push( '…' );
		}
	}
	const btn = 'min-w-[34px] h-[34px] px-2 rounded text-sm font-medium border border-line disabled:opacity-40 disabled:pointer-events-none';
	return (
		<div className="flex items-center justify-center gap-1 mt-6">
			<button className={ btn } disabled={ page <= 1 } onClick={ () => onPage( page - 1 ) } aria-label="Previous page">‹</button>
			{ nums.map( ( n, i ) => n === '…'
				? <span key={ `e${ i }` } className="px-1 text-muted">…</span>
				: <button key={ n } onClick={ () => onPage( n ) } className={ `${ btn } ${ n === page ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-ink hover:bg-gray-50' }` }>{ n }</button>
			) }
			<button className={ btn } disabled={ page >= pages } onClick={ () => onPage( page + 1 ) } aria-label="Next page">›</button>
		</div>
	);
}

export function Badge( { children, tone = 'gray' } ) {
	// GemCRM status pills: soft tinted background + saturated text, 999px radius.
	const tones = {
		gray: 'bg-gray-100 text-muted',
		brand: 'bg-brand-100 text-brand-500',
		green: 'bg-success-light text-success',
		amber: 'bg-warning-light text-warning',
		red: 'bg-danger-light text-danger',
	};
	return <span className={ `inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${ tones[ tone ] || tones.gray }` }>{ children }</span>;
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
