import { useEffect, useState } from '@wordpress/element';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { api } from '../api';
import { Card, Button, Badge } from '../components/UI';
import UpsellPanel from '../components/UpsellPanel';
import { isPro } from '../pro';
import { BRAND, BRAND_SOFT, noLegend } from '../charts';

const fmtTime = ( s ) => {
	s = Math.floor( s || 0 );
	const m = Math.floor( s / 60 );
	return `${ m }:${ String( s % 60 ).padStart( 2, '0' ) }`;
};
const pctLabels = Array.from( { length: 100 }, ( _, i ) => `${ i }%` );

function Stat( { label, value, sub } ) {
	return (
		<Card className="p-4">
			<div className="text-2xl font-bold text-ink">{ value }</div>
			<div className="text-[13px] text-gray-500">{ label }</div>
			{ sub && <div className="text-xs text-gray-400 mt-0.5">{ sub }</div> }
		</Card>
	);
}

function ChartCard( { title, hint, children, className = '' } ) {
	return (
		<Card className={ `p-5 ${ className }` }>
			<div className="mb-3">
				<h3 className="text-[15px] font-semibold text-ink">{ title }</h3>
				{ hint && <p className="text-xs text-gray-400">{ hint }</p> }
			</div>
			{ children }
		</Card>
	);
}

function ViewerDetail( { rowId, onClose, onReset } ) {
	const [ d, setD ] = useState( null );
	useEffect( () => { api.getViewerDetail( rowId ).then( setD ); }, [ rowId ] );
	if ( ! d ) {
		return null;
	}
	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={ onClose }>
			<div className="bg-white rounded-card shadow-pop max-w-2xl w-full p-6" onClick={ ( e ) => e.stopPropagation() }>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold text-ink">Viewer detail</h3>
					<div className="flex gap-2">
						{ ( d.status === 'locked' || d.status === 'completed' ) && (
							<Button variant="ghost" size="sm" onClick={ () => onReset( rowId ) }>Reset / unlock</Button>
						) }
						<Button variant="ghost" size="sm" onClick={ onClose }>Close</Button>
					</div>
				</div>
				<div className="flex gap-3 mb-4 text-sm">
					<Badge tone="brand">{ Math.round( d.percent ) }% watched</Badge>
					<Badge>{ d.sessions } sessions</Badge>
					<Badge tone={ d.status === 'completed' ? 'green' : d.status === 'locked' ? 'red' : 'gray' }>{ d.status }</Badge>
				</div>
				<p className="text-[13px] font-medium text-ink mb-1">Their replay heatmap</p>
				<div style={ { height: 90 } }>
					<Bar
						data={ { labels: pctLabels, datasets: [ { data: d.heat, backgroundColor: BRAND, barPercentage: 1, categoryPercentage: 1 } ] } }
						options={ { ...noLegend, scales: { x: { display: false }, y: { display: false } }, maintainAspectRatio: false } }
					/>
				</div>
				{ d.attempts.length > 0 && (
					<div className="mt-4">
						<p className="text-[13px] font-medium text-ink mb-2">Quiz attempts</p>
						<div className="space-y-1">
							{ d.attempts.map( ( a, i ) => (
								<div key={ i } className="flex items-center gap-2 text-sm">
									<Badge tone={ a.passed ? 'green' : 'red' }>{ a.passed ? 'pass' : 'fail' }</Badge>
									<span className="text-gray-600">{ a.gate_id }</span>
									<span className="text-gray-400">· { a.score }% · try { a.attempt_no }</span>
								</div>
							) ) }
						</div>
					</div>
				) }
			</div>
		</div>
	);
}

export default function Analytics( { id, onBack } ) {
	const [ tab, setTab ] = useState( 'overview' );
	const [ data, setData ] = useState( null );
	const [ viewers, setViewers ] = useState( null );
	const [ detailId, setDetailId ] = useState( null );

	const pro = isPro();
	useEffect( () => { if ( pro ) { api.getAnalytics( id ).then( setData ); } }, [ id, pro ] );
	useEffect( () => { if ( pro && tab === 'viewers' && ! viewers ) { api.listViewers( id ).then( setViewers ); } }, [ tab, id, viewers, pro ] );

	if ( ! pro ) {
		return (
			<div>
				<div className="flex items-center gap-3 mb-6">
					<Button variant="ghost" onClick={ onBack }>← Back</Button>
					<h1 className="text-2xl font-bold text-ink">Analytics</h1>
				</div>
				<UpsellPanel title="Deep video analytics" features={ [ 'Audience retention curve', 'Replay heatmap — which parts get re-watched', 'Completion funnel & views over time', 'Per-viewer watch drill-down', 'Quiz performance' ] } />
			</div>
		);
	}

	if ( ! data ) {
		return <p className="text-gray-400">Loading analytics…</p>;
	}
	const s = data.summary;

	const retentionData = {
		labels: pctLabels,
		datasets: [ { data: data.retention, borderColor: BRAND, backgroundColor: BRAND_SOFT, fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 } ],
	};
	const replayData = {
		labels: pctLabels,
		datasets: [ { data: data.replay, backgroundColor: BRAND, barPercentage: 1, categoryPercentage: 1 } ],
	};
	const funnelData = {
		labels: data.funnel.map( ( f ) => f.label ),
		datasets: [ { data: data.funnel.map( ( f ) => f.viewers ), backgroundColor: BRAND } ],
	};
	const dailyData = {
		labels: data.daily.map( ( d ) => d.day ),
		datasets: [
			{ label: 'Views', data: data.daily.map( ( d ) => d.views ), borderColor: BRAND, backgroundColor: BRAND_SOFT, fill: true, tension: 0.3, pointRadius: 0 },
		],
	};
	const deviceData = {
		labels: data.devices.map( ( d ) => d.device ),
		datasets: [ { data: data.devices.map( ( d ) => d.n ), backgroundColor: [ '#008dff', '#66bcff', '#99d3ff', '#cce9ff' ] } ],
	};

	const pctAxis = { x: { ticks: { maxTicksLimit: 6, callback: ( v ) => pctLabels[ v ] } }, y: { beginAtZero: true } };

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<Button variant="ghost" onClick={ onBack }>← Back</Button>
				<h1 className="text-2xl font-bold text-ink">Analytics</h1>
			</div>

			<div className="flex gap-1 border-b border-line mb-6">
				{ [ 'overview', 'viewers' ].map( ( t ) => (
					<button key={ t } onClick={ () => setTab( t ) }
						className={ `px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${ tab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800' }` }>
						{ t }
					</button>
				) ) }
			</div>

			{ tab === 'overview' && (
				<div className="space-y-6">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<Stat label="Unique viewers" value={ s.viewers } />
						<Stat label="Total views" value={ s.views } sub={ `${ s.completions } completions` } />
						<Stat label="Completion rate" value={ `${ s.completionRate }%` } />
						<Stat label="Avg watch time" value={ fmtTime( s.avgWatchTime ) } sub={ `${ s.avgCoverage }% avg coverage` } />
					</div>

					<ChartCard title="Audience retention" hint={ data.callouts.biggestDropBucket !== null ? `Biggest drop-off around ${ data.callouts.biggestDropBucket }% of the video` : '% of viewers still watching across the timeline' }>
						<div style={ { height: 240 } }>
							<Line data={ retentionData } options={ { ...noLegend, maintainAspectRatio: false, scales: { ...pctAxis, y: { beginAtZero: true, max: 100, ticks: { callback: ( v ) => v + '%' } } } } } />
						</div>
					</ChartCard>

					<ChartCard title="Replay heatmap" hint={ data.callouts.mostReplayedBucket !== null ? `Most re-watched around ${ data.callouts.mostReplayedBucket }% of the video` : 'How many times each segment was played (repeats included)' }>
						<div style={ { height: 170 } }>
							<Bar data={ replayData } options={ { ...noLegend, maintainAspectRatio: false, scales: pctAxis } } />
						</div>
					</ChartCard>

					<div className="grid md:grid-cols-2 gap-6">
						<ChartCard title="Completion funnel">
							<div style={ { height: 220 } }>
								<Bar data={ funnelData } options={ { ...noLegend, maintainAspectRatio: false } } />
							</div>
						</ChartCard>
						<ChartCard title="Views over time">
							<div style={ { height: 220 } }>
								{ data.daily.length ? (
									<Line data={ dailyData } options={ { ...noLegend, maintainAspectRatio: false } } />
								) : <p className="text-sm text-gray-400 py-10 text-center">No data yet.</p> }
							</div>
						</ChartCard>
					</div>

					<div className="grid md:grid-cols-3 gap-6">
						<ChartCard title="Devices">
							<div style={ { height: 200 } } className="flex items-center justify-center">
								{ data.devices.length ? <Doughnut data={ deviceData } options={ { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } } /> : <p className="text-sm text-gray-400">No data.</p> }
							</div>
						</ChartCard>
						<Card className="p-5">
							<h3 className="text-[15px] font-semibold text-ink mb-3">New vs returning</h3>
							<div className="flex gap-6">
								<div><div className="text-2xl font-bold text-brand-600">{ data.newVsReturning.new }</div><div className="text-xs text-gray-500">New</div></div>
								<div><div className="text-2xl font-bold text-ink">{ data.newVsReturning.returning }</div><div className="text-xs text-gray-500">Returning</div></div>
							</div>
							<div className="mt-4"><div className="text-2xl font-bold text-brand-600">{ s.engagementScore }</div><div className="text-xs text-gray-500">Engagement score / 100</div></div>
						</Card>
						<Card className="p-5">
							<h3 className="text-[15px] font-semibold text-ink mb-3">Quiz performance</h3>
							{ data.quiz.length === 0 && <p className="text-sm text-gray-400">No quiz attempts yet.</p> }
							<div className="space-y-2">
								{ data.quiz.map( ( q ) => (
									<div key={ q.gate } className="text-sm">
										<div className="flex justify-between"><span className="text-gray-600">{ q.gate }</span><Badge tone={ q.passRate >= 50 ? 'green' : 'amber' }>{ q.passRate }% pass</Badge></div>
										<div className="text-xs text-gray-400">{ q.attempts } attempts · avg { q.avgScore }% · { q.avgTries } tries</div>
									</div>
								) ) }
							</div>
						</Card>
					</div>
				</div>
			) }

			{ tab === 'viewers' && (
				<Card className="overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 text-gray-500 text-left">
							<tr>
								<th className="px-4 py-3 font-medium">Viewer</th><th className="px-4 py-3 font-medium">Coverage</th>
								<th className="px-4 py-3 font-medium">Sessions</th><th className="px-4 py-3 font-medium">Status</th>
								<th className="px-4 py-3 font-medium">Device</th><th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{ ( viewers || [] ).map( ( r ) => (
								<tr key={ r.id } className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={ () => setDetailId( r.id ) }>
									<td className="px-4 py-3">{ r.subject } <Badge>{ r.type }</Badge></td>
									<td className="px-4 py-3">{ Math.round( r.percent ) }%</td>
									<td className="px-4 py-3">{ r.sessions }</td>
									<td className="px-4 py-3"><Badge tone={ r.status === 'completed' ? 'green' : r.status === 'locked' ? 'red' : 'gray' }>{ r.status }</Badge></td>
									<td className="px-4 py-3 text-gray-500">{ r.device || '—' }</td>
									<td className="px-4 py-3 text-right text-brand-600">View →</td>
								</tr>
							) ) }
							{ viewers && viewers.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">No viewers yet.</td></tr> }
						</tbody>
					</table>
				</Card>
			) }

			{ detailId && (
				<ViewerDetail
					rowId={ detailId }
					onClose={ () => setDetailId( null ) }
					onReset={ async ( rid ) => {
						await api.resetViewer( rid );
						setDetailId( null );
						setViewers( null ); // refetch on next viewers-tab render
						api.listViewers( id ).then( setViewers );
					} }
				/>
			) }
		</div>
	);
}
