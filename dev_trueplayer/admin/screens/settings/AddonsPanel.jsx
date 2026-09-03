import { useState } from '@wordpress/element';
import { Card, Button, Badge, Toast, Toggle } from '../../components/UI';
import { Icon } from '../../components/icons';
import { api } from '../../api';
import { __ } from '@Utils/translation';

/**
 * Settings → Addons. One row per registered addon, each describing itself.
 *
 * The list comes from `TruePlayerGlobal.addons_registry`, which every addon
 * contributes to (`trueplayer/addons/registry`), so this screen never needs to
 * know what exists — a new addon appears here by registering, not by editing
 * this file.
 *
 * Toggling reloads rather than re-rendering: activation runs the addon's own
 * setup (creating its tables, registering its routes) and changes what PHP
 * localises into every screen, so the page has to be re-read.
 */
export default function AddonsPanel() {
	const addons = ( window.TruePlayerGlobal && window.TruePlayerGlobal.addons_registry ) || [];
	const [ busy, setBusy ] = useState( '' );
	const [ toast, setToast ] = useState( null );

	const toggle = async ( addon, next ) => {
		setBusy( addon.slug );
		try {
			await api.setAddonStatus( addon.slug, next );
			window.location.reload();
		} catch ( e ) {
			setToast( { tone: 'danger', message: e.message || __( 'Could not change the addon status.' ) } );
			setBusy( '' );
		}
	};

	if ( ! addons.length ) {
		return (
			<Card className="p-8 text-center">
				<p className="text-sm text-muted m-0">{ __( 'No addons are registered on this site.' ) }</p>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{ toast && <Toast message={ toast.message } tone={ toast.tone } onDismiss={ () => setToast( null ) } /> }

			<Card className="p-6">
				<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Addons' ) }</h3>
				<p className="text-sm text-muted mb-4">
					{ __( 'Optional features, off until you need them. Enabling one sets up whatever it needs — including its database tables — the moment you switch it on.' ) }
				</p>

				<div className="mt-4 pt-5 border-t border-solid border-line space-y-4">
					{ addons.map( ( addon ) => {
						const missing = addon.installed === false;
						return (
							<div key={ addon.slug } className="flex items-start gap-4 rounded-card border border-line p-4">
								<span className="inline-flex w-10 h-10 shrink-0 rounded bg-brand-100 text-brand-500 items-center justify-center">
									<Icon name={ addon.icon || 'spark' } className="w-5 h-5" />
								</span>

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="font-medium text-ink">{ addon.label }</span>
										{ addon.active
											? <Badge tone="green">{ __( 'Enabled' ) }</Badge>
											: <Badge tone="gray">{ __( 'Disabled' ) }</Badge> }
										{ missing && <Badge tone="amber">{ __( 'Not available in this build' ) }</Badge> }
									</div>
									{ addon.description && <p className="text-sm text-muted mt-1 mb-0">{ addon.description }</p> }
									{ addon.note && <p className="text-xs text-muted mt-2 mb-0">{ addon.note }</p> }
								</div>

								<div className="shrink-0 pt-1">
									{ busy === addon.slug ? (
										<span className="text-xs text-muted">{ __( 'Working…' ) }</span>
									) : (
										<Toggle
											checked={ !! addon.active }
											disabled={ missing }
											onChange={ ( v ) => toggle( addon, v ) }
											label=""
										/>
									) }
								</div>
							</div>
						);
					} ) }
				</div>
			</Card>
		</div>
	);
}
