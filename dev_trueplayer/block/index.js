import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import Edit from './edit';
import { brand } from './data';

registerBlockType( 'trueplayer/player', {
	// Matches includes/block.php. v3 declares this block safe inside the
	// editor's iframed canvas, which WordPress now always uses.
	apiVersion: 3,
	// The site owner's own name when white-label is on, so the inserter agrees
	// with the admin menu.
	title: brand(),
	description: __( 'Watch-verified, quiz-gated video.', 'trueplayer' ),
	icon: 'format-video',
	category: 'embed',
	attributes: { videoId: { type: 'number', default: 0 } },

	edit: Edit,

	save() {
		return null; // dynamic — rendered server-side via the shortcode
	},
} );
