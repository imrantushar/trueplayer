import { useState } from '@wordpress/element';
import { api, EVENT_TYPES } from '../api';
import { Input, Button, Toggle, Badge } from './UI';
import { BsTrash } from 'react-icons/bs';

const uid = () => Math.random().toString( 36 ).slice( 2, 9 );

/** Reusable webhook-endpoint editor, shared by per-video + global settings. */
export function EndpointList( { endpoints, onChange } ) {
	const [ testing, setTesting ] = useState( {} );

	const add = () => onChange( [ ...endpoints, { id: uid(), url: '', secret: '', events: [], active: true } ] );
	const set = ( i, partial ) => onChange( endpoints.map( ( e, idx ) => ( idx === i ? { ...e, ...partial } : e ) ) );
	const remove = ( i ) => onChange( endpoints.filter( ( _, idx ) => idx !== i ) );

	const toggleEvent = ( i, ev ) => {
		const e = endpoints[ i ];
		const has = ( e.events || [] ).includes( ev );
		set( i, { events: has ? e.events.filter( ( x ) => x !== ev ) : [ ...( e.events || [] ), ev ] } );
	};

	const test = async ( i ) => {
		setTesting( ( t ) => ( { ...t, [ i ]: 'sending' } ) );
		try {
			const res = await api.testWebhook( endpoints[ i ].url, endpoints[ i ].secret );
			setTesting( ( t ) => ( { ...t, [ i ]: res.ok ? `HTTP ${ res.code }` : `Error: ${ res.error }` } ) );
		} catch ( e ) {
			setTesting( ( t ) => ( { ...t, [ i ]: e.message } ) );
		}
	};

	return (
		<div className="space-y-4">
			{ endpoints.map( ( e, i ) => (
				<div key={ e.id || i } className="border border-line rounded-lg p-4">
					<div className="flex gap-2 items-center mb-3">
						<Input value={ e.url } onChange={ ( ev ) => set( i, { url: ev.target.value } ) } placeholder="https://your-endpoint.example/hook" />
						<Button variant="ghost" onClick={ () => test( i ) }>Send test</Button>
						<Button variant="danger" onClick={ () => remove( i ) }><BsTrash /></Button>
					</div>
					{ testing[ i ] && <p className="text-xs text-gray-500 mb-2">Test: { testing[ i ] }</p> }
					<Input className="mb-3" value={ e.secret || '' } onChange={ ( ev ) => set( i, { secret: ev.target.value } ) } placeholder="Signing secret (optional) — used for X-TruePlayer-Signature" />
					<Toggle checked={ e.active !== false } onChange={ ( v ) => set( i, { active: v } ) } label="Active" />
					<div className="mt-2">
						<span className="block text-xs text-gray-500 mb-2">Events (none selected = all)</span>
						<div className="flex flex-wrap gap-2">
							{ EVENT_TYPES.map( ( ev ) => {
								const on = ( e.events || [] ).includes( ev );
								return (
									<button
										key={ ev }
										onClick={ () => toggleEvent( i, ev ) }
										className={ `text-xs px-2 py-1 rounded-full border ${ on ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-line' }` }
									>
										{ ev }
									</button>
								);
							} ) }
						</div>
					</div>
				</div>
			) ) }
			{ endpoints.length === 0 && <p className="text-sm text-gray-400 mb-2">No endpoints yet.</p> }
			<Button variant="ghost" onClick={ add }>+ Add endpoint</Button>
		</div>
	);
}
