import { useState } from '@wordpress/element';
import { Card, Field, Input, Select, Toggle, Button, Badge, ColorInput } from '../../components/UI';
import { Icon } from '../../components/icons';
import { secToClock } from '../../utils/chapters';
import { BsTrash } from 'react-icons/bs';

const newOverlay = ( type = 'cta' ) => ( {
	id: 'ov_' + Math.random().toString( 36 ).slice( 2, 8 ),
	type,
	...( type === 'text'
		? { start: 0, end: 10, position: 'top-left', title: '', text: '', background: '#000000', bgOpacity: 60 }
		: { trigger: 'time', at: 10, title: '', text: '', buttonLabel: 'Learn more', buttonUrl: '', pause: true, dismissible: true } ),
} );

const POSITIONS = [
	[ 'top-left', 'Top left' ], [ 'top-center', 'Top center' ], [ 'top-right', 'Top right' ],
	[ 'middle-left', 'Middle left' ], [ 'middle-center', 'Center' ], [ 'middle-right', 'Middle right' ],
	[ 'bottom-left', 'Bottom left' ], [ 'bottom-center', 'Bottom center' ], [ 'bottom-right', 'Bottom right' ],
];

const posLabel = ( v ) => ( POSITIONS.find( ( p ) => p[ 0 ] === v ) || [ , v ] )[ 1 ];

export default function OverlaysTab( { config, patch, onPreviewOverlay, previewingId = null } ) {
	const overlays = config.overlays || [];
	const actionBar = config.actionBar || {};
	const setOne = ( i, partial ) => patch( { overlays: overlays.map( ( o, idx ) => ( idx === i ? { ...o, ...partial } : o ) ) } );
	const remove = ( i ) => {
		// Clear it from the preview first, or the player keeps showing a card
		// that no longer exists in the list.
		if ( previewingId && overlays[ i ] && overlays[ i ].id === previewingId && onPreviewOverlay ) {
			onPreviewOverlay( previewingId );
		}
		patch( { overlays: overlays.filter( ( _, idx ) => idx !== i ) } );
	};
	const setBar = ( partial ) => patch( { actionBar: { ...actionBar, ...partial } } );
	const [ openId, setOpenId ] = useState( null );
	const [ menu, setMenu ] = useState( false );
	const addAndOpen = ( type ) => { const o = newOverlay( type ); patch( { overlays: [ ...overlays, o ] } ); setOpenId( o.id ); setMenu( false ); };

	return (
		<div className="space-y-6 max-w-2xl">
			{ /* Action bar */ }
			<Card className="p-6">
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<h3 className="font-semibold text-gray-900 !mb-1">Action bar</h3>
						<p className="text-sm text-gray-500">A persistent, clickable bar over the player — text plus a button.</p>
					</div>
					<Badge tone={ actionBar.enabled ? 'green' : 'gray' }>{ actionBar.enabled ? 'On' : 'Off' }</Badge>
				</div>
				<div className='mt-4 pt-5 border-t border-solid border-line'>
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<span className="block text-[13px] font-medium text-ink">Show the action bar</span>
							<span className="block text-xs text-muted mt-0.5">Keep a persistent CTA visible while the video plays.</span>
						</div>
						<Toggle checked={ !! actionBar.enabled } onChange={ ( v ) => setBar( { enabled: v } ) } />
					</div>
					{ actionBar.enabled && (
						<div className="mt-6">
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
									<ColorInput value={ actionBar.background || '' } onChange={ ( v ) => setBar( { background: v } ) } placeholder="(accent)" />
								</Field>
							</div>
						</div>
					) }
				</div>
			</Card>

			<div>
				<h3 className="font-semibold text-gray-900 !mb-1">Overlays</h3>
				<p className="text-sm text-gray-500">CTA cards pause for attention; text overlays label the picture during a window.</p>
			</div>

			{ overlays.length === 0 && (
				<Card className="p-10 text-center border-dashed">
					<p className="text-sm text-gray-500">No overlays yet.</p>
					<p className="text-xs text-gray-400 mt-1">Add a CTA card to promote an offer, or a text overlay to title a section.</p>
				</Card>
			) }

			<div className="space-y-2">
				{ overlays.map( ( o, i ) => {
					const isText = ( o.type || 'cta' ) === 'text';
					const open = openId === o.id;
					const shown = previewingId === o.id;
					const summary = isText
						? `${ secToClock( o.start ) }–${ o.end === '' || o.end == null ? 'end' : secToClock( o.end ) } · ${ posLabel( o.position || 'top-left' ) }`
						: ( o.trigger === 'end' ? 'End screen' : `At ${ secToClock( o.at ) }` );
					return (
						<Card key={ o.id } className={ `overflow-hidden transition-colors ${ open ? '!border-brand-500' : '' }` }>
							<div className={ `relative flex items-center gap-3 px-4 py-3 ${ open ? '' : 'hover:bg-gray-50' }` }>
								<Badge tone={ isText ? 'gray' : 'brand' }>{ isText ? 'Text' : 'CTA' }</Badge>

								{ /* The row itself is the accordion toggle — the button is
								     stretched across the header so the eye stays its own
								     target on top of it. */ }
								<button
									type="button"
									onClick={ () => setOpenId( open ? null : o.id ) }
									aria-expanded={ open }
									className="flex-1 min-w-0 text-left after:absolute after:inset-0 after:content-['']"
								>
									<span className="block font-medium text-ink truncate">{ o.title || ( isText ? 'Text overlay' : 'CTA card' ) }</span>
									<span className="block text-xs text-muted tabular-nums">{ summary }</span>
								</button>

								<button
									type="button"
									onClick={ () => onPreviewOverlay && onPreviewOverlay( o.id ) }
									title={ shown ? 'Hide it from the live preview' : 'Show this in the live preview' }
									aria-label={ shown ? 'Hide it from the live preview' : 'Show this in the live preview' }
									aria-pressed={ shown }
									className={ `relative z-10 w-8 h-8 shrink-0 inline-flex items-center justify-center rounded border transition-colors ${
										shown ? 'border-brand-500 bg-brand-50 text-brand-500' : 'border-line text-muted hover:text-ink hover:bg-gray-100'
									}` }
								>
									<Icon name="eye" className="w-4 h-4" />
								</button>

								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={ `shrink-0 text-muted transition-transform ${ open ? 'rotate-180' : '' }` }><path d="M6 9l6 6 6-6" /></svg>
							</div>

							{ open && (
								<div className="px-6 pb-6 pt-4 border-t border-line">
									{ isText ? (
										<>
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
													<ColorInput value={ o.background || '' } onChange={ ( v ) => setOne( i, { background: v } ) } />
												</Field>
												<Field label={ `Background opacity (${ o.bgOpacity ?? 60 }%)` }>
													<input type="range" min="0" max="100" step="5" value={ o.bgOpacity ?? 60 } onChange={ ( e ) => setOne( i, { bgOpacity: parseInt( e.target.value, 10 ) } ) } className="w-full accent-brand-500 cursor-pointer" />
												</Field>
											</div>
										</>
									) : (
										<>
											<div className="grid md:grid-cols-2 gap-x-6">
												<Field label="Trigger">
													<Select value={ o.trigger } onChange={ ( e ) => setOne( i, { trigger: e.target.value } ) }>
														<option value="time">At a timestamp</option>
														<option value="end">At the end (end screen)</option>
													</Select>
												</Field>
												{ o.trigger === 'time' && (
													<Field label="Show at (seconds)">
														<Input type="number" min="0" value={ o.at } onChange={ ( e ) => setOne( i, { at: parseInt( e.target.value, 10 ) || 0 } ) } />
													</Field>
												) }
											</div>
											<Field label="Heading"><Input value={ o.title } onChange={ ( e ) => setOne( i, { title: e.target.value } ) } placeholder="Ready for the next step?" /></Field>
											<Field label="Text"><Input value={ o.text } onChange={ ( e ) => setOne( i, { text: e.target.value } ) } placeholder="Join the full course to keep learning." /></Field>
											<div className="grid md:grid-cols-2 gap-x-6">
												<Field label="Button label"><Input value={ o.buttonLabel } onChange={ ( e ) => setOne( i, { buttonLabel: e.target.value } ) } placeholder="Learn more" /></Field>
												<Field label="Button URL"><Input value={ o.buttonUrl } onChange={ ( e ) => setOne( i, { buttonUrl: e.target.value } ) } placeholder="https://…" /></Field>
											</div>
											{ o.trigger === 'time' && (
												<Toggle checked={ o.pause } onChange={ ( v ) => setOne( i, { pause: v } ) } label="Pause the video while showing" />
											) }
											<Toggle className="mt-6" checked={ o.dismissible !== false } onChange={ ( v ) => setOne( i, { dismissible: v } ) } label="Let viewers dismiss it (× close)" />
										</>
									) }
									<div className="text-right mt-2">
										<Button variant="danger" size="sm" onClick={ () => remove( i ) }><BsTrash /></Button>
									</div>
								</div>
							) }
						</Card>
					);
				} ) }
			</div>

			<div className="relative">
				<button
					type="button"
					onClick={ () => setMenu( ( m ) => ! m ) }
					aria-haspopup="menu"
					aria-expanded={ menu }
					className="w-full border border-dashed border-line rounded-card py-3.5 text-sm font-medium text-brand-500 hover:border-brand-400 hover:bg-brand-50 transition-colors"
				>
					+ Add overlay
				</button>
				{ menu && (
					<>
						<div className="fixed inset-0 z-10" onClick={ () => setMenu( false ) } />
						<div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-line rounded-card shadow-pop z-20 py-1" role="menu">
							<button type="button" role="menuitem" onClick={ () => addAndOpen( 'cta' ) } className="w-full text-left px-4 py-2.5 hover:bg-gray-100">
								<div className="text-sm font-medium text-ink">CTA card</div>
								<div className="text-xs text-muted">Pauses the video to promote an offer.</div>
							</button>
							<button type="button" role="menuitem" onClick={ () => addAndOpen( 'text' ) } className="w-full text-left px-4 py-2.5 hover:bg-gray-100">
								<div className="text-sm font-medium text-ink">Text overlay</div>
								<div className="text-xs text-muted">Labels the picture during a time window.</div>
							</button>
						</div>
					</>
				) }
			</div>
		</div>
	);
}
