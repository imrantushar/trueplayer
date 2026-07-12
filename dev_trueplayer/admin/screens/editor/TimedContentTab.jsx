import { Card, Field, Input, Button, Textarea, Toggle, SectionTitle } from '../../components/UI';

const uid = () => 'tc_' + Math.random().toString( 36 ).slice( 2, 8 );

/**
 * Timed content (pro) — a region rendered BELOW the player that swaps its
 * content as the video plays. Each item is a time range + HTML/shortcode block
 * (a form, a button, notes). Shortcodes are pre-rendered server-side.
 */
export default function TimedContentTab( { config, patch } ) {
	const timed = config.timedContent || { enabled: false, items: [] };
	const items = timed.items || [];

	const set = ( partial ) => patch( { timedContent: { ...timed, ...partial } } );
	const setItem = ( i, partial ) => set( { items: items.map( ( it, idx ) => ( idx === i ? { ...it, ...partial } : it ) ) } );
	const add = () => set( { items: [ ...items, { id: uid(), start: 0, end: '', content: '' } ] } );
	const remove = ( i ) => set( { items: items.filter( ( _, idx ) => idx !== i ) } );

	return (
		<div className="space-y-6">
			<Card className="p-6 max-w-2xl">
				<SectionTitle>Timed content</SectionTitle>
				<p className="text-sm text-gray-500 mb-4">
					Show a block of content under the player during a time range — a form when the demo ends,
					a coupon at the pitch, notes that track the lesson. Any shortcode works.
				</p>
				<Toggle checked={ !! timed.enabled } onChange={ ( v ) => set( { enabled: v } ) } label="Enable timed content region" />
			</Card>

			{ timed.enabled && (
				<div className="space-y-4">
					{ items.map( ( it, i ) => (
						<Card key={ it.id } className="p-6 max-w-2xl">
							<div className="flex items-center justify-between mb-4">
								<h4 className="font-semibold text-ink">Segment { i + 1 }</h4>
								<Button variant="danger" size="sm" onClick={ () => remove( i ) }>Remove</Button>
							</div>
							<div className="grid md:grid-cols-2 gap-x-6">
								<Field label="From (seconds)">
									<Input type="number" min="0" value={ it.start ?? 0 } onChange={ ( e ) => setItem( i, { start: parseInt( e.target.value, 10 ) || 0 } ) } />
								</Field>
								<Field label="Until (seconds)" hint="Empty = until the end.">
									<Input type="number" min="0" value={ it.end ?? '' } onChange={ ( e ) => setItem( i, { end: e.target.value === '' ? '' : parseInt( e.target.value, 10 ) || 0 } ) } />
								</Field>
							</div>
							<Field label="Content" hint="HTML or a shortcode, e.g. [contact-form-7 id=&quot;12&quot;].">
								<Textarea rows={ 4 } value={ it.content || '' } onChange={ ( e ) => setItem( i, { content: e.target.value } ) } placeholder="<h3>Grab the worksheet</h3> or [your_shortcode]" />
							</Field>
						</Card>
					) ) }
					<Button variant="secondary" onClick={ add }>+ Add segment</Button>
				</div>
			) }
		</div>
	);
}
