import { Link } from 'react-router-dom';
import { Icon } from './icons';

/**
 * crumbs: [ { label, href?, onClick?, editable?, onChange? } ]
 * - href (+ onClick) renders a real <Link> — onClick always runs instead of the
 *   default navigation so a dirty screen can intercept with a confirm modal.
 * - editable renders the entity's title as an inline, in-place-editable field
 *   (e.g. "Presets > My preset") instead of static text.
 * - a plain label with neither is the current, non-interactive screen.
 */
export default function Header( { crumbs = [], homeHref = '', onHomeClick } ) {
	const home = ( e ) => { e.preventDefault(); onHomeClick && onHomeClick(); };
	return (
		<header className="sticky top-8 z-30 bg-white border border-line shadow-card h-14 flex items-center px-5 gap-2 shrink-0">
			<Link to={ homeHref } onClick={ home } className="inline-flex w-8 h-8 rounded-lg bg-brand-500 text-white items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
			</Link>
			<Link to={ homeHref } onClick={ home } className="font-bold text-[15px] tracking-tight hover:text-brand-600 transition-colors">
				TruePlayer
			</Link>
			{ crumbs.map( ( c, i ) => (
				<span key={ i } className="flex items-center gap-2 min-w-0">
					<Icon name="chevronRight" className="w-4 h-4 text-gray-300 shrink-0" strokeWidth={ 2 } />
					{ c.editable ? (
						<input
							value={ c.label || '' }
							onChange={ ( e ) => c.onChange && c.onChange( e.target.value ) }
							placeholder="Untitled"
							size={ Math.max( ( c.label || '' ).length, 6 ) }
							className="text-sm font-medium text-gray-700 bg-transparent outline-none border-b border-transparent focus:border-line max-w-[240px]"
						/>
					) : c.href ? (
						<Link
							to={ c.href }
							onClick={ ( e ) => { e.preventDefault(); c.onClick && c.onClick(); } }
							className="text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors truncate"
						>
							{ c.label }
						</Link>
					) : (
						<span className="text-sm font-medium text-gray-700 truncate">{ c.label }</span>
					) }
				</span>
			) ) }
			{ /* Screens (e.g. the editor) portal their toolbar actions here. */ }
			<div id="tp-topbar-slot" className="ml-auto flex items-center gap-2.5 shrink-0" />
		</header>
	);
}
