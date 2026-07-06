import { useEffect, useState } from '@wordpress/element';
import { api } from '../api';
import { Button, Card, Input, Badge } from '../components/UI';

export default function Library( { onEdit, onViewers } ) {
	const [ videos, setVideos ] = useState( null );
	const [ title, setTitle ] = useState( '' );
	const [ creating, setCreating ] = useState( false );

	const load = () => api.listVideos().then( setVideos );
	useEffect( () => { load(); }, [] );

	const create = async () => {
		setCreating( true );
		try {
			const v = await api.createVideo( title || 'Untitled video' );
			setTitle( '' );
			await load();
			onEdit( v.id );
		} finally {
			setCreating( false );
		}
	};

	const remove = async ( id ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( 'Delete this video?' ) ) {
			return;
		}
		await api.deleteVideo( id );
		load();
	};

	const copy = ( sc ) => navigator.clipboard && navigator.clipboard.writeText( sc );

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Videos</h1>
					<p className="text-sm text-gray-500">Watch-verified, quiz-gated players.</p>
				</div>
			</div>

			<Card className="p-4 mb-6 flex gap-3 items-center">
				<Input placeholder="New video title…" value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ ( e ) => e.key === 'Enter' && create() } />
				<Button onClick={ create } disabled={ creating }>{ creating ? 'Creating…' : '+ New video' }</Button>
			</Card>

			{ videos === null && <p className="text-gray-400">Loading…</p> }
			{ videos && videos.length === 0 && <p className="text-gray-400">No videos yet — create your first one above.</p> }

			<div className="space-y-3">
				{ ( videos || [] ).map( ( v ) => {
					const g = v.config?.gating || {};
					const hasQuiz = ( g.checkpoints?.length || 0 ) > 0 || !! g.finalQuiz;
					return (
						<Card key={ v.id } className="p-4 flex items-center gap-4">
							<div className="flex-1 min-w-0">
								<div className="font-semibold text-gray-900 truncate">{ v.title }</div>
								<div className="flex items-center gap-2 mt-1">
									<Badge tone={ v.config?.source?.type ? 'green' : 'gray' }>{ v.config?.source?.type || 'no source' }</Badge>
									{ hasQuiz && <Badge tone="amber">quiz-gated</Badge> }
									<code className="text-xs text-gray-500 cursor-pointer" onClick={ () => copy( v.shortcode ) } title="Copy shortcode">{ v.shortcode }</code>
								</div>
							</div>
							<Button variant="ghost" onClick={ () => onViewers( v.id ) }>Analytics</Button>
							<Button variant="ghost" onClick={ () => onEdit( v.id ) }>Edit</Button>
							<Button variant="danger" onClick={ () => remove( v.id ) }>Delete</Button>
						</Card>
					);
				} ) }
			</div>
		</div>
	);
}
