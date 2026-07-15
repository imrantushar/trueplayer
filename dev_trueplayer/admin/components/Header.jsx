import { Icon } from './icons';

/**
 * Top bar — brand + breadcrumb + a slot screens portal their toolbar into.
 * Section navigation lives in the WordPress admin submenu; the only in-app
 * sidebar is the video editor's step menu.
 *
 * crumbs: [ { label, onClick?, editable?, onChange? } ]
 * - onClick → clickable crumb (client-side, via App's go() or a local "back").
 * - editable → the current entity's title, rendered as an inline input right
 *   in the trail (not a separate slot) so it lines up with the other crumbs.
 * - neither → plain static label (the current screen, non-editable).
 */
export default function Header( { crumbs = [], onHome } ) {
	return (
		<header className="sticky top-8 z-30 bg-white border-b border-line h-14 flex items-center px-5 gap-2 shrink-0">
			<button onClick={ onHome } className="inline-flex w-8 h-8 rounded bg-brand-500 text-white items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
			</button>
			<button onClick={ onHome } className="font-bold text-[15px] tracking-tight hover:text-brand-500 transition-colors">TruePlayer</button>
			{ crumbs.map( ( c, i ) => (
				<span key={ i } className="flex items-center gap-2 min-w-0">
					<Icon name="chevronRight" className="w-4 h-4 text-gray-300 shrink-0" strokeWidth={ 2 } />
					{ c.editable ? (
						<input
							value={ c.label || '' }
							onChange={ ( e ) => c.onChange && c.onChange( e.target.value ) }
							placeholder="Untitled"
							size={ Math.max( ( c.label || '' ).length, 6 ) }
							aria-label="Title"
							className="text-sm font-semibold text-ink bg-transparent outline-none border-b border-transparent focus:border-brand-500 min-w-0 max-w-[40vw]"
						/>
					) : c.onClick ? (
						<button onClick={ c.onClick } className="text-sm font-medium text-muted hover:text-brand-500 transition-colors truncate">{ c.label }</button>
					) : (
						<span className="text-sm font-medium text-muted truncate">{ c.label }</span>
					) }
				</span>
			) ) }
			{ /* Screens (e.g. the editor) portal their toolbar actions here. */ }
			<div id="tp-topbar-slot" className="ml-auto flex items-center gap-2.5 shrink-0" />
		</header>
	);
}
