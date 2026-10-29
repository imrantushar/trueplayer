/**
 * The block's mark: the same one the admin menu uses (Admin\\Menu::menu_icon) —
 * a white-label logo when one is set, otherwise WordPress's video dashicon.
 * Used in the inserter, the toolbar, the sidebar's block card and the empty
 * canvas card.
 */
import { Dashicon } from '@wordpress/components';
import { logo } from './data';

export const TruePlayerIcon = ( { size = 20 } ) =>
	logo() ? (
		<img src={ logo() } alt="" width={ size } height={ size } style={ { objectFit: 'contain' } } />
	) : (
		<Dashicon icon="format-video" size={ size } />
	);
