import { Icon } from './icons';

export default function Header( { title } ) {
	return (
		<header className="sticky top-8 z-30 bg-white border border-line shadow-card h-14 flex items-center px-5 gap-2 shrink-0">
			<span className="inline-flex w-8 h-8 rounded-lg bg-brand-500 text-white items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
			</span>
			<span className="font-bold text-[15px] tracking-tight">TruePlayer</span>
			<Icon name="chevronRight" className="w-4 h-4 text-gray-300 shrink-0" strokeWidth={ 2 } />
			<span className="text-sm font-medium text-gray-500">{ title || '' }</span>
			{ /* Screens (e.g. the editor) portal their toolbar actions here. */ }
			<div id="tp-topbar-slot" className="ml-auto flex items-center gap-2.5" />
		</header>
	);
}
