/** Shared Tailwind UI primitives — GemCRM design language (see gemcrm/ui_rule.md). */
import { useState, useRef, useEffect, useMemo, Children } from '@wordpress/element';
import ReactSelect from 'react-select';
import { Icon } from './icons';
import { posterCandidates } from '../utils/poster';
import { BsThreeDots } from "react-icons/bs";
import { IoClose } from "react-icons/io5";
import { __ } from '@Utils/translation';

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
		// Destructive, but secondary to the action beside it — a bordered
		// Remove reads as equal in weight to the Replace it sits next to.
		dangerClear: 'bg-transparent hover:bg-danger-light text-danger border border-transparent',
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

export function Field( { label, hint, required = false, children, className = '' } ) {
	return (
		<label className={ `block mb-5 ${ className }` }>
			{ label && (
				<span className="block text-[13px] font-medium text-ink mb-1.5">
					{ label }{ required && <span className="text-danger"> *</span> }
				</span>
			) }
			{ children }
			{ hint && <span className="block text-xs text-gray-400 mt-1.5">{ hint }</span> }
		</label>
	);
}

/**
 * A labelled block for controls that are themselves buttons — media pickers,
 * action rows — where `Field` is the wrong element: it renders a <label>, and
 * a label wrapping buttons folds their text into its accessible name and
 * forwards stray clicks into the first one. Same look, plain <div>.
 */
export function FieldGroup( { label, hint, required = false, children, className = '' } ) {
	return (
		<div className={ `block mb-5 ${ className }` }>
			{ label && (
				<span className="block text-[13px] font-medium text-ink mb-1.5">
					{ label }{ required && <span className="text-danger"> *</span> }
				</span>
			) }
			{ children }
			{ hint && <span className="block text-xs text-gray-400 mt-1.5">{ hint }</span> }
		</div>
	);
}

// `hover:` and `focus:` name the same colour on purpose — pointing at a field
// and landing on it are one continuous gesture, so they read as one state.
const controlBase =
	'w-full h-10 rounded border border-line px-3 text-sm text-ink bg-white transition-shadow placeholder:text-placeholder hover:border-brand-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none';

export function Input( { className = '', ...props } ) {
	return <input { ...props } className={ `${ controlBase } ${ className }` } />;
}

export function Textarea( { className = '', ...props } ) {
	return <textarea { ...props } className={ `w-full rounded border border-line px-3 py-2 text-sm text-ink bg-white transition-shadow placeholder:text-placeholder hover:border-brand-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none ${ className }` } />;
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
		...base, minHeight: 40, borderRadius: 4, fontSize: 14, backgroundColor: '#fff', cursor: 'pointer',
		borderColor: s.isFocused ? '#006BFF' : '#e5e7eb',
		boxShadow: s.isFocused ? '0 0 0 2px #E3E7FF' : 'none',
		// Hover previews the focus colour rather than a grey step towards it, so
		// pointing at a field and landing on it read as the same state.
		'&:hover': { borderColor: '#006BFF' },
	} ),
	// Text starts exactly where an <Input>'s does (px-3 = 12px). react-select
	// reaches that total by adding its own 2px margins to whatever the value
	// container pads, so the two only lined up by coincidence — the margins are
	// zeroed here and the padding states the full 12px, which is what keeps a
	// select and an input stacked in a column reading as one field.
	valueContainer: ( base ) => ( { ...base, padding: '0 4px 0 12px' } ),
	input: ( base ) => ( { ...base, cursor: 'inherit', margin: 0, paddingTop: 0, paddingBottom: 0 } ),
	placeholder: ( base ) => ( { ...base, color: '#A2ADB9', margin: 0 } ),
	singleValue: ( base ) => ( { ...base, color: '#1f2937', margin: 0 } ),
	indicatorSeparator: () => ( { display: 'none' } ),
	dropdownIndicator: ( base ) => ( { ...base, color: '#738496', padding: 6, cursor: 'pointer' } ),
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
 * A Card whose body folds away behind its own heading.
 *
 * For settings that are only relevant to some installs: the title and its
 * description stay readable while closed, so the screen still says what is on
 * offer, and only the fields — the part that costs vertical space and invites
 * mis-pasting — are hidden until asked for.
 *
 * `open` / `onToggle` are controlled, so a caller can run several of these as
 * one accordion by holding a single "which is open" value. `badge` renders to
 * the right of the title, for saying something about the closed state.
 */
export function CollapsibleCard( { title, description, badge, open, onToggle, children, className = '' } ) {
	const bodyId = useRef( `tp-panel-${ Math.random().toString( 36 ).slice( 2, 9 ) }` ).current;

	return (
		<Card className={ className }>
			<button
				type="button"
				onClick={ onToggle }
				aria-expanded={ open }
				aria-controls={ bodyId }
				className="w-full text-left flex items-start gap-3 p-6 group"
			>
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-2">
						<span className="font-semibold text-gray-900 group-hover:text-brand-500 transition-colors">{ title }</span>
						{ badge }
					</span>
					{ description && <span className="block text-sm text-muted mt-1">{ description }</span> }
				</span>
				{ /* The chevron points right when closed and down when open —
				     rotating one glyph rather than swapping two keeps the arrow
				     from jumping a pixel as it changes. */ }
				<Icon
					name="chevronRight"
					className={ `w-4 h-4 shrink-0 mt-0.5 text-gray-400 transition-transform ${ open ? 'rotate-90' : '' }` }
				/>
			</button>
			{ open && (
				<div id={ bodyId } className="px-6 pb-6 -mt-1">
					<div className="pt-5 border-t border-solid border-line">{ children }</div>
				</div>
			) }
		</Card>
	);
}

/** Row-actions dropdown — kebab trigger + icon/label menu. items: [ { label, icon, onClick, danger? } ]; danger items (e.g. Delete) render in red. */
/**
 * Primary action with a caret that reveals related actions — the main segment
 * fires the default action in one click, so secondary kinds cost no more than
 * they did on their own screens.
 */
export function SplitButton( { children, onClick, items = [], size = 'md', className = '' } ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef( null );

	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const close = ( e ) => {
			if ( ! ref.current || ! ref.current.contains( e.target ) ) {
				setOpen( false );
			}
		};
		const onKey = ( e ) => e.key === 'Escape' && setOpen( false );
		document.addEventListener( 'mousedown', close );
		document.addEventListener( 'keydown', onKey );
		return () => {
			document.removeEventListener( 'mousedown', close );
			document.removeEventListener( 'keydown', onKey );
		};
	}, [ open ] );

	const pad = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm';

	return (
		<div className={ `relative inline-flex ${ className }` } ref={ ref }>
			<button
				type="button"
				onClick={ onClick }
				className={ `inline-flex items-center gap-2 rounded-l font-medium bg-brand-500 hover:opacity-90 text-white border border-brand-500 transition-opacity ${ pad }` }
			>
				{ children }
			</button>
			<button
				type="button"
				onClick={ () => setOpen( ( o ) => ! o ) }
				aria-haspopup="menu"
				aria-expanded={ open }
				aria-label={ __( 'More create options' ) }
				className="inline-flex items-center justify-center w-8 rounded-r bg-brand-500 hover:opacity-90 text-white border border-brand-500 border-l-brand-600 transition-opacity"
			>
				<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
			</button>
			{ open && (
				<div className="absolute right-0 top-full mt-1 z-30 min-w-[190px] bg-white border border-line rounded-card shadow-pop py-1" role="menu">
					{ items.map( ( it ) => (
						<button
							key={ it.label }
							type="button"
							role="menuitem"
							onClick={ () => { setOpen( false ); it.onClick(); } }
							className="flex flex-col w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors"
						>
							<span className="text-[13px] font-medium text-ink">{ it.label }</span>
							{ it.hint && <span className="text-xs text-muted mt-0.5">{ it.hint }</span> }
						</button>
					) ) }
				</div>
			) }
		</div>
	);
}

export function OptionMenu( { items } ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef( null );

	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const close = ( e ) => {
			if ( ! ref.current || ! ref.current.contains( e.target ) ) {
				setOpen( false );
			}
		};
		const onKey = ( e ) => e.key === 'Escape' && setOpen( false );
		document.addEventListener( 'mousedown', close );
		document.addEventListener( 'keydown', onKey );
		return () => {
			document.removeEventListener( 'mousedown', close );
			document.removeEventListener( 'keydown', onKey );
		};
	}, [ open ] );

	return (
		<div className="relative shrink-0" ref={ ref }>
			<button
				type="button"
				onClick={ () => setOpen( ( o ) => ! o ) }
				aria-label={ __( 'More actions' ) }
				className="w-8 h-8 inline-flex items-center justify-center rounded text-muted hover:text-ink hover:bg-gray-100 transition-colors border border-line"
			>
				<BsThreeDots />
			</button>
			{ open && (
				<div className="absolute right-0 top-full mt-1 w-44 py-1 rounded border border-line bg-white shadow-pop z-20">
					{ items.map( ( it, i ) => (
						<button
							key={ i }
							type="button"
							onClick={ () => { setOpen( false ); it.onClick(); } }
							className={ `flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${ it.danger ? 'text-danger' : 'text-ink' }` }
						>
							{ it.icon && <Icon name={ it.icon } className="w-4 h-4 shrink-0" /> }
							{ it.label }
						</button>
					) ) }
				</div>
			) }
		</div>
	);
}

/**
 * Vertical sub-navigation column for a tab with many groups. `items` is a list
 * of [key, label] pairs; pairs may include a third `pro` flag for a badge.
 */
export function SubSidebar( { items, value, onChange, className = '' } ) {
	// Sticky lives directly on <nav> (not nested in a shrink-wrapped <aside>) —
	// a nested sticky child has no room to stick, since its containing block is
	// the short wrapper, not the tall row. Header (top-8) + its h-14 bar are
	// ~88px; top-[104px] clears both with a small gap.
	return (
		<nav className={ `w-full md:w-44 md:shrink-0 space-y-1 md:sticky md:top-[104px] bg-white border border-line rounded-card p-2 ${ className }` }>
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
	);
}

/** Centered modal dialog. Click the backdrop or ✕ to close. */
export function Modal( { title, onClose, children, footer, className = '' } ) {
	// Two max-w utilities on one element resolve by stylesheet order, not by
	// source order — so drop the default whenever the caller supplies its own.
	const width = className.includes( 'max-w-' ) ? '' : 'max-w-md';
	return (
		<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={ onClose }>
			{ /* Bounded column: the header and footer stay put and only the body
			     scrolls, so a tall dialog never runs off the top of the screen. */ }
			<div className={ `bg-white rounded-card shadow-pop w-full flex flex-col max-h-[calc(100vh-6rem)] ${ width } ${ className }` } onClick={ ( e ) => e.stopPropagation() }>
				<div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
					<h3 className="text-base font-semibold text-ink">{ title }</h3>
					<button onClick={ onClose } className="text-muted hover:text-ink text-lg leading-none" aria-label={ __( 'Close' ) }>&times;</button>
				</div>
				<div className="p-6 overflow-y-auto">{ children }</div>
				{ footer && <div className="px-6 py-4 border-t border-line flex items-center justify-end gap-2 shrink-0">{ footer }</div> }
			</div>
		</div>
	);
}

/** Transient floating notice, bottom-right. Caller owns the auto-dismiss timer. */
export function Toast( { message, tone = 'danger', onDismiss } ) {
	if ( ! message ) {
		return null;
	}
	const tones = {
		danger: 'bg-danger-light text-danger',
		success: 'bg-success-light text-success',
		gray: 'bg-ink text-white',
	};
	return (
		<div className="fixed bottom-6 right-6 z-[60]">
			<div className={ `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-pop ${ tones[ tone ] || tones.danger }` }>
				{ message }
				{ onDismiss && (
					<button type="button" onClick={ onDismiss } className="text-current opacity-60 hover:opacity-100 leading-none" aria-label={ __( 'Dismiss' ) }><IoClose /></button>
				) }
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

export function Toggle( { checked, onChange, label, disabled = false, className } ) {
	return (
		<label className={ `flex items-start gap-3 select-none ${ checked ? '' : '' } ${ disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer' } ${ className }` }>
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
			<button className={ btn } disabled={ page <= 1 } onClick={ () => onPage( page - 1 ) } aria-label={ __( 'Previous page' ) }>‹</button>
			{ nums.map( ( n, i ) => n === '…'
				? <span key={ `e${ i }` } className="px-1 text-muted">…</span>
				: <button key={ n } onClick={ () => onPage( n ) } className={ `${ btn } ${ n === page ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-ink hover:bg-gray-50' }` }>{ n }</button>
			) }
			<button className={ btn } disabled={ page >= pages } onClick={ () => onPage( page + 1 ) } aria-label={ __( 'Next page' ) }>›</button>
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

/**
 * Per-source-type display metadata (label + badge tone) for a video's source.
 *
 * Re-exported rather than defined here: this map used to be its own copy of the
 * type list and had already fallen behind — a `bunnyStorage` video rendered a
 * raw "bunnyStorage" badge because nobody remembered this file existed when
 * the type was added.
 */
export { sourceMeta } from '@Utils/source-types';

/**
 * 16:9 poster thumbnail with a graceful fallback tile keyed to the source type.
 *
 * Pass `source` to let a provider thumbnail stand in when the author set no
 * poster; the candidates are walked on error, since YouTube 404s its HD sizes
 * for non-HD uploads. `poster` alone is still accepted for callers that have
 * only the URL.
 */
export function Thumb( { poster, source, type, className = '' } ) {
	// Keyed on the fields that decide the image, not the `source` object —
	// callers rebuild that literal every render, so an identity dep would
	// recompute the chain (and reset the index) forever.
	const key = source ? `${ source.type || '' }|${ source.src || '' }|${ source.poster || '' }` : `|${ poster || '' }`;
	const candidates = useMemo(
		() => ( source ? posterCandidates( source ) : [ poster ].filter( Boolean ) ),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ key ]
	);
	const [ index, setIndex ] = useState( 0 );
	// A new source restarts the chain — otherwise the last video's failure
	// count would blank out a perfectly good thumbnail.
	useEffect( () => setIndex( 0 ), [ key ] );
	const isAudio = type === 'audio';
	const current = candidates[ index ];
	return (
		<div className={ `relative shrink-0 w-24 aspect-video rounded-lg overflow-hidden border border-line bg-gray-100 ${ className }` }>
			{ current ? (
				<img
					src={ current }
					alt=""
					loading="lazy"
					onError={ () => setIndex( ( i ) => i + 1 ) }
					className="w-full h-full object-cover"
				/>
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
