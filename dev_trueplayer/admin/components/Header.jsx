import { Icon } from './icons';

/**
 * Top bar — brand + breadcrumb + a slot screens portal their toolbar into.
 * Section navigation lives in the WordPress admin submenu; the only in-app
 * sidebar is the video editor's step menu.
 */
export default function Header( { title } ) {
	return (
		<header className="bg-white border-b border-line h-14 flex items-center px-5 gap-2 shrink-0">
			<span className="inline-flex w-8 h-8 rounded bg-brand-500 text-white items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
			</span>
			<span className="font-bold text-[15px] tracking-tight">TruePlayer</span>
			<Icon name="chevronRight" className="w-4 h-4 text-gray-300 shrink-0" strokeWidth={ 2 } />
			{ title && <span className="text-sm font-medium text-muted truncate">{ title }</span> }
			{ /* The editor portals its editable media title here. */ }
			<div id="tp-topbar-title-slot" className="flex items-center min-w-0" />
			{ /* Screens (e.g. the editor) portal their toolbar actions here. */ }
			<div id="tp-topbar-slot" className="ml-auto flex items-center gap-2.5 shrink-0" />
		</header>
	);
}
