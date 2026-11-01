import { useState } from '@wordpress/element';
import { Card, Field, Input, Button, Textarea, Toggle, SectionTitle } from '../../components/UI';
import { Icon } from '../../components/icons';
import { BsTrash } from 'react-icons/bs';
import { __, __sprintf } from '@Utils/translation';

const uid = () => 'tc_' + Math.random().toString( 36 ).slice( 2, 8 );

/**
 * Timed content (pro) — a region rendered BELOW the player that swaps its
 * content as the video plays. Each item is a time range + HTML/shortcode block.
 */
export default function TimedContentTab( { config, patch } ) {
	const timed = config.timedContent || { enabled: false, items: [] };
	const items = timed.items || [];
	const [ openId, setOpenId ] = useState( null );

	const set = ( partial ) => patch( { timedContent: { ...timed, ...partial } } );
	const setItem = ( i, partial ) => set( { items: items.map( ( it, idx ) => ( idx === i ? { ...it, ...partial } : it ) ) } );
	const add = () => { const it = { id: uid(), start: 0, end: '', content: '' }; set( { items: [ ...items, it ] } ); setOpenId( it.id ); };
	const remove = ( i ) => set( { items: items.filter( ( _, idx ) => idx !== i ) } );

	return (
		<div className="space-y-6">
			<Card className="p-6 max-w-2xl">
				<SectionTitle>{ __( 'Timed content' ) }</SectionTitle>
				<p className="text-sm text-gray-500 !mb-4">
					{ __( 'Show a block of content under the player during a time range — a form when the demo ends, a coupon at the pitch, notes that track the lesson. Any shortcode works.' ) }
				</p>
				<Toggle checked={ !! timed.enabled } onChange={ ( v ) => set( { enabled: v } ) } label={ __( 'Enable timed content region' ) } />
			</Card>

			{ timed.enabled && (
				<div className="space-y-2 max-w-2xl">
					{ items.map( ( it, i ) => {
						const open = openId === it.id;
						const summary = ( it.end === '' || it.end == null )
							? __sprintf( '%ds – end', it.start ?? 0 )
							: __sprintf( '%1$ds – %2$ds', it.start ?? 0, it.end );
						return (
							<Card key={ it.id } className="overflow-hidden">
								<button type="button" onClick={ () => setOpenId( open ? null : it.id ) } className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
									<span className="text-xs font-semibold text-muted tabular-nums">{ summary }</span>
									<div className="flex-1 min-w-0 text-sm text-ink truncate">{ ( it.content || '' ).replace( /<[^>]+>/g, '' ).trim() || __sprintf( 'Segment %d', i + 1 ) }</div>
									<Icon name="chevronRight" className={ `w-3.5 h-3.5 text-muted shrink-0 transition-transform ${ open ? '-rotate-90' : 'rotate-90' }` } />
								</button>
								{ open && (
									<div className="px-6 pb-6 pt-4 border-t border-line">
										<div className="grid md:grid-cols-2 gap-x-6">
											<Field label={ __( 'From (seconds)' ) }>
												<Input type="number" min="0" value={ it.start ?? 0 } onChange={ ( e ) => setItem( i, { start: parseInt( e.target.value, 10 ) || 0 } ) } />
											</Field>
											<Field label={ __( 'Until (seconds)' ) } hint={ __( 'Empty = until the end.' ) }>
												<Input type="number" min="0" value={ it.end ?? '' } onChange={ ( e ) => setItem( i, { end: e.target.value === '' ? '' : parseInt( e.target.value, 10 ) || 0 } ) } />
											</Field>
										</div>
										<Field label={ __( 'Content' ) } hint={ __( 'HTML or a shortcode, e.g. [contact-form-7 id="12"].' ) }>
											<Textarea rows={ 4 } value={ it.content || '' } onChange={ ( e ) => setItem( i, { content: e.target.value } ) } placeholder={ __( '<h3>Grab the worksheet</h3> or [your_shortcode]' ) } />
										</Field>
										<div className="text-right mt-2"><Button variant="danger" size="sm" onClick={ () => remove( i ) }><BsTrash /></Button></div>
									</div>
								) }
							</Card>
						);
					} ) }
					<Button variant="secondary" onClick={ add }>{ __( '+ Add segment' ) }</Button>
				</div>
			) }
		</div>
	);
}
