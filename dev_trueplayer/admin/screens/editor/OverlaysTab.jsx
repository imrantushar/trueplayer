import { Card, Field, Input, Select, Toggle, Button } from '../../components/UI';
import { pickMedia } from '../../utils/media';

const newOverlay = () => ( {
	id: 'ov_' + Math.random().toString( 36 ).slice( 2, 8 ),
	trigger: 'time',
	at: 10,
	title: '',
	text: '',
	buttonLabel: 'Learn more',
	buttonUrl: '',
	image: '',
	pause: true,
	dismissible: true,
} );

export default function OverlaysTab( { config, patch } ) {
	const overlays = config.overlays || [];
	const setOne = ( i, partial ) => patch( { overlays: overlays.map( ( o, idx ) => ( idx === i ? { ...o, ...partial } : o ) ) } );
	const add = () => patch( { overlays: [ ...overlays, newOverlay() ] } );
	const remove = ( i ) => patch( { overlays: overlays.filter( ( _, idx ) => idx !== i ) } );

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h3 className="font-semibold text-gray-900">Call-to-action overlays</h3>
					<p className="text-sm text-gray-500">Show a card at a timestamp or as an end screen — heading, text and a button.</p>
				</div>
				<Button variant="ghost" onClick={ add }>+ Add overlay</Button>
			</div>

			{ overlays.length === 0 && (
				<Card className="p-10 text-center border-dashed">
					<p className="text-sm text-gray-500">No overlays yet.</p>
					<p className="text-xs text-gray-400 mt-1">Add one to promote an offer, a link, or the next lesson.</p>
				</Card>
			) }

			{ overlays.map( ( o, i ) => (
				<Card key={ o.id } className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h4 className="font-semibold text-ink">Overlay { i + 1 }</h4>
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
			) ) }
		</div>
	);
}
