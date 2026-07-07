import { useEffect, useState } from '@wordpress/element';
import { api } from '../api';
import { Button, Card, Input, Badge, Thumb, sourceMeta } from '../components/UI';

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

	const [ copied, setCopied ] = useState( null );
	const copy = ( id, sc ) => {
		if ( navigator.clipboard ) {
			navigator.clipboard.writeText( sc );
			setCopied( id );
			setTimeout( () => setCopied( ( c ) => ( c === id ? null : c ) ), 1500 );
		}
	};

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

			{ videos === null && (
				<div className="space-y-3">
					{ [ 0, 1, 2 ].map( ( i ) => (
						<Card key={ i } className="p-4 flex items-center gap-4">
							<div className="w-24 aspect-video rounded-lg bg-gray-100 animate-pulse shrink-0" />
							<div className="flex-1 space-y-2">
								<div className="h-4 w-1/3 bg-gray-100 rounded animate-pulse" />
								<div className="h-3 w-1/4 bg-gray-100 rounded animate-pulse" />
							</div>
						</Card>
					) ) }
				</div>
			) }
			{ videos && videos.length === 0 && (
				<Card className="p-12 text-center border-dashed">
					<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center">
						<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
					</div>
					<p className="font-semibold text-gray-900">No videos yet</p>
					<p className="text-sm text-gray-500">Create your first watch-verified player above.</p>
				</Card>
			) }

			<div className="space-y-3">
				{ ( videos || [] ).map( ( v ) => {
					const src = v.config?.source || {};
					const g = v.config?.gating || {};
					const hasQuiz = ( g.checkpoints?.length || 0 ) > 0 || !! g.finalQuiz;
					const chapters = v.config?.chapters?.length || 0;
					const meta = sourceMeta( src );
					return (
						<Card key={ v.id } className="p-3 flex items-center gap-4 hover:border-brand-200 transition-colors">
							<Thumb poster={ src.poster } type={ src.mediaType === 'audio' ? 'audio' : src.type } />
							<div className="flex-1 min-w-0">
								<div className="font-semibold text-gray-900 truncate">{ v.title }</div>
								<div className="flex items-center flex-wrap gap-2 mt-1.5">
									<Badge tone={ meta.tone }>{ meta.label }</Badge>
									{ hasQuiz && <Badge tone="amber">quiz-gated</Badge> }
									{ chapters > 0 && <Badge>{ chapters } chapter{ chapters === 1 ? '' : 's' }</Badge> }
									<code
										className="text-xs text-gray-500 cursor-pointer hover:text-brand-600"
										onClick={ () => copy( v.id, v.shortcode ) }
										title="Copy shortcode"
									>
										{ copied === v.id ? 'Copied ✓' : v.shortcode }
									</code>
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
