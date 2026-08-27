import { useCallback, useEffect, useState } from '@wordpress/element';
import { Card, Button, Badge, Input, Modal, Toast } from '../../components/UI';
import { Icon } from '../../components/icons';
import { brand } from '../../brand';
import {
	DEFAULT_LICENSE,
	LIMIT_REACHED,
	PURCHASE_URL,
	STORE_DASHBOARD_URL,
	buildStoreUrl,
	formatUtc,
	getSdk,
	licenseApi,
} from '../../license';

/**
 * License activation, in the shape the StoreEngine SDK's own page uses: a
 * headline that states what activating buys you, the key field with a single
 * primary action, and — once active — the five facts a site owner actually
 * checks (status, when it was last verified, expiry, activations left, whether
 * updates are on).
 *
 * All of it runs against the SDK's `storeengine-sdk/v1` REST routes rather than
 * its form POST, so the screen lives inside TruePlayer's admin instead of
 * bouncing to a separate WordPress page.
 *
 * Only rendered when `hasLicenseApi()` — see Settings.jsx.
 */
export default function LicensePanel() {
	const sdk = getSdk();
	const { name } = brand();

	const [ license, setLicense ] = useState( () => ( { ...DEFAULT_LICENSE, ...( sdk.license || {} ) } ) );
	const [ key, setKey ] = useState( '' );
	const [ busy, setBusy ] = useState( '' ); // '' | 'activate' | 'deactivate' | 'check'
	const [ toast, setToast ] = useState( null );
	// Set when the store refuses because every seat is taken; carries the
	// customer's other active sites so they can free one from here.
	const [ limit, setLimit ] = useState( null );

	const isActive = license.status === 'active';
	// The SDK keeps a license honoured while the store is unreachable. Saying so
	// is the difference between "we couldn't reach the store" and "your license
	// broke", which look identical from the outside.
	const inGrace = !! sdk.license_in_grace;

	const notify = ( tone, message ) => setToast( { tone, message } );

	const fail = useCallback( ( error, fallback ) => {
		notify( 'danger', ( error && error.message ) || fallback );
	}, [] );

	const refresh = useCallback( async ( { quiet = false } = {} ) => {
		setBusy( 'check' );
		try {
			const data = await licenseApi.status( true );
			// The route answers with either the license object or a wrapper
			// around it, depending on SDK version.
			setLicense( ( prev ) => ( { ...prev, ...( ( data && data.license ) || data || {} ) } ) );
			if ( ! quiet ) {
				notify( 'success', 'License status refreshed.' );
			}
		} catch ( e ) {
			if ( ! quiet ) {
				fail( e, 'Could not reach the license server.' );
			}
		} finally {
			setBusy( '' );
		}
	}, [ fail ] );

	// One quiet re-check on open so the panel doesn't show a stale expiry or a
	// key that was deactivated from the store dashboard.
	useEffect( () => {
		refresh( { quiet: true } );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	/**
	 * @param {string}   value The key to send.
	 * @param {number[]} frees Activation ids the customer chose to release, when
	 *                         re-trying from the limit-reached picker.
	 */
	const activate = async ( value, frees = [] ) => {
		if ( ! value ) {
			notify( 'danger', 'Enter your license key first.' );
			return;
		}
		setBusy( 'activate' );
		try {
			const data = await licenseApi.activate( value, frees );
			setLicense( ( prev ) => ( { ...prev, ...( ( data && data.license ) || {} ) } ) );
			setKey( '' );
			setLimit( null );
			// The store's own wording distinguishes "activated" from "updated"
			// (re-keying an existing install), which our copy can't know.
			notify( 'success', ( data && data.message ) || 'License activated.' );
		} catch ( e ) {
			// Every seat is in use. The store sends the other sites with the
			// refusal precisely so this is a choice, not a dead end.
			if ( e.code === LIMIT_REACHED && Array.isArray( e.data && e.data.sites ) ) {
				setLimit( { key: value, sites: e.data.sites, limit: e.data.limit, message: e.message } );
			} else {
				fail( e, 'Could not activate that license key.' );
			}
		} finally {
			setBusy( '' );
		}
	};

	const deactivate = async () => {
		// Deactivating frees the seat on the customer's account — worth a beat
		// of thought, since re-activating needs the key again.
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( `Deactivate this license on ${ window.location.hostname }? It frees the activation for another site.` ) ) {
			return;
		}
		setBusy( 'deactivate' );
		try {
			const data = await licenseApi.deactivate();
			setLicense( ( prev ) => ( { ...prev, ...DEFAULT_LICENSE, ...( ( data && data.license ) || data || {} ) } ) );
			notify( 'success', ( data && data.message ) || 'License deactivated.' );
		} catch ( e ) {
			fail( e, 'Could not deactivate this license.' );
		} finally {
			setBusy( '' );
		}
	};

	const purchaseUrl = buildStoreUrl( sdk.purchase_url || PURCHASE_URL );
	const dashboardUrl = buildStoreUrl( sdk.store_dashboard_url || STORE_DASHBOARD_URL );

	return (
		<div className="space-y-6">
			{ toast && <Toast message={ toast.message } tone={ toast.tone } onDismiss={ () => setToast( null ) } /> }

			<Card className="p-8">
				<div className="max-w-3xl mx-auto text-center">
					<LicenseMark active={ isActive } />

					<h3 className="font-semibold text-lg text-ink mt-4 mb-1 max-w-xl mx-auto">
						{ isActive
							? `${ name } Pro — license active`
							: `Activate ${ name } Pro for updates & support` }
					</h3>
					<p className="text-sm text-muted m-0 max-w-xl mx-auto">
						{ isActive
							? 'Automatic updates and priority support are switched on for this site.'
							: 'Activate your license to get automatic updates and priority support straight from your WordPress dashboard.' }
					</p>

					{ /* A key is on file but isn't active any more — expired, or
					     deactivated from the account dashboard. Without saying so,
					     the empty field reads as "we never had your key". The stored
					     value is masked by the server, so it's safe to show and
					     deliberately not pre-filled (the SDK's own form does the
					     same — a masked key would submit as garbage). */ }
					{ ! isActive && license.license && (
						<p className="mt-4 mb-0 text-sm text-muted bg-gray-50 rounded-card px-4 py-3">
							The key <span className="font-mono text-ink">{ license.license }</span> is on file
							but isn’t active on this site. Enter it again to re-activate, or check its
							status in <a href={ dashboardUrl } target="_blank" rel="noopener noreferrer">your account</a>.
						</p>
					) }

					{ inGrace && (
						<p className="mt-4 mb-0 text-sm text-warning bg-warning-light rounded-card px-4 py-3 text-left">
							The license server couldn’t be reached at the last check, so your license is
							being honoured on its last known-good state. Nothing to do — it re-verifies
							automatically.
						</p>
					) }

					<div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
						<Input
							className="flex-1 min-w-[300px] text-center font-mono"
							value={ isActive ? license.license || '' : key }
							readOnly={ isActive }
							placeholder="Enter your license key to activate"
							onChange={ ( e ) => setKey( e.target.value ) }
							onKeyDown={ ( e ) => {
								if ( e.key === 'Enter' && ! isActive ) {
									e.preventDefault();
									activate( key.trim() );
								}
							} }
							aria-label="License key"
						/>
						{ isActive ? (
							<Button variant="danger" onClick={ deactivate } disabled={ !! busy }>
								{ busy === 'deactivate' ? 'Deactivating…' : 'Deactivate license' }
							</Button>
						) : (
							<Button onClick={ () => activate( key.trim() ) } disabled={ !! busy }>
								<Icon name="check" className="w-4 h-4" />
								{ busy === 'activate' ? 'Activating…' : 'Activate license' }
							</Button>
						) }
						<a
							href={ dashboardUrl }
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center rounded border border-line bg-white px-4 py-2 text-sm font-medium text-ink no-underline hover:bg-brand-50 hover:text-brand-500 transition-colors"
						>
							Manage license
						</a>
					</div>

					{ ! isActive && (
						<p className="text-sm text-muted mt-4 mb-0">
							Don’t have a license key?{ ' ' }
							<a href={ purchaseUrl } target="_blank" rel="noopener noreferrer">Purchase one here</a>
						</p>
					) }
				</div>

				{ isActive && (
					<>
						<span className="block h-px w-full bg-line my-7" />
						<div className="flex flex-wrap justify-center gap-x-10 gap-y-5">
							<Meta label="Status">
								<Badge tone="green">Active</Badge>
							</Meta>
							<Meta label="Last checked">
								<span className="inline-flex items-center gap-1.5">
									{ license.updated_at ? formatUtc( license.updated_at ) : 'Never' }
									<button
										type="button"
										onClick={ () => refresh() }
										disabled={ !! busy }
										title="Check license status now"
										aria-label="Check license status now"
										className="inline-flex items-center text-brand-500 hover:opacity-70 disabled:opacity-40"
									>
										<Icon name="refresh" className={ `w-3.5 h-3.5 ${ busy === 'check' ? 'animate-spin' : '' }` } />
									</button>
								</span>
							</Meta>
							<Meta label="Expires">
								{ license.expires ? formatUtc( license.expires, 'date' ) : 'Never' }
							</Meta>
							<Meta label="Activations remaining">
								{ license.unlimited
									? 'Unlimited'
									: `${ license.remaining ?? 0 } out of ${ license.limit ?? 1 }` }
							</Meta>
							{ /* This is the SDK's own meaning: the store serves updates for
							     as long as the license is valid. Whether WordPress installs
							     them unattended is its own per-plugin setting, so the title
							     says which one this is. */ }
							<Meta label="Automatic updates">
								<span
									className="text-success font-medium"
									title="New versions are delivered from your account while this license is active. Unattended installs are a separate WordPress setting, under Plugins."
								>
									Enabled
								</span>
							</Meta>
						</div>
					</>
				) }
			</Card>

			{ limit && (
				<SeatPicker
					state={ limit }
					busy={ busy === 'activate' }
					onCancel={ () => setLimit( null ) }
					onConfirm={ ( ids ) => activate( limit.key, ids ) }
				/>
			) }
		</div>
	);
}

/**
 * "Every seat is taken" — pick which of the customer's other sites to release.
 *
 * The store returns its active-site list alongside the refusal (HTTP 409,
 * `license-activation-limit-reached`) so this can be a decision made here,
 * rather than sending someone to the account dashboard and back.
 */
function SeatPicker( { state, busy, onCancel, onConfirm } ) {
	const [ picked, setPicked ] = useState( [] );
	const sites = state.sites || [];

	const toggle = ( id ) =>
		setPicked( ( prev ) => ( prev.includes( id ) ? prev.filter( ( x ) => x !== id ) : [ ...prev, id ] ) );

	return (
		<Modal
			title="Activation limit reached"
			className="max-w-lg"
			onClose={ busy ? () => {} : onCancel }
			footer={
				<>
					<Button variant="ghost" onClick={ onCancel } disabled={ busy }>Cancel</Button>
					<Button variant="danger" onClick={ () => onConfirm( picked ) } disabled={ busy || ! picked.length }>
						{ busy ? 'Working…' : 'Release & activate here' }
					</Button>
				</>
			}
		>
			<p className="text-sm text-muted mt-0 mb-4">
				{ state.limit
					? `This license is already active on its maximum of ${ state.limit } site${ state.limit === 1 ? '' : 's' }. Choose which to deactivate so this site can take a seat.`
					: 'This license has reached its activation limit. Choose which site to deactivate so this site can take a seat.' }
			</p>

			{ ! sites.length ? (
				<p className="text-sm text-muted m-0">
					The store didn’t report any other active sites. Deactivate one from your
					account dashboard, then try again.
				</p>
			) : (
				<ul className="list-none p-0 m-0 space-y-2">
					{ sites.map( ( site ) => {
						const on = picked.includes( site.id );
						return (
							<li key={ site.id }>
								{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control -- the input is nested. */ }
								<label
									className={ `flex items-start gap-3 rounded border p-3 cursor-pointer transition-colors ${
										on ? 'border-brand-500 bg-brand-50' : 'border-line hover:bg-gray-50'
									}` }
								>
									<input
										type="checkbox"
										className="mt-0.5 shrink-0"
										checked={ on }
										disabled={ busy }
										onChange={ () => toggle( site.id ) }
									/>
									<span className="min-w-0">
										<span className="block text-sm text-ink break-all">
											{ site.site_url || '(unknown site)' }
										</span>
										{ site.activated_at && (
											<span className="block text-xs text-muted mt-0.5">
												Activated { site.activated_at }
											</span>
										) }
									</span>
								</label>
							</li>
						);
					} ) }
				</ul>
			) }
		</Modal>
	);
}

/** One label/value pair in the status strip. */
function Meta( { label, children } ) {
	return (
		<div className="text-center">
			<span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{ label }</span>
			<span className="block text-sm text-ink">{ children }</span>
		</div>
	);
}

/**
 * The product mark with a key/link glyph beside it — the SDK's page uses the
 * same "your install ↔ your license" pairing to say what activation connects.
 */
function LicenseMark( { active } ) {
	const { logo } = brand();
	const sdk = getSdk();
	const mark = logo || sdk.product_logo || '';
	return (
		<div className="inline-flex items-center gap-3 rounded-full border border-line px-5 py-2.5" aria-hidden="true">
			{ mark
				? <img src={ mark } alt="" className="w-6 h-6" />
				: <span className="inline-flex w-6 h-6 rounded bg-brand-500 text-white items-center justify-center">
					<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
				</span> }
			<Icon name="link" className={ `w-[18px] h-[18px] ${ active ? 'text-success' : 'text-gray-300' }` } />
			<Icon name="key" className={ `w-[18px] h-[18px] ${ active ? 'text-success' : 'text-gray-400' }` } />
		</div>
	);
}
