import { Card, Button, Badge } from './UI';

/**
 * Shown in place of a pro-only screen/tab when no license is active.
 */
export default function UpsellPanel( { title, features = [] } ) {
	const purchase = ( window.TruePlayerGlobal && window.TruePlayerGlobal.purchase_url ) || 'https://kodezen.com/trueplayer';
	return (
		<Card className="p-8 max-w-xl mx-auto text-center">
			<Badge tone="brand">TruePlayer Pro</Badge>
			<h3 className="text-lg font-semibold text-ink mt-3 mb-1">{ title }</h3>
			<p className="text-sm text-gray-500 mb-4">This is a Pro feature. Unlock the intelligence layer of TruePlayer.</p>
			{ features.length > 0 && (
				<ul className="text-sm text-gray-600 text-left inline-block mb-5 space-y-1">
					{ features.map( ( f ) => (
						<li key={ f } className="flex items-center gap-2"><span className="text-brand-500">✓</span> { f }</li>
					) ) }
				</ul>
			) }
			<div className="flex gap-2 justify-center">
				<a href={ purchase } target="_blank" rel="noreferrer">
					<Button>Upgrade to Pro</Button>
				</a>
			</div>
		</Card>
	);
}
