import { useEffect, useRef, useState } from '@wordpress/element';
import { Card, Field, FieldGroup, Input, Select, Button, Textarea, Toggle, ColorInput } from '../../components/UI';
import { BsTrash } from 'react-icons/bs';
import { Icon } from '../../components/icons';
import { formatTime } from '@Utils/format';
import { layerEditors, loadProviders, ExtSlot } from '@Ext/admin';
import { __, __sprintf } from '@Utils/translation';

const uid = () => 'ly_' + Math.random().toString( 36 ).slice( 2, 8 );

// Layer types: the email form, plus any type an extension supplies.
const TYPE_META = {
	...Object.fromEntries( Object.entries( layerEditors ).map( ( [ k, e ] ) => [ k, { label: e.label, hint: e.hint } ] ) ),
	form: { label: __( 'Email form' ), hint: __( 'Email capture over the video.' ) },
};

const POSITIONS = [
	[ 'top-left', __( 'Top left' ) ], [ 'top-center', __( 'Top center' ) ], [ 'top-right', __( 'Top right' ) ],
	[ 'middle-left', __( 'Middle left' ) ], [ 'middle-center', __( 'Center' ) ], [ 'middle-right', __( 'Middle right' ) ],
	[ 'bottom-left', __( 'Bottom left' ) ], [ 'bottom-center', __( 'Bottom center' ) ], [ 'bottom-right', __( 'Bottom right' ) ],
];

const newLayer = ( type ) => {
	const base = { id: uid(), type, start: 0, end: '' };
	if ( layerEditors[ type ] ) {
		return layerEditors[ type ].create( base );
	}
	switch ( type ) {
		case 'form':
			// `gate` by default: asking for an address is the point of this
			// layer, and a blocking panel is what actually gets it. An author who
			// wants the quieter version switches Mode to inline.
			return {
				...base,
				mode: 'gate',
				trigger: 'time',
				position: 'middle-center',
				required: true,
				collectName: false,
				dedupe: true,
				title: __( 'Subscribe to keep watching' ),
				description: '',
				buttonLabel: __( 'Subscribe' ),
				placeholder: 'you@email.com',
				thanks: '',
				provider: '',
				lists: [],
			};
		default:
			return base;
	}
};

/**
 * A moment in the video, entered as hours, minutes and seconds.
 *
 * The value is still stored as a plain second count — this only changes how it
 * is typed. A bare seconds box is fine for "show at 15", and unusable for a
 * timestamp partway through a lesson: nobody knows 1:07:30 as 4050.
 */
function TimeParts( { seconds = 0, onChange } ) {
	const total = Math.max( 0, parseInt( seconds, 10 ) || 0 );
	const parts = { h: Math.floor( total / 3600 ), m: Math.floor( ( total % 3600 ) / 60 ), s: total % 60 };

	const setPart = ( key, raw ) => {
		const next = { ...parts, [ key ]: Math.max( 0, parseInt( raw, 10 ) || 0 ) };
		onChange( next.h * 3600 + next.m * 60 + next.s );
	};

	// Labelled by hand rather than with `Field`, which hardcodes `mb-5` that a
	// className cannot override — three of those would push the group apart.
	return (
		<div className="grid grid-cols-3 gap-3">
			{ [ [ 'h', __( 'Hours' ) ], [ 'm', __( 'Minutes' ) ], [ 's', __( 'Seconds' ) ] ].map( ( [ key, label ] ) => (
				<label key={ key } className="block">
					<Input type="number" min="0" value={ parts[ key ] } onChange={ ( e ) => setPart( key, e.target.value ) } />
					<span className="block text-xs text-gray-400 mt-1.5">{ label }</span>
				</label>
			) ) }
		</div>
	);
}

/**
 * The Style tab: colours for the form, stored under `layer.style`.
 *
 * Each field is empty by default and stays out of the saved object until it is
 * set, so the player's stylesheet keeps supplying its own value — the form only
 * takes on a colour an author actually chose. That is why "reset" here is
 * simply clearing the field.
 */
function EmailFormStyle( { layer, set } ) {
	const style = layer.style || {};
	const setStyle = ( partial ) => set( { style: { ...style, ...partial } } );

	// The placeholder is the value the player uses when the field is left empty,
	// so "the default" is something an author can read rather than guess. One
	// set for both modes: the form looks the same either way, so a colour here
	// means the same thing whichever Mode is selected.
	const colors = [
		[ 'bg', __( 'Background' ), '#ffffff' ],
		[ 'title', __( 'Headline colour' ), '#111827' ],
		[ 'muted', __( 'Description colour' ), '#6b7280' ],
		[ 'buttonBg', __( 'Button background' ), __( 'player accent' ) ],
		[ 'buttonText', __( 'Button text colour' ), '#ffffff' ],
	];

	return (
		<>
			<p className="text-sm text-muted mb-4">{ __( 'Leave a field empty to keep the player’s own.' ) }</p>
			<div className="grid md:grid-cols-2 gap-x-6">
				{ colors.map( ( [ key, label, fallback ] ) => (
					<Field key={ key } label={ label }>
						<ColorInput value={ style[ key ] || '' } onChange={ ( v ) => setStyle( { [ key ]: v } ) } placeholder={ fallback } />
					</Field>
				) ) }
				<Field label={ __( 'Button corner radius (px)' ) }>
					<Input
						type="number"
						min="0"
						max="60"
						value={ style.buttonRadius ?? '' }
						onChange={ ( e ) => setStyle( { buttonRadius: '' === e.target.value ? '' : parseInt( e.target.value, 10 ) } ) }
						placeholder="8"
					/>
				</Field>
			</div>
		</>
	);
}

/**
 * Everything an Email form layer needs — the merged replacement for the old
 * Interactions → Email capture screen.
 *
 * Capture and the Layers email form were two features asking for the same
 * address, and only the former ever had a provider: every submission was routed
 * using the video's `config.optin`, so a form on a video that never configured
 * capture had nowhere to send anyone. The destination lives on the layer now.
 */
function EmailFormFields( { layer, set, rules } ) {
	const [ tab, setTab ] = useState( 'content' );

	return (
		<>
			{ /* What the form says versus how it looks. Splitting them keeps the
			     panel scannable: the colours are set once and rarely touched,
			     while the copy and destination are what an author comes back to. */ }
			<div className="inline-flex p-1 mb-5 rounded bg-subtle border border-line">
				{ [ [ 'content', __( 'Content' ) ], [ 'style', __( 'Style' ) ] ].map( ( [ key, label ] ) => (
					<button
						key={ key }
						type="button"
						onClick={ () => setTab( key ) }
						aria-pressed={ tab === key }
						className={ `px-4 py-1.5 rounded text-[13px] font-medium transition-colors ${
							tab === key ? 'bg-white text-brand-500 shadow-sm' : 'text-muted hover:text-ink'
						}` }
					>
						{ label }
					</button>
				) ) }
			</div>

			{ /* Display rules belong to the Content side: who sees the form is
			     part of what it does, not how it looks. They are passed in rather
			     than built here because every other layer type shows the same
			     editor without any tabs around it. */ }
			{ 'content' === tab ? (
				<>
					<EmailFormContent layer={ layer } set={ set } />
					{ rules }
				</>
			) : (
				<EmailFormStyle layer={ layer } set={ set } />
			) }
		</>
	);
}

/** The Content tab — what the form asks, when, and where the answer goes. */
function EmailFormContent( { layer, set } ) {
	const [ providers, setProviders ] = useState( null );

	useEffect( () => {
		loadProviders().then( setProviders ).catch( () => setProviders( [] ) );
	}, [] );

	const gate = 'inline' !== layer.mode;
	const chosen = ( providers || [] ).find( ( p ) => p.id === layer.provider );
	const lists = chosen ? chosen.lists || [] : [];

	const toggleList = ( id ) => {
		const has = ( layer.lists || [] ).includes( id );
		set( { lists: has ? layer.lists.filter( ( x ) => x !== id ) : [ ...( layer.lists || [] ), id ] } );
	};

	return (
		<>
			<div className="grid md:grid-cols-2 gap-x-6">
				<Field label={ __( 'Mode' ) } hint={ gate ? __( 'Covers the video and pauses it.' ) : __( 'A panel beside the picture; the video keeps playing.' ) }>
					<Select value={ layer.mode || 'gate' } onChange={ ( e ) => set( { mode: e.target.value } ) }>
						<option value="gate">{ __( 'Gate — pause and ask' ) }</option>
						<option value="inline">{ __( 'Inline — alongside the video' ) }</option>
					</Select>
				</Field>
				{ gate && (
					<Field label={ __( 'When to show' ) }>
						<Select value={ layer.trigger || 'time' } onChange={ ( e ) => set( { trigger: e.target.value } ) }>
							<option value="pre">{ __( 'Before playback' ) }</option>
							<option value="time">{ __( 'At a timestamp' ) }</option>
							<option value="end">{ __( 'When the video ends' ) }</option>
						</Select>
					</Field>
				) }
			</div>

			<Field
				label={ __( 'Position' ) }
				hint={ gate ? __( 'A gate covers the video; position applies to the inline mode.' ) : __( 'Where the panel sits over the picture.' ) }
			>
				<Select value={ layer.position || 'middle-center' } onChange={ ( e ) => set( { position: e.target.value } ) }>
					{ POSITIONS.map( ( [ v, lab ] ) => <option key={ v } value={ v }>{ lab }</option> ) }
				</Select>
			</Field>

			{ /* A gate fires once at a moment; an inline panel is shown across a
			     window. Two different questions, so two different controls. */ }
			{ gate && 'time' === ( layer.trigger || 'time' ) && (
				<FieldGroup label={ __( 'Show at' ) } hint={ __( 'How far into the video the gate appears.' ) }>
					<TimeParts seconds={ layer.start } onChange={ ( v ) => set( { start: v } ) } />
				</FieldGroup>
			) }
			{ ! gate && (
				<FieldGroup label={ __( 'Show from' ) } hint={ __( 'The form stays until the video ends.' ) }>
					<TimeParts seconds={ layer.start } onChange={ ( v ) => set( { start: v } ) } />
				</FieldGroup>
			) }

			<div className="grid md:grid-cols-2 gap-x-6">
				<Field label={ __( 'Headline' ) }><Input value={ layer.title || '' } onChange={ ( e ) => set( { title: e.target.value } ) } placeholder={ __( 'Subscribe to keep watching' ) } /></Field>
				<Field label={ __( 'Button label' ) }><Input value={ layer.buttonLabel || '' } onChange={ ( e ) => set( { buttonLabel: e.target.value } ) } placeholder={ __( 'Subscribe' ) } /></Field>
			</div>
			<div className="grid md:grid-cols-2 gap-x-6">
				<Field label={ __( 'Description' ) } hint={ __( 'Optional line under the headline.' ) }><Input value={ layer.description || '' } onChange={ ( e ) => set( { description: e.target.value } ) } placeholder={ __( 'Enter your email to continue.' ) } /></Field>
				<Field label={ __( 'Email placeholder' ) }><Input value={ layer.placeholder || '' } onChange={ ( e ) => set( { placeholder: e.target.value } ) } placeholder={ __( 'you@email.com' ) } /></Field>
			</div>
			{ ! gate && (
				<Field label={ __( 'Thank-you message' ) } hint={ __( 'Shown in place of the form once someone subscribes.' ) }>
					<Input value={ layer.thanks || '' } onChange={ ( e ) => set( { thanks: e.target.value } ) } placeholder={ __( 'Thanks — you’re in!' ) } />
				</Field>
			) }

			<FieldGroup label={ __( 'Send contacts to' ) } hint={ __( 'Where a submitted address goes.' ) }>
				<Select value={ layer.provider || '' } onChange={ ( e ) => set( { provider: e.target.value, lists: [] } ) }>
					<option value="">{ __( '— Select a provider —' ) }</option>
					{ ( providers || [] ).map( ( p ) => (
						<option key={ p.id } value={ p.id } disabled={ ! p.available }>
							{ p.name }{ ! p.available ? __( ' (not installed)' ) : '' }
						</option>
					) ) }
				</Select>
			</FieldGroup>

			{ lists.length > 0 && (
				<FieldGroup label={ __( 'Lists' ) } hint={ __( 'The contact is added to the selected lists.' ) }>
					<div className="flex flex-wrap gap-2">
						{ lists.map( ( li ) => {
							const on = ( layer.lists || [] ).includes( li.id );
							return (
								<button
									key={ li.id }
									type="button"
									onClick={ () => toggleList( li.id ) }
									className={ `text-sm px-2.5 py-1 rounded-full border transition-colors ${ on ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-line hover:border-brand-400' }` }
								>
									{ li.title }
								</button>
							);
						} ) }
					</div>
				</FieldGroup>
			) }

			<div className="space-y-3 mb-5">
				{ /* Shown for both modes: it is what decides whether a way out is
				     offered at all. Turned off, the gate gets its skip link and the
				     inline panel gets a dismiss — turned on, neither can be waved
				     away. The consequence differs by mode, so the label does too. */ }
				<Toggle
					checked={ layer.required !== false }
					onChange={ ( v ) => set( { required: v } ) }
					label={ gate
						? __( 'Required — the viewer can’t continue without subscribing' )
						: __( 'Required — the viewer can’t dismiss the form' ) }
				/>
				<Toggle checked={ !! layer.collectName } onChange={ ( v ) => set( { collectName: v } ) } label={ __( 'Also ask for a name' ) } />
				<Toggle
					checked={ layer.dedupe !== false }
					onChange={ ( v ) => set( { dedupe: v } ) }
					label={ __( 'Ask only once per viewer' ) }
				/>
			</div>
		</>
	);
}

export default function LayersTab( { config, patch, onPreviewLayer, previewingLayerId = null } ) {
	const layers = config.layers || [];
	// Non-form layers have no "Until" control — they always run to the end of
	// the video. A layer saved earlier with a numeric `end` would still vanish
	// part-way through with nothing in the editor to explain why, so it is
	// cleared as soon as the layer is touched.
	const setOne = ( i, partial ) => patch( {
		layers: layers.map( ( l, idx ) => {
			if ( idx !== i ) {
				return l;
			}
			const next = { ...l, ...partial };
			return 'form' === next.type ? next : { ...next, end: '' };
		} ),
	} );
	const remove = ( i ) => patch( { layers: layers.filter( ( _, idx ) => idx !== i ) } );
	const [ menu, setMenu ] = useState( false );
	// Where the type menu opens, measured each time rather than assumed. It used
	// to be pinned above the button, which put it behind the sticky header on a
	// short viewport and cut "Hotspot" — the first type — out of reach.
	const [ menuPos, setMenuPos ] = useState( { up: false, maxHeight: null } );
	const addBtnRef = useRef( null );

	const [ openId, setOpenId ] = useState( null );

	const toggleMenu = () => {
		// Measured before opening, not inside the updater — an updater can be
		// invoked more than once and must stay free of side effects.
		if ( ! menu && addBtnRef.current ) {
			const GAP = 8;
			const rect = addBtnRef.current.getBoundingClientRect();
			// The app header is sticky and opaque, so the room above the button
			// starts below it, not at the top of the window.
			const header = document.querySelector( '.tp-admin header' );
			const ceiling = header ? header.getBoundingClientRect().bottom : 0;
			const below = window.innerHeight - rect.bottom - GAP;
			const above = rect.top - ceiling - GAP;
			const up = above > below;
			// Whichever side has more room wins, and the menu is capped to it and
			// scrolls — on a short window the four types don't fit either way, and
			// a menu that runs off the screen hides the option it starts with.
			setMenuPos( { up, maxHeight: Math.max( 160, Math.round( up ? above : below ) ) } );
		}
		setMenu( ( m ) => ! m );
	};
	const add = ( type ) => { const l = newLayer( type ); patch( { layers: [ ...layers, l ] } ); setOpenId( l.id ); setMenu( false ); };

	return (
		<div className="space-y-4">
			<div>
				<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Layers' ) }</h3>
				<p className="text-sm text-gray-500">{ __( 'Timed elements over the video.' ) }</p>
			</div>

			{ layers.length === 0 && (
				<Card className="p-10 text-center border-dashed">
					<p className="text-sm text-gray-500">{ __( 'No layers yet.' ) }</p>
					<p className="text-xs text-gray-400 mt-1">{ __( 'Add one below.' ) }</p>
				</Card>
			) }

			<div className="space-y-2">
			{ layers.map( ( l, i ) => {
				const open = openId === l.id;
				const summary = __sprintf(
					'%1$s · %2$s – %3$s',
					TYPE_META[ l.type ]?.label || l.type,
					formatTime( l.start ?? 0 ),
					l.end === '' || l.end == null ? __( 'end' ) : formatTime( l.end )
				);
				const heading = l.title || l.tooltip || TYPE_META[ l.type ]?.label || l.type;
				return (
				<Card key={ l.id } className="overflow-hidden">
					{ /* The row is the accordion toggle, stretched under the eye so
					     the eye stays its own target on top of it — same
					     arrangement as the CTA overlay rows. */ }
					<div className={ `relative flex items-center gap-3 px-4 py-3 ${ open ? '' : 'hover:bg-gray-50' }` }>
						<button
							type="button"
							onClick={ () => setOpenId( open ? null : l.id ) }
							aria-expanded={ open }
							className="flex-1 min-w-0 text-left after:absolute after:inset-0 after:content-['']"
						>
							<span className="block font-medium text-ink truncate">{ heading }</span>
							<span className="block text-xs text-muted">{ summary }</span>
						</button>

						{ 'form' === l.type && onPreviewLayer && (
							<button
								type="button"
								onClick={ () => onPreviewLayer( l.id ) }
								title={ previewingLayerId === l.id ? __( 'Hide it from the live preview' ) : __( 'Show this in the live preview' ) }
								aria-label={ previewingLayerId === l.id ? __( 'Hide it from the live preview' ) : __( 'Show this in the live preview' ) }
								aria-pressed={ previewingLayerId === l.id }
								className={ `relative z-10 w-8 h-8 shrink-0 inline-flex items-center justify-center rounded border transition-colors ${
									previewingLayerId === l.id ? 'border-brand-500 bg-brand-50 text-brand-500' : 'border-line text-muted hover:text-ink hover:bg-gray-100'
								}` }
							>
								<Icon name="eye" className="w-4 h-4" />
							</button>
						) }

						<Icon name="chevronRight" className={ `w-3.5 h-3.5 text-muted shrink-0 transition-transform ${ open ? '-rotate-90' : 'rotate-90' }` } />
					</div>
					{ open && (
					<div className="px-6 pb-6 pt-4 border-t border-line">
					{ /* Every other layer is a timed window with a place on screen.
					     The email form is not: a gate has a trigger rather than a
					     window, and its position only means anything inline — so it
					     lays these out itself, below Mode. */ }
					{ l.type !== 'form' && (
					<>
						{ /* Hours/minutes/seconds rather than a raw seconds box, for
						     the same reason the email gate uses them: nobody knows
						     1:07:30 as 4050. These layers have no end control: they
						     run from `start` to the end of the video, which is what
						     `end: ''` means to the player. */ }
						<FieldGroup label={ __( 'Show from' ) } hint={ __( 'How far into the video this appears.' ) }>
							<TimeParts seconds={ l.start } onChange={ ( v ) => setOne( i, { start: v } ) } />
						</FieldGroup>
						{ ! layerEditors[ l.type ]?.unpositioned && (
							<Field label={ __( 'Position' ) } hint={ __( 'Where it sits over the picture.' ) }>
								<Select value={ l.position || 'middle-center' } onChange={ ( e ) => setOne( i, { position: e.target.value } ) }>
									{ POSITIONS.map( ( [ v, lab ] ) => <option key={ v } value={ v }>{ lab }</option> ) }
								</Select>
							</Field>
						) }
					</>
					) }

					{ layerEditors[ l.type ] && ( () => {
						const Fields = layerEditors[ l.type ].Fields;
						return <Fields layer={ l } set={ ( p ) => setOne( i, p ) } />;
					} )() }

					{ l.type === 'form' && (
						<EmailFormFields
							layer={ l }
							set={ ( p ) => setOne( i, p ) }
							rules={ <ExtSlot name="layers.rules" layer={ l } set={ ( p ) => setOne( i, p ) } /> }
						/>
					) }

					{ /* The email form renders these inside its Content tab instead,
					     so they don't also show up under Style. */ }
					{ 'form' !== l.type && <ExtSlot name="layers.rules" layer={ l } set={ ( p ) => setOne( i, p ) } /> }
					<div className="text-right mt-2"><Button variant="danger" size="sm" onClick={ () => remove( i ) }><BsTrash /></Button></div>
					</div>
					) }
				</Card>
				);
			} ) }
			</div>

			<div className="relative inline-block" ref={ addBtnRef }>
				<Button variant="secondary" onClick={ toggleMenu } className="inline-flex items-center gap-1.5">
					{ __( '+ Add layer' ) }
					<Icon name="chevronRight" className={ `w-3.5 h-3.5 transition-transform ${ menu ? '-rotate-90' : 'rotate-90' }` } />
				</Button>
				{ menu && (
					<>
						{ /* Above the sticky header (z-30), which is opaque and was
						     painting straight over the menu. */ }
						<div className="fixed inset-0 z-40" onClick={ () => setMenu( false ) } />
						<div
							className={ `absolute left-0 w-56 bg-white border border-line rounded-card shadow-pop z-50 py-1 overflow-y-auto ${ menuPos.up ? 'bottom-full mb-1' : 'top-full mt-1' }` }
							style={ menuPos.maxHeight ? { maxHeight: menuPos.maxHeight } : undefined }
						>
							{ Object.keys( TYPE_META ).map( ( t ) => (
								<button key={ t } type="button" onClick={ () => add( t ) } className="w-full text-left px-3 py-2 hover:bg-gray-100">
									<div className="text-sm font-medium text-ink">{ TYPE_META[ t ].label }</div>
									<div className="text-xs text-muted">{ TYPE_META[ t ].hint }</div>
								</button>
							) ) }
						</div>
					</>
				) }
			</div>
		</div>
	);
}
