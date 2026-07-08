import { Card, Field, Input, Select, Button, Textarea } from '../../components/UI';
import { pickMedia } from '../../utils/media';

const uid = () => 'ly_' + Math.random().toString( 36 ).slice( 2, 8 );

const TYPE_META = {
	hotspot: { label: 'Hotspot', hint: 'A pulsing clickable region over the picture.' },
	banner: { label: 'Banner', hint: 'An image (optionally linked) shown during a window.' },
	shortcode: { label: 'Shortcode', hint: 'Any WordPress shortcode, rendered over the video.' },
	form: { label: 'Email form', hint: 'Inline email capture (uses your Subscribe integration).' },
};

const POSITIONS = [
	[ 'top-left', 'Top left' ], [ 'top-center', 'Top center' ], [ 'top-right', 'Top right' ],
	[ 'middle-left', 'Middle left' ], [ 'middle-center', 'Center' ], [ 'middle-right', 'Middle right' ],
	[ 'bottom-left', 'Bottom left' ], [ 'bottom-center', 'Bottom center' ], [ 'bottom-right', 'Bottom right' ],
];

const newLayer = ( type ) => {
	const base = { id: uid(), type, start: 0, end: '' };
	switch ( type ) {
		case 'hotspot':
			return { ...base, x: 40, y: 40, w: 20, h: 20, tooltip: '', url: '' };
		case 'banner':
			return { ...base, image: '', url: '', position: 'bottom-center' };
		case 'shortcode':
			return { ...base, shortcode: '', position: 'middle-center' };
		case 'form':
			return { ...base, title: '', buttonLabel: 'Subscribe', position: 'middle-center' };
		default:
			return base;
	}
};

export default function LayersTab( { config, patch } ) {
	const layers = config.layers || [];
	const setOne = ( i, partial ) => patch( { layers: layers.map( ( l, idx ) => ( idx === i ? { ...l, ...partial } : l ) ) } );
	const add = ( type ) => patch( { layers: [ ...layers, newLayer( type ) ] } );
	const remove = ( i ) => patch( { layers: layers.filter( ( _, idx ) => idx !== i ) } );

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h3 className="font-semibold text-gray-900">Interactive layers</h3>
					<p className="text-sm text-gray-500">Timed elements over the video — hotspots, banners, shortcodes and email forms.</p>
				</div>
				<div className="flex gap-2 flex-wrap justify-end">
					{ Object.keys( TYPE_META ).map( ( t ) => (
						<Button key={ t } variant="ghost" onClick={ () => add( t ) }>+ { TYPE_META[ t ].label }</Button>
					) ) }
				</div>
			</div>

			{ layers.length === 0 && (
				<Card className="p-10 text-center border-dashed">
					<p className="text-sm text-gray-500">No layers yet.</p>
					<p className="text-xs text-gray-400 mt-1">Add a hotspot, banner, shortcode or email form.</p>
				</Card>
			) }

			{ layers.map( ( l, i ) => (
				<Card key={ l.id } className="p-6">
					<div className="flex items-center justify-between mb-1">
						<h4 className="font-semibold text-ink">{ TYPE_META[ l.type ]?.label || l.type } { i + 1 }</h4>
						<Button variant="danger" size="sm" onClick={ () => remove( i ) }>Remove</Button>
					</div>
					<p className="text-xs text-gray-400 mb-4">{ TYPE_META[ l.type ]?.hint }</p>

					<div className="grid md:grid-cols-3 gap-x-6">
						<Field label="Show from (seconds)">
							<Input type="number" min="0" value={ l.start ?? 0 } onChange={ ( e ) => setOne( i, { start: parseInt( e.target.value, 10 ) || 0 } ) } />
						</Field>
						<Field label="Until (seconds)" hint="Empty = until the end.">
							<Input type="number" min="0" value={ l.end ?? '' } onChange={ ( e ) => setOne( i, { end: e.target.value === '' ? '' : parseInt( e.target.value, 10 ) || 0 } ) } />
						</Field>
						{ l.type !== 'hotspot' && (
							<Field label="Position">
								<Select value={ l.position || 'middle-center' } onChange={ ( e ) => setOne( i, { position: e.target.value } ) }>
									{ POSITIONS.map( ( [ v, lab ] ) => <option key={ v } value={ v }>{ lab }</option> ) }
								</Select>
							</Field>
						) }
					</div>

					{ l.type === 'hotspot' && (
						<>
							<div className="grid grid-cols-4 gap-x-4">
								<Field label="Left (%)"><Input type="number" min="0" max="100" value={ l.x ?? 40 } onChange={ ( e ) => setOne( i, { x: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
								<Field label="Top (%)"><Input type="number" min="0" max="100" value={ l.y ?? 40 } onChange={ ( e ) => setOne( i, { y: parseInt( e.target.value, 10 ) || 0 } ) } /></Field>
								<Field label="Width (%)"><Input type="number" min="2" max="100" value={ l.w ?? 20 } onChange={ ( e ) => setOne( i, { w: parseInt( e.target.value, 10 ) || 2 } ) } /></Field>
								<Field label="Height (%)"><Input type="number" min="2" max="100" value={ l.h ?? 20 } onChange={ ( e ) => setOne( i, { h: parseInt( e.target.value, 10 ) || 2 } ) } /></Field>
							</div>
							<div className="grid md:grid-cols-2 gap-x-6">
								<Field label="Tooltip"><Input value={ l.tooltip || '' } onChange={ ( e ) => setOne( i, { tooltip: e.target.value } ) } placeholder="See the product" /></Field>
								<Field label="Link URL"><Input value={ l.url || '' } onChange={ ( e ) => setOne( i, { url: e.target.value } ) } placeholder="https://…" /></Field>
							</div>
						</>
					) }

					{ l.type === 'banner' && (
						<>
							<Field label="Image">
								<div className="flex gap-2">
									<Input value={ l.image || '' } onChange={ ( e ) => setOne( i, { image: e.target.value } ) } placeholder="https://…/banner.png" />
									<Button variant="ghost" onClick={ () => pickMedia( 'image', ( url ) => setOne( i, { image: url } ) ) }>Media library</Button>
								</div>
							</Field>
							<Field label="Link URL (optional)"><Input value={ l.url || '' } onChange={ ( e ) => setOne( i, { url: e.target.value } ) } placeholder="https://…" /></Field>
						</>
					) }

					{ l.type === 'shortcode' && (
						<Field label="Shortcode" hint="Rendered on the server when the page loads.">
							<Textarea rows={ 2 } className="font-mono text-xs" value={ l.shortcode || '' } onChange={ ( e ) => setOne( i, { shortcode: e.target.value } ) } placeholder='[contact-form-7 id="123"]' />
						</Field>
					) }

					{ l.type === 'form' && (
						<div className="grid md:grid-cols-2 gap-x-6">
							<Field label="Headline"><Input value={ l.title || '' } onChange={ ( e ) => setOne( i, { title: e.target.value } ) } placeholder="Get the bonus material" /></Field>
							<Field label="Button label"><Input value={ l.buttonLabel || '' } onChange={ ( e ) => setOne( i, { buttonLabel: e.target.value } ) } placeholder="Subscribe" /></Field>
						</div>
					) }
				</Card>
			) ) }
		</div>
	);
}
