import { useState } from '@wordpress/element';
import { api, EVENT_TYPES } from '../api';
import { Input, Button, Toggle, Badge } from './UI';
import { BsTrash } from 'react-icons/bs';
import { __, __sprintf } from '@Utils/translation';

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

	/**
	 * Turn a test result into something an admin can act on. A rejected
	 * delivery has to say the receiver's reason — "HTTP 422" alone sent us
	 * chasing a webhook that was firing perfectly well.
	 */
	const describeTest = ( res ) => {
		if ( res.error ) {
			return { ok: false, text: __sprintf( 'Could not reach endpoint: %s', res.error ) };
		}
		if ( res.ok ) {
			return { ok: true, text: __sprintf( 'Delivered — HTTP %d', res.code ) };
		}
		let reason = ( res.response || '' ).trim();
		try {
			const parsed = JSON.parse( reason );
			reason = parsed.message || parsed.error || reason;
		} catch ( e ) {
			// Not JSON — show the raw reply, trimmed.
		}
		return {
			ok: false,
			text: reason
				? __sprintf( 'Rejected — HTTP %1$d: %2$s', res.code, reason.slice( 0, 200 ) )
				: __sprintf( 'Rejected — HTTP %d', res.code ),
		};
	};

	const test = async ( i ) => {
		setTesting( ( t ) => ( { ...t, [ i ]: { ok: null, text: __( 'Sending…' ) } } ) );
		try {
			const res = await api.testWebhook( endpoints[ i ].url, endpoints[ i ].secret );
			setTesting( ( t ) => ( { ...t, [ i ]: describeTest( res ) } ) );
		} catch ( e ) {
			setTesting( ( t ) => ( { ...t, [ i ]: { ok: false, text: e.message } } ) );
		}
	};

	return (
		<div className="space-y-4">
			{ endpoints.map( ( e, i ) => (
				<div key={ e.id || i } className="border border-line rounded-lg p-4">
					{ /* Delete belongs to the endpoint, not to the URL field. Sitting
					     in the URL row it read as "clear this input" while it actually
					     removed the whole block, so it lives in the card's own header
					     with a label saying what it deletes. */ }
					<div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-line">
						<span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
							{ __sprintf( 'Endpoint %d', i + 1 ) }
						</span>
						<button
							type="button"
							onClick={ () => remove( i ) }
							title={ __sprintf( 'Delete endpoint %d', i + 1 ) }
							aria-label={ __sprintf( 'Delete endpoint %d', i + 1 ) }
							className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-gray-400 hover:text-danger hover:bg-danger-light transition-colors"
						>
							<BsTrash size={ 13 } /> { __( 'Delete' ) }
						</button>
					</div>
					<div className="flex gap-2 items-center mb-3">
						<Input value={ e.url } onChange={ ( ev ) => set( i, { url: ev.target.value } ) } placeholder="https://your-endpoint.example/hook" />
						<Button variant="ghost" onClick={ () => test( i ) }>{ __( 'Send test' ) }</Button>
					</div>
					{ testing[ i ] && (
						<p className={ `text-xs mb-2 ${ testing[ i ].ok === false ? 'text-red-600' : testing[ i ].ok ? 'text-green-600' : 'text-gray-500' }` }>
							{ __sprintf( 'Test: %s', testing[ i ].text ) }
						</p>
					) }
					<Input className="mb-3" value={ e.secret || '' } onChange={ ( ev ) => set( i, { secret: ev.target.value } ) } placeholder={ __( 'Signing secret (optional) — used for X-TruePlayer-Signature' ) } />
					<Toggle checked={ e.active !== false } onChange={ ( v ) => set( i, { active: v } ) } label={ __( 'Active' ) } />
					<div className="mt-2">
						<span className="block text-xs text-gray-500 mb-2">{ __( 'Events (none selected = all)' ) }</span>
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
			{ endpoints.length === 0 && <p className="text-sm text-gray-400 mb-2">{ __( 'No endpoints yet.' ) }</p> }
			<Button variant="ghost" onClick={ add }>{ __( '+ Add endpoint' ) }</Button>
		</div>
	);
}
