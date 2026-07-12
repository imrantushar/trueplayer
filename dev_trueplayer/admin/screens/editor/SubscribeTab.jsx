import { useEffect, useState } from '@wordpress/element';
import { api } from '../../api';
import { Card, Field, Input, Select, Toggle, Badge } from '../../components/UI';

const DEFAULT = {
	enabled: false,
	provider: '',
	lists: [],
	position: 'pre',
	at: 15,
	required: true,
	collectName: false,
	headline: 'Subscribe to keep watching',
	description: 'Enter your email to continue.',
	buttonText: 'Subscribe & continue',
};

export default function SubscribeTab( { config, patch } ) {
	const optin = { ...DEFAULT, ...( config.optin || {} ) };
	const [ integrations, setIntegrations ] = useState( null );

	useEffect( () => {
		api.getIntegrations().then( setIntegrations ).catch( () => setIntegrations( [] ) );
	}, [] );

	const set = ( partial ) => patch( { optin: { ...optin, ...partial } } );

	const provider = ( integrations || [] ).find( ( i ) => i.id === optin.provider );
	const lists = provider ? provider.lists || [] : [];

	const toggleList = ( id ) => {
		const has = ( optin.lists || [] ).includes( id );
		set( { lists: has ? optin.lists.filter( ( x ) => x !== id ) : [ ...( optin.lists || [] ), id ] } );
	};

	const [ open, setOpen ] = useState( !! optin.enabled );

	return (
		<div className="space-y-6">
			<Card className="overflow-hidden max-w-2xl">
				<button type="button" onClick={ () => setOpen( ! open ) } className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50">
					<div className="flex-1 min-w-0">
						<div className="font-semibold text-gray-900">Subscribe / email capture</div>
						<div className="text-xs text-muted">Ask viewers to subscribe, then let them keep watching.</div>
					</div>
					<Badge tone={ optin.enabled ? 'green' : 'gray' }>{ optin.enabled ? 'On' : 'Off' }</Badge>
					<span className="text-muted text-xs">{ open ? '▲' : '▼' }</span>
				</button>

				{ open && (
				<div className="px-6 pb-6 pt-2 border-t border-line">
				<Toggle checked={ optin.enabled } onChange={ ( v ) => set( { enabled: v } ) } label="Enable email capture" />

				{ optin.enabled && (
					<>
						<Field label="Provider" hint="Where the contact is sent.">
							<Select value={ optin.provider } onChange={ ( e ) => set( { provider: e.target.value, lists: [] } ) }>
								<option value="">— Select —</option>
								{ ( integrations || [] ).map( ( i ) => (
									<option key={ i.id } value={ i.id } disabled={ ! i.available }>
										{ i.name }{ ! i.available ? ' (not installed)' : '' }
									</option>
								) ) }
							</Select>
						</Field>

						{ provider && provider.available && (
							<Field label="Lists" hint={ lists.length ? 'Contact is added to the selected lists.' : 'No lists found in this provider.' }>
								<div className="flex flex-wrap gap-2">
									{ lists.map( ( l ) => {
										const on = ( optin.lists || [] ).includes( l.id );
										return (
											<button
												key={ l.id }
												onClick={ () => toggleList( l.id ) }
												className={ `text-sm px-2.5 py-1 rounded-full border ${ on ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-line' }` }
											>
												{ l.title }
											</button>
										);
									} ) }
								</div>
							</Field>
						) }

						<div className="grid grid-cols-2 gap-4">
							<Field label="When to show">
								<Select value={ optin.position } onChange={ ( e ) => set( { position: e.target.value } ) }>
									<option value="pre">Before playback</option>
									<option value="time">At a timestamp</option>
									<option value="end">When the video ends</option>
								</Select>
							</Field>
							{ optin.position === 'time' && (
								<Field label="At (seconds)">
									<Input type="number" value={ optin.at } onChange={ ( e ) => set( { at: parseInt( e.target.value, 10 ) || 0 } ) } />
								</Field>
							) }
						</div>

						<Toggle checked={ optin.required } onChange={ ( v ) => set( { required: v } ) } label="Required (can't continue without subscribing)" />
						<Toggle checked={ optin.collectName } onChange={ ( v ) => set( { collectName: v } ) } label="Also collect name" />

						<Field label="Headline"><Input value={ optin.headline } onChange={ ( e ) => set( { headline: e.target.value } ) } /></Field>
						<Field label="Description"><Input value={ optin.description } onChange={ ( e ) => set( { description: e.target.value } ) } /></Field>
						<Field label="Button text"><Input value={ optin.buttonText } onChange={ ( e ) => set( { buttonText: e.target.value } ) } /></Field>
					</>
				) }
				</div>
				) }
			</Card>

			<Card className="p-4 max-w-2xl bg-gray-50">
				<p className="text-sm text-gray-500">
					<strong>Integrations detected:</strong>{ ' ' }
					{ integrations === null
						? 'Loading…'
						: integrations.map( ( i ) => (
								<span key={ i.id } className="inline-flex items-center gap-1 mr-2">
									{ i.name } <Badge tone={ i.available ? 'green' : 'gray' }>{ i.available ? 'active' : 'not installed' }</Badge>
								</span>
						  ) ) }
				</p>
				<p className="text-xs text-gray-400 mt-2">Other plugins can add providers via the <code>trueplayer/integrations/register</code> filter or handle opt-ins via the <code>trueplayer/subscribe</code> filter.</p>
			</Card>
		</div>
	);
}
