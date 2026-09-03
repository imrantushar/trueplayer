import { useState } from '@wordpress/element';
import { Card, Button, Toggle, Badge } from '../../components/UI';
import { isPro } from '../../pro';
import { Icon } from '../../components/icons';

// navigator.clipboard.writeText needs a secure context; fall back to the
// classic textarea + execCommand trick (e.g. plain-http local dev sites).
function legacyCopy( text ) {
	const ta = document.createElement( 'textarea' );
	ta.value = text;
	ta.style.position = 'fixed';
	ta.style.opacity = '0';
	document.body.appendChild( ta );
	ta.select();
	let ok = false;
	try {
		ok = document.execCommand( 'copy' );
	} catch ( e ) {
		ok = false;
	}
	document.body.removeChild( ta );
	return ok;
}

export default function EmbedTab( { video, config = {}, patch, instantLive = false, saving = false, onSave } ) {
	const [ copied, setCopied ] = useState( '' );
	const shortcode = video.shortcode || `[trueplayer id="${ video.id }"]`;
	const block = `<!-- wp:trueplayer/player {"videoId":${ video.id }} /-->`;
	// The server hands back the real address of the page it serves
	// (InstantPage::url). Guessing it from `site_url` is wrong on any install
	// where WordPress lives in its own directory — the rewrite rule is on
	// home_url — and on plain permalinks, where there is no pretty route at all.
	// The old guess is kept only as a fallback for a stale response.
	const siteUrl = ( window.TruePlayerGlobal && window.TruePlayerGlobal.site_url ) || '';
	const instantUrl = video.instantUrl || `${ siteUrl }/tp/${ video.id }/`;
	// The toggle is an ordinary config edit: it lives in the editor's unsaved
	// state until the video is saved, so until then the URL below points at a
	// page that does not exist yet (InstantPage::maybe_render 404s a video
	// whose stored config has no `instantPage`). Showing the link anyway is
	// what made this look broken — the copied address 404s.
	const pending = !! config.instantPage !== !! instantLive;

	const copy = ( text, key ) => {
		const markCopied = () => {
			setCopied( key );
			setTimeout( () => setCopied( ( c ) => ( c === key ? '' : c ) ), 1500 );
		};
		if ( navigator.clipboard && window.isSecureContext ) {
			navigator.clipboard.writeText( text ).then( markCopied ).catch( () => {
				if ( legacyCopy( text ) ) {
					markCopied();
				}
			} );
		} else if ( legacyCopy( text ) ) {
			markCopied();
		}
	};

	return (
		<Card className="max-w-2xl space-y-6 !border-none">
			<div>
				<h3 className="font-semibold text-gray-900 !mb-2">Shortcode</h3>
				<div className="flex gap-2 items-center">
					<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm">{ shortcode }</code>
					<Button variant="ghost" onClick={ () => copy( shortcode, 'sc' ) }>{ copied === 'sc' ? <><Icon name="checkmark" className="w-4 h-4" /> Copied</> : 'Copy' }</Button>
				</div>
			</div>
			<div>
				<h3 className="font-semibold text-gray-900 !mb-2">Block (paste into any post)</h3>
				<div className="flex gap-2 items-center">
					<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm break-all">{ block }</code>
					<Button variant="ghost" onClick={ () => copy( block, 'bl' ) }>{ copied === 'bl' ? <><Icon name="checkmark" className="w-4 h-4" /> Copied</> : 'Copy' }</Button>
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
						{ /* Saving from in here rather than pointing at the topbar's
						     Update button, which this dialog's own backdrop covers. */ }
						{ pending && (
							<div className="flex items-center gap-3 text-sm text-warning bg-warning-light rounded-card px-4 py-3">
								<span className="flex-1">
									{ config.instantPage
										? 'Save this video to publish its page.'
										: 'Save this video to take its page down.' }
								</span>
								{ onSave && (
									<Button onClick={ onSave } disabled={ saving }>
										{ saving ? 'Saving…' : 'Save' }
									</Button>
								) }
							</div>
						) }
						{ ! pending && config.instantPage && (
							<div className="flex gap-2 items-center">
								<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm break-all">{ instantUrl }</code>
								<Button variant="ghost" onClick={ () => copy( instantUrl, 'ip' ) }>{ copied === 'ip' ? <><Icon name="checkmark" className="w-4 h-4" /> Copied</> : 'Copy' }</Button>
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
