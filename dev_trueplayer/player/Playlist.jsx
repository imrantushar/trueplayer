import { useState } from '@wordpress/element';
import Player from './Player';

/**
 * Renders a group of videos as a sidebar (main player + list) or a grid.
 * Clicking an item swaps the active video; autoplay-next advances on end.
 */
export default function Playlist( { data } ) {
	const items = data.items || [];
	const [ active, setActive ] = useState( 0 );
	const [ autoStart, setAutoStart ] = useState( false );
	const item = items[ active ];

	// Picking an item (or auto-advancing) should play it; the first render just
	// shows its poster so nothing loads until the viewer chooses to watch.
	const pick = ( i ) => {
		setActive( i );
		setAutoStart( true );
	};
	const goNext = () => {
		if ( data.autoplayNext && active < items.length - 1 ) {
			pick( active + 1 );
		}
	};

	if ( ! item ) {
		return null;
	}

	// Grid shows poster thumbnails; the sidebar uses a compact icon so the list
	// stays slim (and titles get more room).
	const isGrid = data.layout === 'grid';

	return (
		<div className={ `tp-pl tp-pl-${ data.layout }` }>
			{ data.title && <div className="tp-pl-title">{ data.title }</div> }
			<div className="tp-pl-body">
				<div className="tp-pl-main">
					<div className="trueplayer-mount">
						<Player key={ item.videoId } videoId={ item.videoId } config={ item.config } autoStart={ autoStart } onEnded={ goNext } />
					</div>
				</div>
				<div className="tp-pl-list">
					{ items.map( ( it, i ) => (
						<button key={ it.videoId } className={ `tp-pl-item ${ i === active ? 'is-active' : '' }` } onClick={ () => pick( i ) }>
							{ isGrid ? (
								<span className="tp-pl-thumb" style={ it.poster ? { backgroundImage: `url("${ it.poster }")` } : undefined }>
									{ ! it.poster && ( i + 1 ) }
								</span>
							) : (
								<span className="tp-pl-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
								</span>
							) }
							{ data.showTitles && <span className="tp-pl-item-title">{ it.title || `Video ${ i + 1 }` }</span> }
						</button>
					) ) }
				</div>
			</div>
		</div>
	);
}
