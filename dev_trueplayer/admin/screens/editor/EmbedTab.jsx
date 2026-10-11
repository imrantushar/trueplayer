import { useState } from '@wordpress/element';
import { Card, Button } from '../../components/UI';
import { ExtSlot } from '@Ext/admin';
import { Icon } from '../../components/icons';
import { __ } from '@Utils/translation';

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

export default function EmbedTab( { video, config = {}, patch, savedConfig = {}, saving = false, onSave } ) {
	const [ copied, setCopied ] = useState( '' );
	const shortcode = video.shortcode || `[trueplayer id="${ video.id }"]`;
	const block = `<!-- wp:trueplayer/player {"videoId":${ video.id }} /-->`;
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
				<h3 className="font-semibold text-gray-900 !mb-2">{ __( 'Shortcode' ) }</h3>
				<div className="flex gap-2 items-center">
					<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm">{ shortcode }</code>
					<Button variant="ghost" onClick={ () => copy( shortcode, 'sc' ) }>{ copied === 'sc' ? <><Icon name="checkmark" className="w-4 h-4" /> { __( 'Copied' ) }</> : __( 'Copy' ) }</Button>
				</div>
			</div>
			<div>
				<h3 className="font-semibold text-gray-900 !mb-2">{ __( 'Block (paste into any post)' ) }</h3>
				<div className="flex gap-2 items-center">
					<code className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm break-all">{ block }</code>
					<Button variant="ghost" onClick={ () => copy( block, 'bl' ) }>{ copied === 'bl' ? <><Icon name="checkmark" className="w-4 h-4" /> { __( 'Copied' ) }</> : __( 'Copy' ) }</Button>
				</div>
				<p className="text-xs text-gray-400 mt-1">{ __( 'Or search “TruePlayer” in the block inserter.' ) }</p>
			</div>
			<ExtSlot name="editor.embed" video={ video } config={ config } patch={ patch } savedConfig={ savedConfig } saving={ saving } onSave={ onSave } copy={ copy } copied={ copied } />
		</Card>
	);
}
