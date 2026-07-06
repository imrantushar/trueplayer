import { useState } from '@wordpress/element';
import { Card, Button } from '../../components/UI';

export default function EmbedTab( { video } ) {
	const [ copied, setCopied ] = useState( '' );
	const shortcode = video.shortcode || `[trueplayer id="${ video.id }"]`;
	const block = `<!-- wp:trueplayer/player {"videoId":${ video.id }} /-->`;

	const copy = ( text, key ) => {
		navigator.clipboard && navigator.clipboard.writeText( text );
		setCopied( key );
		setTimeout( () => setCopied( '' ), 1500 );
	};

	return (
		<Card className="p-6 max-w-2xl space-y-6">
			<div>
				<h3 className="font-semibold text-gray-900 mb-2">Shortcode</h3>
				<div className="flex gap-2 items-center">
					<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm">{ shortcode }</code>
					<Button variant="ghost" onClick={ () => copy( shortcode, 'sc' ) }>{ copied === 'sc' ? 'Copied ✓' : 'Copy' }</Button>
				</div>
			</div>
			<div>
				<h3 className="font-semibold text-gray-900 mb-2">Block (paste into any post)</h3>
				<div className="flex gap-2 items-center">
					<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm break-all">{ block }</code>
					<Button variant="ghost" onClick={ () => copy( block, 'bl' ) }>{ copied === 'bl' ? 'Copied ✓' : 'Copy' }</Button>
				</div>
				<p className="text-xs text-gray-400 mt-1">Or search “TruePlayer” in the block inserter.</p>
			</div>
		</Card>
	);
}
