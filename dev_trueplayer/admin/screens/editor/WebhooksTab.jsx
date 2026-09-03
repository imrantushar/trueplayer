import { EndpointList } from '../../components/EndpointList';
import { Card } from '../../components/UI';
import { __ } from '@Utils/translation';

export default function WebhooksTab( { config, patch } ) {
	const webhooks = config.webhooks || [];
	return (
		<Card className="p-6">
			<h3 className="font-semibold text-gray-900 mb-1">{ __( 'Per-video webhooks' ) }</h3>
			<p className="text-sm text-gray-500 mb-4">
				{ __( "Fire signed JSON payloads to external URLs when this video's events happen — for Zapier, automation, or your own endpoint. Global webhooks (all videos) live under Settings." ) }
			</p>
			<EndpointList endpoints={ webhooks } onChange={ ( next ) => patch( { webhooks: next } ) } />
		</Card>
	);
}
