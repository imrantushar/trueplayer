import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@Utils/translation';
import metadata from '../../blocks/player/block.json';
import Edit from './edit';
import transforms from './transforms';
import { brand } from './data';

// Attributes, supports and the name come from block.json, which PHP registers
// from too — one description, so the editor and the server cannot disagree.
registerBlockType( metadata.name, {
	...metadata,
	// The site owner's own name when white-label is on, so the inserter agrees
	// with the admin menu.
	title: brand(),
	description: __( 'A fast video and audio player. Upload a file or paste a YouTube, Vimeo or media link.' ),

	edit: Edit,
	transforms,

	save() {
		return null; // dynamic — rendered server-side
	},
} );
