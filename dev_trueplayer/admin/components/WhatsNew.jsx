import { useEffect, useState } from '@wordpress/element';
import { IoClose, IoMegaphoneOutline } from 'react-icons/io5';
import { Button } from './UI';
import { __, __sprintf, _nSprintf } from '@Utils/translation';
import changelogRaw from '../../../changelog.md';
import pkg from '../../../package.json';

const { version } = pkg;

// Same seam QuizPress's own admin "What's New" panel uses — this mirrors it
// (structure, parsing, behavior), restyled in Tailwind to match TruePlayer's
// own design tokens instead of porting QuizPress's SCSS theme variables.
const TAG_STYLES = {
	Added: 'bg-success-light text-success',
	Improved: 'bg-brand-100 text-brand-600',
	Fixed: 'bg-warning-light text-warning',
	Security: 'bg-danger-light text-danger',
	Removed: 'bg-gray-100 text-gray-500',
};
const TAG_LABELS = {
	Added: __( 'Feature' ),
	Improved: __( 'Improvement' ),
	Fixed: __( 'Fix' ),
	Security: __( 'Security' ),
	Removed: __( 'Removed' ),
};

function relativeAge( dateString ) {
	if ( ! dateString ) {
		return '';
	}
	const days = Math.floor( ( Date.now() - new Date( dateString ).getTime() ) / 86400000 );
	if ( days <= 0 ) {
		return __( 'today' );
	}
	if ( days < 7 ) {
		return _nSprintf( '%d day ago', '%d days ago', days );
	}
	if ( days < 30 ) {
		const weeks = Math.floor( days / 7 );
		return _nSprintf( '%d week ago', '%d weeks ago', weeks );
	}
	const months = Math.floor( days / 30 );
	return _nSprintf( '%d month ago', '%d months ago', months );
}

/**
 * Parses only the first `## <version> - <YYYY-MM-DD>` release out of
 * changelog.md into { version, date, sections: [ { label, items } ] }.
 */
function parseLatestRelease( raw ) {
	const heading = /^##\s+([\d.]+)\s+-\s+(\d{4}-\d{2}-\d{2})\s*$/m.exec( raw );
	if ( ! heading ) {
		return null;
	}
	const [ fullMatch, releaseVersion, date ] = heading;
	const rest = raw.slice( heading.index + fullMatch.length );
	const nextHeadingAt = rest.search( /^##\s+/m );
	const body = -1 === nextHeadingAt ? rest : rest.slice( 0, nextHeadingAt );

	const sections = [];
	let current = null;
	body.split( '\n' ).forEach( ( line ) => {
		const sectionMatch = line.match( /^###\s+(.+)/ );
		const itemMatch = line.match( /^-\s+(.+)/ );
		if ( sectionMatch ) {
			current = { label: sectionMatch[ 1 ].trim(), items: [] };
			sections.push( current );
		} else if ( itemMatch && current ) {
			current.items.push( itemMatch[ 1 ].trim() );
		}
	} );
	return { version: releaseVersion, date, sections };
}

function SectionTag( { label } ) {
	return (
		<span className={ `inline-block text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 mr-1.5 align-middle ${ TAG_STYLES[ label ] || 'bg-gray-100 text-gray-500' }` }>
			{ TAG_LABELS[ label ] || label }
		</span>
	);
}

export default function WhatsNew() {
	const [ open, setOpen ] = useState( false );
	const release = parseLatestRelease( changelogRaw );

	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const onKeyDown = ( e ) => {
			if ( 'Escape' === e.key ) {
				setOpen( false );
			}
		};
		document.addEventListener( 'keydown', onKeyDown );
		return () => document.removeEventListener( 'keydown', onKeyDown );
	}, [ open ] );

	if ( ! release ) {
		return null;
	}

	const age = relativeAge( release.date );

	return (
		<>
			<Button
				variant="ghost"
				onClick={ () => setOpen( true ) }
				title={ __( "What's New" ) }
				aria-label={ __( "What's New" ) }
				className="!p-2.5"
			>
				<IoMegaphoneOutline size={ 16 } />
			</Button>

			{ open && (
				<>
					<div className="fixed top-8 inset-x-0 bottom-0 bg-black/40 z-[100000]" onClick={ () => setOpen( false ) } />
					<div role="dialog" aria-modal="true" className="fixed top-8 right-0 bottom-0 w-full max-w-sm z-[100001] flex flex-col bg-white shadow-pop overflow-y-auto">
						<div className="flex items-center justify-between px-5 py-4 border-b border-line">
							<span className="text-base font-semibold text-ink">{ __( "What's New" ) }</span>
							<button type="button" aria-label={ __( 'Close' ) } onClick={ () => setOpen( false ) } className="text-muted hover:text-ink p-1">
								<IoClose size={ 18 } />
							</button>
						</div>
						<div className="px-5 py-4">
							<div className="flex items-center gap-2 mb-3">
								{ age && (
									<>
										<span className="text-[11px] font-medium uppercase tracking-wide text-muted">{ age }</span>
										<span className="w-1 h-1 rounded-full bg-line" />
									</>
								) }
								<span className="text-[11px] font-semibold text-brand-500">{ __sprintf( 'v%s', version ) }</span>
							</div>
							{ release.sections.map( ( section, si ) => (
								<div key={ si } className={ si > 0 ? 'mt-4' : '' }>
									<div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
										{ section.label }
										<span className="flex-1 h-px bg-line" />
									</div>
									<ul className="space-y-2">
										{ section.items.map( ( item, ii ) => (
											<li key={ ii } className="text-[13px] leading-relaxed text-ink">
												<SectionTag label={ section.label } />
												{ item }
											</li>
										) ) }
									</ul>
								</div>
							) ) }
						</div>
					</div>
				</>
			) }
		</>
	);
}
