import { useEffect, useState } from '@wordpress/element';
import { Field, Input, Textarea, Select, Toggle, Button, Card, Badge } from '../components/UI';
import MediaPicker from '../components/MediaPicker';
import { api } from '../api';
import { BsTrash, BsPlus, BsChevronDown, BsChevronRight } from 'react-icons/bs';

/**
 * Renders an H5P content type's `semantics.json` as a native TruePlayer form.
 *
 * The stock H5P editor auto-generates its UI from semantics; so do we — but
 * with our own component kit, so an H5P item is authored with the same look as
 * the rest of the admin. Handles the field-based semantics types (text, html,
 * number, boolean, select, list, group, library, media); the spatial types
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

/** One semantics field → a control. */
function SemanticField( { field, value, onChange } ) {
	const label = field.label || field.name;
	const common = { label, hint: field.description || '' };

	switch ( field.type ) {
		case 'text':
			if ( field.widget === 'html' || Array.isArray( field.tags ) ) {
				return (
					<Field { ...common }>
						<Textarea
							rows={ 4 }
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
				<div className="mb-4">
					<Toggle
						checked={ value ?? field.default ?? false }
						onChange={ ( v ) => onChange( v ) }
						label={ label }
					/>
					{ field.description && <p className="text-xs text-gray-400 mt-1">{ field.description }</p> }
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
						value={ Array.isArray( value ) ? value[ 0 ]?.path : '' }
						onChange={ ( media ) =>
							onChange( media ? [ { path: media.url || media, mime: media.mime || `${ field.type }/mp4` } ] : undefined )
						}
					/>
				</Field>
			);

		case 'group':
			return (
				<GroupField field={ field } value={ value } onChange={ onChange } />
			);

		case 'list':
			return (
				<ListField field={ field } value={ value } onChange={ onChange } />
			);

		case 'library':
			return (
				<LibraryField field={ field } value={ value } onChange={ onChange } />
			);

		default:
			return (
				<Field label={ label } hint={ `Unsupported field type: ${ field.type }` }>
					<Input disabled value={ typeof value === 'object' ? JSON.stringify( value ) : ( value ?? '' ) } />
				</Field>
			);
	}
}

/** A `group` of sub-fields (collapsible when it has a label). */
function GroupField( { field, value, onChange } ) {
	const [ open, setOpen ] = useState( ! field.label || field.expanded !== false );
	const obj = value && typeof value === 'object' ? value : {};
	const setChild = ( name, v ) => onChange( { ...obj, [ name ]: v } );
	const fields = field.fields || [];

	// Single-field groups collapse to just their child (H5P convention).
	if ( fields.length === 1 ) {
		return (
			<SemanticField field={ fields[ 0 ] } value={ obj[ fields[ 0 ].name ] } onChange={ ( v ) => setChild( fields[ 0 ].name, v ) } />
		);
	}

	return (
		<Card className="p-4 mb-4">
			{ field.label && (
				<button type="button" className="flex items-center gap-2 w-full text-left font-medium text-gray-900 mb-1" onClick={ () => setOpen( ! open ) }>
					{ open ? <BsChevronDown /> : <BsChevronRight /> }
					{ field.label }
				</button>
			) }
			{ field.description && open && <p className="text-xs text-gray-400 mb-3">{ field.description }</p> }
			{ open && (
				<div className="mt-2">
					{ fields.map( ( f ) => (
						<SemanticField key={ f.name } field={ f } value={ obj[ f.name ] } onChange={ ( v ) => setChild( f.name, v ) } />
					) ) }
				</div>
			) }
		</Card>
	);
}

/** A `list` of repeated `field` items. */
function ListField( { field, value, onChange } ) {
	const items = Array.isArray( value ) ? value : [];
	const item = field.field || {};
	const min = field.min || 0;
	const max = field.max || Infinity;

	const setItem = ( i, v ) => onChange( items.map( ( it, idx ) => ( idx === i ? v : it ) ) );
	const add = () => onChange( [ ...items, defaultFor( item ) ] );
	const remove = ( i ) => onChange( items.filter( ( _, idx ) => idx !== i ) );

	return (
		<div className="mb-5">
			<div className="flex items-center justify-between mb-2">
				<span className="text-sm font-medium text-gray-800">{ field.label || field.name }</span>
				<Badge tone="gray">{ items.length }</Badge>
			</div>
			{ field.description && <p className="text-xs text-gray-400 mb-2">{ field.description }</p> }
			{ items.map( ( it, i ) => (
				<div key={ i } className="relative border border-line rounded-lg p-3 mb-2">
					<div className="flex items-center justify-between mb-1">
						<span className="text-xs text-gray-400">{ ( item.label || 'Item' ) + ' ' + ( i + 1 ) }</span>
						{ items.length > min && (
							<button type="button" className="text-gray-400 hover:text-red-500" onClick={ () => remove( i ) } aria-label="Remove">
								<BsTrash />
							</button>
						) }
					</div>
					<SemanticField field={ { ...item, label: item.label } } value={ it } onChange={ ( v ) => setItem( i, v ) } />
				</div>
			) ) }
			{ items.length < max && (
				<Button variant="ghost" size="sm" onClick={ add }>
					<BsPlus /> Add { ( field.entity || 'item' ) }
				</Button>
			) }
		</div>
	);
}

/** A `library` field: pick an allowed sub-library and edit its params. */
function LibraryField( { field, value, onChange } ) {
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
		<div className="mb-4">
			<Field label={ field.label || field.name } hint={ field.description }>
				{ options.length > 1 ? (
					<Select value={ current } onChange={ ( e ) => onChange( { library: e.target.value, params: {}, subContentId: uuid(), metadata: { contentType: machineOf( e.target.value ) } } ) }>
						<option value="">—</option>
						{ options.map( ( o ) => <option key={ o } value={ o }>{ o.split( ' ' )[ 0 ].replace( 'H5P.', '' ) }</option> ) }
					</Select>
				) : (
					<div className="text-xs text-gray-400">{ machineOf( current ).replace( 'H5P.', '' ) || '—' }</div>
				) }
			</Field>
			{ current && semantics && (
				<div className="pl-3 border-l-2 border-line ml-1">
					<SemanticsForm
						semantics={ semantics }
						value={ value?.params || {} }
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

export default function SemanticsForm( { semantics = [], value = {}, onChange } ) {
	const set = ( name, v ) => onChange( { ...value, [ name ]: v } );
	return (
		<div>
			{ ( semantics || [] ).map( ( field ) => (
				<SemanticField key={ field.name } field={ field } value={ value[ field.name ] } onChange={ ( v ) => set( field.name, v ) } />
			) ) }
		</div>
	);
}
