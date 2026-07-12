import { Card, Field, Input, Select, Toggle, Button } from '../../components/UI';
import { pickMedia } from '../../utils/media';

const newOverlay = ( type = 'cta' ) => ( {
	id: 'ov_' + Math.random().toString( 36 ).slice( 2, 8 ),
	type,
	...( type === 'text'
		? { start: 0, end: 10, position: 'top-left', title: '', text: '', background: '#000000', bgOpacity: 60 }
		: { trigger: 'time', at: 10, title: '', text: '', buttonLabel: 'Learn more', buttonUrl: '', image: '', pause: true, dismissible: true } ),
} );

const POSITIONS = [
	[ 'top-left', 'Top left' ], [ 'top-center', 'Top center' ], [ 'top-right', 'Top right' ],
	[ 'middle-left', 'Middle left' ], [ 'middle-center', 'Center' ], [ 'middle-right', 'Middle right' ],
	[ 'bottom-left', 'Bottom left' ], [ 'bottom-center', 'Bottom center' ], [ 'bottom-right', 'Bottom right' ],
];

export default function OverlaysTab( { config, patch } ) {
	const overlays = config.overlays || [];
	const actionBar = config.actionBar || {};
	const setOne = ( i, partial ) => patch( { overlays: overlays.map( ( o, idx ) => ( idx === i ? { ...o, ...partial } : o ) ) } );
	const add = ( type ) => patch( { overlays: [ ...overlays, newOverlay( type ) ] } );
	const remove = ( i ) => patch( { overlays: overlays.filter( ( _, idx ) => idx !== i ) } );
	const setBar = ( partial ) => patch( { actionBar: { ...actionBar, ...partial } } );

	return (
		<div className="space-y-6">
			{ /* Action bar */ }
			<Card className="p-6">
				<h3 className="font-semibold text-gray-900 mb-1">Action bar</h3>
				<p className="text-sm text-gray-500 mb-3">A persistent, clickable bar over the player — text plus a button.</p>
				<Toggle checked={ !! actionBar.enabled } onChange={ ( v ) => setBar( { enabled: v } ) } label="Show the action bar" />
				{ actionBar.enabled && (
					<>
						<Field label="Text"><Input value={ actionBar.text || '' } onChange={ ( e ) => setBar( { text: e.target.value } ) } placeholder="Limited offer — 30% off the full course" /></Field>
						<div className="grid md:grid-cols-2 gap-x-6">
							<Field label="Button label"><Input value={ actionBar.buttonLabel || '' } onChange={ ( e ) => setBar( { buttonLabel: e.target.value } ) } placeholder="Get it now" /></Field>
							<Field label="Button URL"><Input value={ actionBar.buttonUrl || '' } onChange={ ( e ) => setBar( { buttonUrl: e.target.value } ) } placeholder="https://…" /></Field>
							<Field label="Position">
								<Select value={ actionBar.position || 'bottom' } onChange={ ( e ) => setBar( { position: e.target.value } ) }>
									<option value="bottom">Bottom</option>
									<option value="top">Top</option>
								</Select>
							</Field>
							<Field label="Background" hint="Defaults to the accent color.">
								<div className="flex gap-2 items-center">
									<input type="color" value={ actionBar.background || '#4f46e5' } onChange={ ( e ) => setBar( { background: e.target.value } ) } className="h-9 w-12 rounded border border-line" />
									<Input value={ actionBar.background || '' } onChange={ ( e ) => setBar( { background: e.target.value } ) } placeholder="(accent)" />
								</div>
							</Field>
						</div>
					</>
				) }
			</Card>

			<div className="flex items-center justify-between gap-4">
				<div>
					<h3 className="font-semibold text-gray-900">Overlays</h3>
					<p className="text-sm text-gray-500">CTA cards pause for attention; text overlays label the picture during a time window.</p>
				</div>
				<div className="flex gap-2">
					<Button variant="ghost" onClick={ () => add( 'cta' ) }>+ CTA card</Button>
					<Button variant="ghost" onClick={ () => add( 'text' ) }>+ Text overlay</Button>
				</div>
			</div>

			{ overlays.length === 0 && (
				<Card className="p-10 text-center border-dashed">
					<p className="text-sm text-gray-500">No overlays yet.</p>
					<p className="text-xs text-gray-400 mt-1">Add a CTA card to promote an offer, or a text overlay to title a section.</p>
				</Card>
			) }

			{ overlays.map( ( o, i ) => (
				( o.type || 'cta' ) === 'text' ? (
					<Card key={ o.id } className="p-6">
						<div className="flex items-center justify-between mb-4">
							<h4 className="font-semibold text-ink">Text overlay { i + 1 }</h4>
							<Button variant="danger" size="sm" onClick={ () => remove( i ) }>Remove</Button>
						</div>
						<div className="grid md:grid-cols-3 gap-x-6">
							<Field label="Show from (seconds)">
								<Input type="number" min="0" value={ o.start ?? 0 } onChange={ ( e ) => setOne( i, { start: parseInt( e.target.value, 10 ) || 0 } ) } />
							</Field>
							<Field label="Until (seconds)" hint="Empty = until the end.">
								<Input type="number" min="0" value={ o.end ?? '' } onChange={ ( e ) => setOne( i, { end: e.target.value === '' ? '' : parseInt( e.target.value, 10 ) || 0 } ) } />
							</Field>
							<Field label="Position">
								<Select value={ o.position || 'top-left' } onChange={ ( e ) => setOne( i, { position: e.target.value } ) }>
									{ POSITIONS.map( ( [ v, l ] ) => <option key={ v } value={ v }>{ l }</option> ) }
								</Select>
							</Field>
						</div>
						<Field label="Heading"><Input value={ o.title || '' } onChange={ ( e ) => setOne( i, { title: e.target.value } ) } placeholder="Chapter 2 — Setup" /></Field>
						<Field label="Text"><Input value={ o.text || '' } onChange={ ( e ) => setOne( i, { text: e.target.value } ) } placeholder="Optional supporting line" /></Field>
						<div className="grid md:grid-cols-2 gap-x-6">
							<Field label="Background color">
								<div className="flex gap-2 items-center">
									<input type="color" value={ o.background || '#000000' } onChange={ ( e ) => setOne( i, { background: e.target.value } ) } className="h-9 w-12 rounded border border-line" />
									<Input value={ o.background || '' } onChange={ ( e ) => setOne( i, { background: e.target.value } ) } />
								</div>
							</Field>
							<Field label={ `Background opacity (${ o.bgOpacity ?? 60 }%)` }>
								<input type="range" min="0" max="100" step="5" value={ o.bgOpacity ?? 60 } onChange={ ( e ) => setOne( i, { bgOpacity: parseInt( e.target.value, 10 ) } ) } className="w-full" />
							</Field>
						</div>
					</Card>
				) : (
					<Card key={ o.id } className="p-6">
						<div className="flex items-center justify-between mb-4">
							<h4 className="font-semibold text-ink">CTA card { i + 1 }</h4>
							<Button variant="danger" size="sm" onClick={ () => remove( i ) }>Remove</Button>
						</div>
						<div className="grid md:grid-cols-2 gap-x-6">
							<Field label="Trigger">
								<Select value={ o.trigger } onChange={ ( e ) => setOne( i, { trigger: e.target.value } ) }>
									<option value="time">At a timestamp</option>
									<option value="end">At the end (end screen)</option>
								</Select>
							</Field>
							{ o.trigger === 'time' && (
								<Field label="Show at (seconds)">
									<Input type="number" min="0" className="w-32" value={ o.at } onChange={ ( e ) => setOne( i, { at: parseInt( e.target.value, 10 ) || 0 } ) } />
								</Field>
							) }
						</div>
						<Field label="Heading"><Input value={ o.title } onChange={ ( e ) => setOne( i, { title: e.target.value } ) } placeholder="Ready for the next step?" /></Field>
						<Field label="Text"><Input value={ o.text } onChange={ ( e ) => setOne( i, { text: e.target.value } ) } placeholder="Join the full course to keep learning." /></Field>
						<div className="grid md:grid-cols-2 gap-x-6">
							<Field label="Button label"><Input value={ o.buttonLabel } onChange={ ( e ) => setOne( i, { buttonLabel: e.target.value } ) } placeholder="Learn more" /></Field>
							<Field label="Button URL"><Input value={ o.buttonUrl } onChange={ ( e ) => setOne( i, { buttonUrl: e.target.value } ) } placeholder="https://…" /></Field>
						</div>
						<Field label="Image (optional)">
							<div className="flex gap-2">
								<Input value={ o.image } onChange={ ( e ) => setOne( i, { image: e.target.value } ) } placeholder="https://…/image.png" />
								<Button variant="ghost" onClick={ () => pickMedia( 'image', ( url ) => setOne( i, { image: url } ) ) }>Media library</Button>
							</div>
						</Field>
						{ o.trigger === 'time' && (
							<Toggle checked={ o.pause } onChange={ ( v ) => setOne( i, { pause: v } ) } label="Pause the video while showing" />
						) }
						<Toggle checked={ o.dismissible !== false } onChange={ ( v ) => setOne( i, { dismissible: v } ) } label="Let viewers dismiss it (× close)" />
					</Card>
				)
			) ) }
		</div>
	);
}
