import { useEffect, useState } from '@wordpress/element';
import { Field, Input, Textarea, Select, Toggle, Button, Badge } from '../components/UI';
import MediaPicker from '../components/MediaPicker';
import { api } from '../api';
import { BsTrash, BsPlus, BsChevronDown, BsChevronRight } from 'react-icons/bs';

/**
 * Renders an H5P content type's `semantics.json` as a native TruePlayer form.
 *
 * The stock H5P editor auto-generates its UI from semantics; so do we — but
 * with our own component kit and layout conventions (one containing Card, Field
 * rows, bordered sub-sections rather than nested cards) so an H5P item looks
 * like the rest of the admin. Handles the field-based semantics types (text,
 * html, number, boolean, select, list, group, library, media); spatial types
 * fall back to a nested form of the same primitives.
 */

const uuid = () =>
	'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, ( c ) => {
		const r = ( Math.random() * 16 ) | 0;
		return ( c === 'x' ? r : ( r & 0x3 ) | 0x8 ).toString( 16 );
	} );

// Module-level cache so a nested `library` field doesn't refetch semantics.
const semanticsCache = {};
async function loadSemantics( machineName ) {
	if ( ! semanticsCache[ machineName ] ) {
		semanticsCache[ machineName ] = api.h5pSemantics( machineName );
	}
	return semanticsCache[ machineName ];
}

const machineOf = ( libraryString ) => String( libraryString || '' ).split( ' ' )[ 0 ];

const stripTags = ( v ) => String( v ).replace( /<[^>]*>/g, ' ' ).replace( /&nbsp;/g, ' ' ).replace( /\s+/g, ' ' ).trim();

/**
 * First meaningful text inside a list item, used as its collapsed heading — a
 * stack of "Content 1 / Content 2" rows is unreadable, whereas the panel's own
 * title ("what is your name") tells you which row you want. Walks the item's
 * declared fields in semantics order so the content type decides what comes
 * first, rather than us guessing at key names.
 */
function itemSummary( itemField, value, depth = 0 ) {
	if ( depth > 2 || ! value ) {
		return '';
	}
	if ( typeof value === 'string' ) {
		return stripTags( value );
	}
	if ( typeof value !== 'object' ) {
		return '';
	}
	const fields = itemField.fields || ( itemField.field ? [ itemField.field ] : [] );
	for ( const f of fields ) {
		const v = value[ f.name ];
		if ( v === undefined || v === null ) {
			continue;
		}
		if ( f.type === 'text' && typeof v === 'string' ) {
			const text = stripTags( v );
			if ( text ) {
				return text;
			}
		}
		if ( f.type === 'group' ) {
			const nested = itemSummary( f, v, depth + 1 );
			if ( nested ) {
				return nested;
			}
		}
	}
	return '';
}

/** One semantics field → a control. `depth` drives nesting treatment. */
function SemanticField( { field, value, onChange, depth = 0 } ) {
	const label = field.label || field.name;
	const common = { label, hint: field.description || '' };

	switch ( field.type ) {
		case 'text':
			if ( field.widget === 'html' || Array.isArray( field.tags ) ) {
				return (
					<Field { ...common }>
						<Textarea
							rows={ 3 }
							value={ value ?? field.default ?? '' }
							onChange={ ( e ) => onChange( e.target.value ) }
							placeholder={ field.placeholder || '' }
						/>
					</Field>
				);
			}
			return (
				<Field { ...common }>
					<Input
						value={ value ?? field.default ?? '' }
						onChange={ ( e ) => onChange( e.target.value ) }
						placeholder={ field.placeholder || '' }
					/>
				</Field>
			);

		case 'number':
			return (
				<Field { ...common }>
					<Input
						type="number"
						value={ value ?? field.default ?? '' }
						min={ field.min }
						max={ field.max }
						step={ field.step || ( field.decimals ? 'any' : 1 ) }
						onChange={ ( e ) => onChange( e.target.value === '' ? undefined : Number( e.target.value ) ) }
					/>
				</Field>
			);

		case 'boolean':
			return (
				<div className="mb-5">
					<Toggle
						checked={ value ?? field.default ?? false }
						onChange={ ( v ) => onChange( v ) }
						label={ label }
					/>
					{ field.description && <p className="text-xs text-gray-400 mt-1.5">{ field.description }</p> }
				</div>
			);

		case 'select':
			return (
				<Field { ...common }>
					<Select value={ value ?? field.default ?? '' } onChange={ ( e ) => onChange( e.target.value ) }>
						{ ! field.default && <option value="">—</option> }
						{ ( field.options || [] ).map( ( o ) => (
							<option key={ o.value } value={ o.value }>{ o.label }</option>
						) ) }
					</Select>
				</Field>
			);

		case 'image':
		case 'file':
			return (
				<Field { ...common }>
					<MediaPicker
						accept="image"
						label="Upload"
						value={ value?.path || '' }
						onChange={ ( media ) =>
							onChange( media ? { path: media.url || media, mime: media.mime || 'image/jpeg', copyright: { license: 'U' } } : undefined )
						}
					/>
				</Field>
			);

		case 'video':
		case 'audio':
			return (
				<Field { ...common }>
					<MediaPicker
						accept={ field.type }
						label="Upload"
						value={ Array.isArray( value ) ? value[ 0 ]?.path : '' }
						onChange={ ( media ) =>
							onChange( media ? [ { path: media.url || media, mime: media.mime || `${ field.type }/mp4` } ] : undefined )
						}
					/>
				</Field>
			);

		case 'group':
			return <GroupField field={ field } value={ value } onChange={ onChange } depth={ depth } />;

		case 'list':
			return <ListField field={ field } value={ value } onChange={ onChange } depth={ depth } />;

		case 'library':
			return <LibraryField field={ field } value={ value } onChange={ onChange } depth={ depth } />;

		default:
			return (
				<Field label={ label } hint={ `Unsupported field type: ${ field.type }` }>
					<Input disabled value={ typeof value === 'object' ? JSON.stringify( value ) : ( value ?? '' ) } />
				</Field>
			);
	}
}

/**
 * A `group` of sub-fields. Top-level groups render as a divided section with a
 * collapsible heading; nested groups render as a lightly-indented labelled
 * block. Never a nested Card (matches the editor's tab layout).
 */
function GroupField( { field, value, onChange, depth = 0 } ) {
	const fields = field.fields || [];
	const obj = value && typeof value === 'object' ? value : {};
	const setChild = ( name, v ) => onChange( { ...obj, [ name ]: v } );

	// H5P convention: a single-field group collapses to just its child.
	if ( fields.length === 1 ) {
		return (
			<SemanticField field={ fields[ 0 ] } value={ obj[ fields[ 0 ].name ] } onChange={ ( v ) => setChild( fields[ 0 ].name, v ) } depth={ depth } />
		);
	}

	const body = (
		<div className="mt-4">
			{ fields.map( ( f ) => (
				<SemanticField key={ f.name } field={ f } value={ obj[ f.name ] } onChange={ ( v ) => setChild( f.name, v ) } depth={ depth + 1 } />
			) ) }
		</div>
	);

	if ( ! field.label ) {
		return body;
	}

	// Nested (inside another group/list): light labelled block, indented.
	if ( depth > 0 ) {
		return (
			<div className="mb-5">
				<span className="block text-[13px] font-medium text-ink mb-1">{ field.label }</span>
				{ field.description && <p className="text-xs text-gray-400 mb-2">{ field.description }</p> }
				<div className="pl-4 border-l border-line">{ body }</div>
			</div>
		);
	}

	// Top-level: a divided, collapsible section (matches OverlaysTab sections).
	// Settings groups (most top-level groups) start collapsed to keep the form
	// human-editable; only high-importance groups are expanded by default.
	return (
		<CollapsibleSection field={ field } defaultOpen={ field.importance === 'high' || field.expanded === true }>
			{ body }
		</CollapsibleSection>
	);
}

function CollapsibleSection( { field, children, defaultOpen = false, hint = '' } ) {
	const [ open, setOpen ] = useState( defaultOpen );
	return (
		<div className="mt-5 pt-5 border-t border-line first:mt-0 first:pt-0 first:border-0">
			<button type="button" className="flex items-center gap-2 w-full text-left group" onClick={ () => setOpen( ! open ) }>
				{ open ? <BsChevronDown className="text-gray-400 shrink-0" size={ 13 } /> : <BsChevronRight className="text-gray-400 shrink-0" size={ 13 } /> }
				<span className="font-medium text-gray-900 text-[15px]">{ field.label }</span>
				{ ! open && hint && <span className="text-xs text-gray-400 font-normal">{ hint }</span> }
			</button>
			{ field.description && open && <p className="text-sm text-gray-500 mt-1">{ field.description }</p> }
			{ open && children }
		</div>
	);
}

/**
 * A `list` of repeated `field` items, rendered as an accordion.
 *
 * Every item expanded at once buries the list — with a handful of panels the
 * "Add" button ends up several screens down and you cannot see the shape of
 * what you built. One open at a time keeps the whole list in view, and each
 * collapsed row is titled with its own content so it stays identifiable.
 */
function ListField( { field, value, onChange, depth = 0 } ) {
	const items = Array.isArray( value ) ? value : [];
	const item = field.field || {};
	const min = field.min || 0;
	const max = field.max || Infinity;
	const entity = item.label || field.entity || 'Item';

	// -1 = every row closed. A fresh list opens its first item, since a lone
	// collapsed row with nothing in it is just a dead end.
	const [ openIdx, setOpenIdx ] = useState( items.length === 1 ? 0 : -1 );

	const setItem = ( i, v ) => onChange( items.map( ( it, idx ) => ( idx === i ? v : it ) ) );
	const add = () => {
		onChange( [ ...items, defaultFor( item ) ] );
		setOpenIdx( items.length ); // open what was just added — it needs filling in
	};
	const remove = ( i ) => {
		onChange( items.filter( ( _, idx ) => idx !== i ) );
		// Keep the open row pointing at the same item after the list shifts.
		setOpenIdx( ( cur ) => ( cur === i ? -1 : cur > i ? cur - 1 : cur ) );
	};

	const inner = (
		<>
			{ items.map( ( it, i ) => {
				const open = openIdx === i;
				const summary = itemSummary( item, it );
				const ordinal = `${ entity } ${ i + 1 }`;
				return (
					<div key={ i } className={ `rounded border mb-2 overflow-hidden transition-colors ${ open ? 'border-brand-500 bg-white' : 'border-line bg-white' }` }>
						{ /* The whole header toggles the row — the title button is
						     stretched over it, so the trash stays its own target. */ }
						<div className={ `relative flex items-center gap-3 px-3.5 py-2.5 ${ open ? '' : 'hover:bg-gray-50' }` }>
							<span className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded bg-gray-100 text-[11px] font-semibold text-gray-500 tabular-nums">
								{ i + 1 }
							</span>

							<button
								type="button"
								onClick={ () => setOpenIdx( open ? -1 : i ) }
								aria-expanded={ open }
								className="flex-1 min-w-0 text-left after:absolute after:inset-0 after:content-['']"
							>
								<span className="block text-[13px] font-medium text-ink truncate">{ summary || ordinal }</span>
								{ summary && <span className="block text-[11px] text-gray-400 uppercase tracking-wide truncate">{ ordinal }</span> }
							</button>

							{ items.length > min && (
								<button
									type="button"
									className="relative z-10 w-7 h-7 shrink-0 inline-flex items-center justify-center rounded text-gray-400 hover:text-danger hover:bg-danger-light transition-colors"
									onClick={ () => remove( i ) }
									title={ `Remove ${ ordinal }` }
									aria-label={ `Remove ${ ordinal }` }
								>
									<BsTrash size={ 14 } />
								</button>
							) }

							<BsChevronDown size={ 13 } aria-hidden="true" className={ `shrink-0 text-gray-400 transition-transform ${ open ? 'rotate-180' : '' }` } />
						</div>

						{ open && (
							<div className="px-4 pt-4 pb-1 border-t border-line bg-gray-50/60">
								<SemanticField field={ { ...item, label: undefined } } value={ it } onChange={ ( v ) => setItem( i, v ) } depth={ depth + 1 } />
							</div>
						) }
					</div>
				);
			} ) }
			{ items.length < max && (
				<Button variant="ghost" size="sm" onClick={ add } className="!gap-1">
					<BsPlus size={ 18 } /> Add { field.entity || 'item' }
				</Button>
			) }
		</>
	);

	// A labelled top-level list gets the same divided section as a group, but a
	// plain heading rather than a collapsible one — the rows inside are already
	// an accordion, and collapsing the whole list behind a second toggle just
	// hides the primary content (panels, answers, cards) one level too deep.
	if ( field.label && depth === 0 ) {
		return (
			<div className="mt-5 pt-5 border-t border-line first:mt-0 first:pt-0 first:border-0">
				<h4 className="font-medium text-gray-900 text-[15px]">{ field.label }</h4>
				{ field.description && <p className="text-sm text-gray-500 mt-1">{ field.description }</p> }
				<div className="my-4">{ inner }</div>
			</div>
		);
	}

	return (
		<div className="mb-5">
			{ field.label && (
				<div className="flex items-center gap-2 mb-2">
					<span className="text-[13px] font-medium text-ink">{ field.label }</span>
					<ListCount n={ items.length } />
				</div>
			) }
			{ field.description && <p className="text-xs text-gray-400 mb-2">{ field.description }</p> }
			{ inner }
		</div>
	);
}

const ListCount = ( { n } ) => <Badge tone="gray">{ n }</Badge>;

/** A `library` field: pick an allowed sub-library and edit its params. */
function LibraryField( { field, value, onChange, depth = 0 } ) {
	const options = field.options || [];
	const current = value && value.library ? value.library : ( options.length === 1 ? options[ 0 ] : '' );
	const [ semantics, setSemantics ] = useState( null );

	useEffect( () => {
		let alive = true;
		if ( current ) {
			loadSemantics( machineOf( current ) ).then( ( res ) => alive && setSemantics( res.semantics || [] ) );
		} else {
			setSemantics( null );
		}
		return () => { alive = false; };
	}, [ current ] );

	// Ensure the value shell exists once a library is chosen.
	useEffect( () => {
		if ( current && ( ! value || value.library !== current ) ) {
			onChange( { library: current, params: value?.params || {}, subContentId: value?.subContentId || uuid(), metadata: value?.metadata || { contentType: machineOf( current ) } } );
		}
	}, [ current ] ); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div className="mb-5">
			{ options.length > 1 ? (
				<Field label={ field.label || field.name } hint={ field.description }>
					<Select value={ current } onChange={ ( e ) => onChange( { library: e.target.value, params: {}, subContentId: uuid(), metadata: { contentType: machineOf( e.target.value ) } } ) }>
						<option value="">—</option>
						{ options.map( ( o ) => <option key={ o } value={ o }>{ o.split( ' ' )[ 0 ].replace( 'H5P.', '' ) }</option> ) }
					</Select>
				</Field>
			) : (
				field.label && <span className="block text-[13px] font-medium text-ink mb-2">{ field.label }</span>
			) }
			{ current && semantics && (
				<div className="pl-4 border-l border-line">
					<SemanticsForm
						semantics={ semantics }
						value={ value?.params || {} }
						depth={ depth + 1 }
						onChange={ ( params ) => onChange( { ...( value || {} ), library: current, params, subContentId: value?.subContentId || uuid() } ) }
					/>
				</div>
			) }
		</div>
	);
}

/** Default value for a field (used when adding list items). */
function defaultFor( field ) {
	switch ( field.type ) {
		case 'group': {
			const obj = {};
			( field.fields || [] ).forEach( ( f ) => {
				const d = defaultFor( f );
				if ( d !== undefined ) obj[ f.name ] = d;
			} );
			return obj;
		}
		case 'list':
			return [];
		case 'boolean':
			return field.default ?? false;
		case 'library':
			return {};
		default:
			return field.default ?? ( field.type === 'text' ? '' : undefined );
	}
}

export default function SemanticsForm( { semantics = [], value = {}, onChange, depth = 0 } ) {
	const set = ( name, v ) => onChange( { ...value, [ name ]: v } );
	return (
		<div>
			{ ( semantics || [] ).map( ( field ) => (
				<SemanticField key={ field.name } field={ field } value={ value[ field.name ] } onChange={ ( v ) => set( field.name, v ) } depth={ depth } />
			) ) }
		</div>
	);
}
