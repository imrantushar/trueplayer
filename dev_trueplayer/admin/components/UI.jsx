/** Shared Tailwind UI primitives — GemCRM design language (see gemcrm/ui_rule.md). */
import { useState } from '@wordpress/element';

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

export function Select( { className = '', children, ...props } ) {
	return (
		<select { ...props } className={ `${ controlBase } pr-8 appearance-none bg-no-repeat ${ className }` } style={ { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23738496\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundPosition: 'right 10px center' } }>
			{ children }
		</select>
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
			<nav className="space-y-1 sticky top-4">
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
export function SectionTitle( { title, description } ) {
	return (
		<div className="mb-6 pb-4 border-b border-line">
			<h3 className="text-base font-semibold leading-6 text-ink">{ title }</h3>
			{ description && <p className="text-[13px] text-muted mt-1">{ description }</p> }
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
