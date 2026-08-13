import { useEffect, useState } from '@wordpress/element';
import { Card, Button, Badge, Toast, SectionTitle } from '../components/UI';
import H5pEditor from './H5pEditor';
import { api } from '../api';

/**
 * The "Interactive" section — TruePlayer's H5P engine hub.
 *
 * Lists installed + installable content types (one-click install from the H5P
 * hub) and existing interactive items, and opens the semantics-driven builder
 * (H5pEditor) to create or edit them. H5P items are ordinary tp_video posts, so
 * they embed with the same [trueplayer id="N"] shortcode as native videos.
 */
export default function Interactive() {
	const [ view, setView ] = useState( { name: 'list' } ); // {name:'list'} | {name:'edit', video?, machineName?}
	const [ types, setTypes ] = useState( null );
	const [ items, setItems ] = useState( [] );
	const [ busy, setBusy ] = useState( '' );
	const [ error, setError ] = useState( null );

	const load = async () => {
		try {
			const [ t, i ] = await Promise.all( [ api.h5pContentTypes(), api.h5pItems() ] );
			setTypes( t );
			setItems( i );
		} catch ( e ) {
			setError( e.message || 'Failed to load.' );
		}
	};

	useEffect( () => { load(); }, [] );

	const install = async ( machineName ) => {
		setBusy( machineName );
		setError( null );
		try {
			await api.h5pInstallType( machineName );
			await load();
		} catch ( e ) {
			setError( e.message || 'Install failed.' );
		} finally {
			setBusy( '' );
		}
	};

	if ( view.name === 'edit' ) {
		return (
			<H5pEditor
				video={ view.video || null }
				machineName={ view.machineName || '' }
				onBack={ () => { setView( { name: 'list' } ); load(); } }
			/>
		);
	}

	return (
		<div>
			<SectionTitle title="Interactive content" description="Quizzes, flashcards, and more — built here, rendered by the H5P engine." />

			{ /* Existing items */ }
			{ items.length > 0 && (
				<Card className="p-0 mt-5 overflow-hidden">
					<div className="px-5 py-3 border-b border-line text-sm font-medium text-gray-700">Your interactive items</div>
					<ul className="divide-y divide-line">
						{ items.map( ( it ) => (
							<li key={ it.video } className="flex items-center justify-between px-5 py-3">
								<div>
									<div className="text-sm font-medium text-gray-900">{ it.title }</div>
									<code className="text-xs text-gray-400">{ it.shortcode }</code>
								</div>
								<Button variant="ghost" size="sm" onClick={ () => setView( { name: 'edit', video: it.video } ) }>Edit</Button>
							</li>
						) ) }
					</ul>
				</Card>
			) }

			{ /* Content type gallery */ }
			<h3 className="text-sm font-medium text-gray-700 mt-8 mb-3">Create new</h3>
			{ ! types ? (
				<div className="text-gray-400">Loading content types…</div>
			) : (
				<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{ types.featured.map( ( t ) => (
						<Card key={ t.machineName } className="p-4 flex flex-col justify-between">
							<div className="mb-3">
								<div className="flex items-center gap-2">
									<span className="font-medium text-gray-900">{ t.title }</span>
									{ t.installed && <Badge tone="green">Installed</Badge> }
								</div>
								<div className="text-xs text-gray-400 mt-0.5">{ t.machineName }</div>
							</div>
							{ t.installed ? (
								<Button size="sm" onClick={ () => setView( { name: 'edit', machineName: t.machineName } ) }>Create</Button>
							) : (
								<Button size="sm" variant="ghost" disabled={ busy === t.machineName } onClick={ () => install( t.machineName ) }>
									{ busy === t.machineName ? 'Installing…' : 'Install' }
								</Button>
							) }
						</Card>
					) ) }
				</div>
			) }

			{ error && <Toast message={ error } onDismiss={ () => setError( null ) } /> }
		</div>
	);
}
