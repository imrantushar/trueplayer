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

const RULE_FIELDS = [
	[ 'logged_in', 'Viewer is logged in' ],
	[ 'crm_contact', 'Is a CRM contact' ],
	[ 'crm_tag', 'Has CRM tag' ],
	[ 'crm_list', 'In CRM list' ],
	[ 'email_submitted', 'Has submitted email' ],
	[ 'url_param', 'URL parameter' ],
	[ 'layer_seen', 'Has seen layer (id)' ],
	[ 'layer_completed', 'Completed layer (id)' ],
];
const BOOL_FIELDS = [ 'logged_in', 'crm_contact', 'email_submitted' ];

// Compact per-layer conditional-rules builder (pro). Shows the layer only to
// viewers matching the rules — mirrors TruePlayer\Services\Rules.
function ConditionsEditor( { value, onChange } ) {
	const group = value && value.rules ? value : { match: 'all', rules: [] };
	const set = ( partial ) => onChange( { ...group, ...partial } );
	const setRule = ( idx, partial ) =>
		set( { rules: group.rules.map( ( r, i ) => ( i === idx ? { ...r, ...partial } : r ) ) } );
	const addRule = () => set( { rules: [ ...group.rules, { field: 'logged_in', operator: 'is', value: 'yes' } ] } );
	const removeRule = ( idx ) => set( { rules: group.rules.filter( ( _, i ) => i !== idx ) } );

	return (
		<div className="mt-4 border-t border-line pt-4">
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs font-semibold text-ink uppercase tracking-wide">Display rules</span>
				{ group.rules.length > 1 && (
					<Select value={ group.match } onChange={ ( e ) => set( { match: e.target.value } ) } className="w-auto text-xs">
						<option value="all">Match all</option>
						<option value="any">Match any</option>
					</Select>
				) }
			</div>
			{ ! group.rules.length && <p className="text-xs text-gray-400 mb-2">Always shown. Add a rule to target specific viewers.</p> }
			{ group.rules.map( ( r, idx ) => {
				const isBool = BOOL_FIELDS.includes( r.field );
				return (
					<div key={ idx } className="flex flex-wrap gap-2 mb-2 items-center">
						<Select value={ r.field } onChange={ ( e ) => setRule( idx, { field: e.target.value } ) } className="w-auto">
							{ RULE_FIELDS.map( ( [ v, label ] ) => <option key={ v } value={ v }>{ label }</option> ) }
						</Select>
						<Select value={ r.operator } onChange={ ( e ) => setRule( idx, { operator: e.target.value } ) } className="w-auto">
							<option value="is">is</option>
							<option value="is_not">is not</option>
							{ ! isBool && <option value="contains">contains</option> }
						</Select>
						{ r.field === 'url_param' && (
							<Input value={ r.key || '' } onChange={ ( e ) => setRule( idx, { key: e.target.value } ) } placeholder="param key" className="w-28" />
						) }
						{ isBool ? (
							<Select value={ r.value } onChange={ ( e ) => setRule( idx, { value: e.target.value } ) } className="w-auto">
								<option value="yes">yes</option>
								<option value="no">no</option>
							</Select>
						) : (
							<Input value={ r.value } onChange={ ( e ) => setRule( idx, { value: e.target.value } ) } placeholder="value" className="w-32" />
						) }
						<Button variant="ghost" size="sm" onClick={ () => removeRule( idx ) }>×</Button>
					</div>
				);
			} ) }
			<Button variant="ghost" size="sm" onClick={ addRule }>+ Add rule</Button>
		</div>
	);
}

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
			<div className="flex items-center justify-between gap-4 pb-4 border-b border-line">
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

					<ConditionsEditor value={ l.conditions } onChange={ ( c ) => setOne( i, { conditions: c } ) } />
				</Card>
			) ) }
		</div>
	);
}
