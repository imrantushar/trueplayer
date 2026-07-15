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
	chevronRight: <path d="M9 6l6 6-6 6" />,
	moreVertical: <><circle cx="12" cy="5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none" /></>,
	edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
	trash: <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>,
};

export function Icon( { name, className = 'w-5 h-5', strokeWidth = 1.8 } ) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ strokeWidth } strokeLinecap="round" strokeLinejoin="round" className={ className } aria-hidden="true">
			{ P[ name ] || null }
		</svg>
	);
}
