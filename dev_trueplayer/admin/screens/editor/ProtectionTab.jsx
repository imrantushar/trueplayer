import { Card, Field, Toggle, Badge } from '../../components/UI';

const FIELD_OPTIONS = [
	[ 'email', 'Viewer email' ],
	[ 'name', 'Viewer name' ],
	[ 'ip', 'IP address' ],
];

export default function ProtectionTab( { config, patch } ) {
	const source = config.source || {};
	const protection = config.protection || {};
	const wm = protection.dynamicWatermark || {};
	const setWm = ( partial ) => patch( { protection: { ...protection, dynamicWatermark: { ...wm, ...partial } } } );
	const fields = Array.isArray( wm.fields ) ? wm.fields : [ 'email' ];
	const toggleField = ( f ) =>
		setWm( { fields: fields.includes( f ) ? fields.filter( ( x ) => x !== f ) : [ ...fields, f ] } );

	const privatable = [ 'self', 'url', 'bunny' ].includes( source.type || 'self' );

	return (
		<div className="space-y-6">
			<Card className="p-6 max-w-2xl">
				<div className="flex items-center gap-3 mb-1">
					<h3 className="font-semibold text-gray-900">Private video / expiring links</h3>
					{ source.private && <Badge tone="amber">on</Badge> }
				</div>
				<p className="text-sm text-gray-500 mb-3">
					The real media URL never appears in the page. Self-hosted files stream through a signed link that expires;
					Bunny videos get CDN token authentication (set your Token Auth key under Settings → Bunny.net).
				</p>
				<div className='mt-4 pt-5 border-t border-solid border-line'>
					{ privatable ? (
						<Toggle
							checked={ !! source.private }
							onChange={ ( v ) => patch( { source: { ...source, private: v } } ) }
							label="Serve this video through signed, expiring links"
						/>
					) : (
						<p className="text-sm text-gray-400">Available for self-hosted, external-URL and Bunny sources (YouTube/Vimeo embeds are public by nature).</p>
					) }
				</div>
			</Card>

			<Card className="p-6 max-w-2xl">
				<div className="flex items-center gap-3 mb-1">
					<h3 className="font-semibold text-gray-900">Dynamic watermark</h3>
					{ wm.enabled && <Badge tone="amber">on</Badge> }
				</div>
				<p className="text-sm text-gray-500 mb-3">
					Burn the viewer's identity over the picture to deter screen recording. Resolved on the server for the logged-in viewer.
				</p>
				<div className='mt-4 pt-5 border-t border-solid border-line'>
					<Toggle checked={ !! wm.enabled } onChange={ ( v ) => setWm( { enabled: v } ) } label="Show a dynamic watermark" />
					{ wm.enabled && (
						<div  className="flex flex-col gap-6 mt-6">
							<Field label="Watermark contents">
								<div className="space-y-1">
									{ FIELD_OPTIONS.map( ( [ f, label ] ) => (
										<Toggle key={ f } checked={ fields.includes( f ) } onChange={ () => toggleField( f ) } label={ label } />
									) ) }
								</div>
							</Field>
							<div className="grid md:grid-cols-2 gap-x-6">
								<Field label={ `Opacity (${ Math.round( ( wm.opacity ?? 0.35 ) * 100 ) }%)` }>
									<input type="range" min="10" max="100" step="5" value={ Math.round( ( wm.opacity ?? 0.35 ) * 100 ) } onChange={ ( e ) => setWm( { opacity: parseInt( e.target.value, 10 ) / 100 } ) } className="w-full accent-brand-500 cursor-pointer" />
								</Field>
								<div className="pt-1">
									<Toggle checked={ wm.drift !== false } onChange={ ( v ) => setWm( { drift: v } ) } label="Slowly drift around the picture" />
								</div>
							</div>
						</div>
					) }
				</div>
			</Card>
		</div>
	);
}
