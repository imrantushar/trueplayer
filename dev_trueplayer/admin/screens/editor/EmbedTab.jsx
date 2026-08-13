import { useState } from '@wordpress/element';
import { Card, Button, Toggle, Badge } from '../../components/UI';
import { isPro } from '../../pro';

export default function EmbedTab( { video, config = {}, patch } ) {
	const [ copied, setCopied ] = useState( '' );
	const shortcode = video.shortcode || `[trueplayer id="${ video.id }"]`;
	const block = `<!-- wp:trueplayer/player {"videoId":${ video.id }} /-->`;
	const siteUrl = ( window.TruePlayerGlobal && window.TruePlayerGlobal.site_url ) || '';
	const instantUrl = `${ siteUrl }/tp/${ video.id }/`;

	const copy = ( text, key ) => {
		navigator.clipboard && navigator.clipboard.writeText( text );
		setCopied( key );
		setTimeout( () => setCopied( '' ), 1500 );
	};

	return (
		<Card className="max-w-2xl space-y-6 !border-none">
			<div>
				<h3 className="font-semibold text-gray-900 !mb-2">Shortcode</h3>
				<div className="flex gap-2 items-center">
					<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm">{ shortcode }</code>
					<Button variant="ghost" onClick={ () => copy( shortcode, 'sc' ) }>{ copied === 'sc' ? 'Copied ✓' : 'Copy' }</Button>
				</div>
			</div>
			<div>
				<h3 className="font-semibold text-gray-900 !mb-2">Block (paste into any post)</h3>
				<div className="flex gap-2 items-center">
					<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm break-all">{ block }</code>
					<Button variant="ghost" onClick={ () => copy( block, 'bl' ) }>{ copied === 'bl' ? 'Copied ✓' : 'Copy' }</Button>
				</div>
				<p className="text-xs text-gray-400 mt-1">Or search “TruePlayer” in the block inserter.</p>
			</div>
			<div>
				<div className="flex items-center gap-2 mb-2">
					<h3 className="font-semibold text-gray-900">Instant video page</h3>
					{ ! isPro() && <Badge tone="gray">Pro</Badge> }
				</div>
				<p className="text-sm text-gray-500 mb-2">A clean, shareable standalone page for this video — no post needed.</p>
				{ isPro() && patch ? (
					<>
						<Toggle
							checked={ !! config.instantPage }
							onChange={ ( v ) => patch( { instantPage: v } ) }
							label="Enable the instant page"
							className="my-4"
						/>
						{ config.instantPage && (
							<div className="flex gap-2 items-center">
								<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm break-all">{ instantUrl }</code>
								<Button variant="ghost" onClick={ () => copy( instantUrl, 'ip' ) }>{ copied === 'ip' ? 'Copied ✓' : 'Copy' }</Button>
							</div>
						) }
					</>
				) : (
					<p className="text-xs text-gray-400">Available with TruePlayer Pro.</p>
				) }
			</div>
		</Card>
	);
}
