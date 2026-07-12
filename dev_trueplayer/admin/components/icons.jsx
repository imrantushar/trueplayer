/** Line icons (stroke, currentColor) for the admin shell + screens. */

const P = {
	dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
	video: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9l5 3-5 3V9z" /></>,
	playlist: <><path d="M4 7h11M4 12h11M4 17h7" /><path d="M17 13l4 2.5-4 2.5v-5z" /></>,
	presets: <><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></>,
	analytics: <><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7" y="12" width="3" height="5" rx="0.5" /><rect x="12.5" y="8" width="3" height="9" rx="0.5" /><rect x="18" y="5" width="3" height="12" rx="0.5" /></>,
	settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.8 7.8 0 000-2l2-1.5-2-3.5-2.4 1a7.6 7.6 0 00-1.7-1L12 3h-4l-.6 2.5c-.6.3-1.2.6-1.7 1l-2.4-1-2 3.5L3.3 11a7.8 7.8 0 000 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.7 1.7 1L8 21h4l.6-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5z" /></>,
	plus: <path d="M12 5v14M5 12h14" />,
	spark: <><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3L12 3z" /><path d="M18 15l.8 2 2 .8-2 .8L18 21l-.8-2-2-.8 2-.8L18 15z" /></>,
	book: <><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5V5.5z" /><path d="M4 20.5A2.5 2.5 0 016.5 18H20" /></>,
	clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
	check: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
	eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
	edit: <><path d="M4 20h4L18.5 9.5a2.12 2.12 0 00-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></>,
	trash: <><path d="M4 7h16" /><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /><path d="M10 11v6M14 11v6" /></>,
	sliders: <><path d="M4 8h10M18 8h2M4 16h6M14 16h6" /><circle cx="16" cy="8" r="2" /><circle cx="12" cy="16" r="2" /></>,
	shield: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></>,
	lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
	cloud: <><path d="M7 18a4 4 0 01-.5-7.97A5.5 5.5 0 0117.9 9.5 3.5 3.5 0 0117 18H7z" /></>,
	plug: <><path d="M9 3v5M15 3v5" /><path d="M7 8h10v3a5 5 0 01-10 0V8z" /><path d="M12 16v5" /></>,
	webhook: <><circle cx="12" cy="7" r="3" /><path d="M12 10l-3.5 6" /><circle cx="7" cy="18" r="2.5" /><path d="M9.5 18H16" /><circle cx="17" cy="15" r="2.5" /></>,
	tag: <><path d="M4 12V5a1 1 0 011-1h7l8 8-8 8-8-8z" /><circle cx="8.5" cy="8.5" r="1.2" /></>,
	key: <><circle cx="8" cy="12" r="4" /><path d="M11 12h9M17 12v3M20 12v2" /></>,
	chevronRight: <path d="M9 6l6 6-6 6" />,
};

export function Icon( { name, className = 'w-5 h-5', strokeWidth = 1.8 } ) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ strokeWidth } strokeLinecap="round" strokeLinejoin="round" className={ className } aria-hidden="true">
			{ P[ name ] || null }
		</svg>
	);
}
