import { Card, Field, Toggle, Badge } from '../../components/UI';
import { PRIVATABLE_SOURCES } from '@Utils/source-types';
import { __, __sprintf } from '@Utils/translation';

const FIELD_OPTIONS = [
	[ 'email', __( 'Viewer email' ) ],
	[ 'name', __( 'Viewer name' ) ],
	[ 'ip', __( 'IP address' ) ],
];

export default function ProtectionTab( { config, patch } ) {
	const source = config.source || {};
	const protection = config.protection || {};
	const wm = protection.dynamicWatermark || {};
	const setWm = ( partial ) => patch( { protection: { ...protection, dynamicWatermark: { ...wm, ...partial } } } );
	const fields = Array.isArray( wm.fields ) ? wm.fields : [ 'email' ];
	const toggleField = ( f ) =>
		setWm( { fields: fields.includes( f ) ? fields.filter( ( x ) => x !== f ) : [ ...fields, f ] } );

	// Was a hardcoded list that omitted `bunnyStorage`, hiding a signing path
	// that has worked server-side all along (PrivateVideo::sign_bunny_storage).
	const privatable = PRIVATABLE_SOURCES.includes( source.type || 'self' );

	return (
		<div className="space-y-6">
			<Card className="p-6 max-w-2xl">
				<div className="flex items-center gap-3 mb-1">
					<h3 className="font-semibold text-gray-900">{ __( 'Private video / expiring links' ) }</h3>
					{ source.private && <Badge tone="amber">{ __( 'on' ) }</Badge> }
				</div>
				<p className="text-sm text-gray-500 mb-3">
					{ __( 'The real media URL never appears in the page. Self-hosted files stream through a signed link that expires; Bunny and Gumlet videos get their provider’s own token authentication (set the signing key under Settings → Sources & CDN).' ) }
				</p>
				<div className='mt-4 pt-5 border-t border-solid border-line'>
					{ privatable ? (
						<Toggle
							checked={ !! source.private }
							onChange={ ( v ) => patch( { source: { ...source, private: v } } ) }
							label={ __( 'Serve this video through signed, expiring links' ) }
						/>
					) : (
						<p className="text-sm text-gray-400">{ __( 'Available for self-hosted, external-URL, Bunny and Gumlet sources (YouTube/Vimeo embeds are public by nature).' ) }</p>
					) }
				</div>
			</Card>

			<Card className="p-6 max-w-2xl">
				<div className="flex items-center gap-3 mb-1">
					<h3 className="font-semibold text-gray-900">{ __( 'Dynamic watermark' ) }</h3>
					{ wm.enabled && <Badge tone="amber">{ __( 'on' ) }</Badge> }
				</div>
				<p className="text-sm text-gray-500 mb-3">
					{ __( "Burn the viewer's identity over the picture to deter screen recording. Resolved on the server for the logged-in viewer." ) }
				</p>
				<div className='mt-4 pt-5 border-t border-solid border-line'>
					<Toggle checked={ !! wm.enabled } onChange={ ( v ) => setWm( { enabled: v } ) } label={ __( 'Show a dynamic watermark' ) } />
					{ wm.enabled && (
						<div  className="flex flex-col gap-6 mt-6">
							<Field label={ __( 'Watermark contents' ) }>
								<div className="space-y-1">
									{ FIELD_OPTIONS.map( ( [ f, label ] ) => (
										<Toggle key={ f } checked={ fields.includes( f ) } onChange={ () => toggleField( f ) } label={ label } />
									) ) }
								</div>
							</Field>
							<div className="grid md:grid-cols-2 gap-x-6">
								<Field label={ __sprintf( 'Opacity (%d%%)', Math.round( ( wm.opacity ?? 0.35 ) * 100 ) ) }>
									<input type="range" min="10" max="100" step="5" value={ Math.round( ( wm.opacity ?? 0.35 ) * 100 ) } onChange={ ( e ) => setWm( { opacity: parseInt( e.target.value, 10 ) / 100 } ) } className="w-full accent-brand-500 cursor-pointer" />
								</Field>
								<div className="pt-1">
									<Toggle checked={ wm.drift !== false } onChange={ ( v ) => setWm( { drift: v } ) } label={ __( 'Slowly drift around the picture' ) } />
								</div>
							</div>
						</div>
					) }
				</div>
			</Card>
		</div>
	);
}
