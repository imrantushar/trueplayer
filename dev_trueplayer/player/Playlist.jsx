import { useState } from '@wordpress/element';
import Player from './Player';

/**
 * Renders a group of videos as a sidebar (main player + list) or a grid.
 * Clicking an item swaps the active video; autoplay-next advances on end.
 */
export default function Playlist( { data } ) {
	const items = data.items || [];
	const [ active, setActive ] = useState( 0 );
	const item = items[ active ];

	const goNext = () => {
		if ( data.autoplayNext && active < items.length - 1 ) {
			setActive( active + 1 );
		}
	};

	if ( ! item ) {
		return null;
	}

	return (
		<div className={ `tp-pl tp-pl-${ data.layout }` }>
			{ data.title && <div className="tp-pl-title">{ data.title }</div> }
			<div className="tp-pl-body">
				<div className="tp-pl-main">
					<div className="trueplayer-mount">
						<Player key={ item.videoId } videoId={ item.videoId } config={ item.config } onEnded={ goNext } />
					</div>
				</div>
				<div className="tp-pl-list">
					{ items.map( ( it, i ) => (
						<button key={ it.videoId } className={ `tp-pl-item ${ i === active ? 'is-active' : '' }` } onClick={ () => setActive( i ) }>
							<span className="tp-pl-thumb" style={ it.poster ? { backgroundImage: `url("${ it.poster }")` } : undefined }>
								{ ! it.poster && ( i + 1 ) }
							</span>
							{ data.showTitles && <span className="tp-pl-item-title">{ it.title || `Video ${ i + 1 }` }</span> }
						</button>
					) ) }
				</div>
			</div>
		</div>
	);
}
