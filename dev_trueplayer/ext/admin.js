/**
 * Admin extension seam — defaults. See ./README.md. Pro's menus appear here as
 * teasers only (copy and an upgrade link); TruePlayer Pro replaces this module.
 */
import { __ } from '@Utils/translation';
import { teaserOf } from '@Admin/components/ProTeaser';

/** Named render slots: <ExtSlot name="settings.sources" … /> renders nothing here. */
export function ExtSlot() {
	return null;
}

/** Extra Settings sections: [ { key, group, label, icon, Component } ]. */
export const settingsTabs = [
	{ key: 'enforcement', group: 'data', label: __( 'Enforcement' ), icon: 'shield', pro: true, Component: teaserOf( 'enforcement' ) },
	{ key: 'compliance', group: 'data', label: __( 'Compliance & privacy' ), icon: 'lock', pro: true, Component: teaserOf( 'compliance' ) },
	{ key: 'analytics', group: 'data', label: __( 'Analytics' ), icon: 'analytics', pro: true, Component: teaserOf( 'analytics-settings' ) },
	{ key: 'webhooks', group: 'connect', label: __( 'Global webhooks' ), icon: 'webhook', pro: true, Component: teaserOf( 'webhooks' ) },
	{ key: 'logs', group: 'connect', label: __( 'Webhook logs' ), icon: 'clock', pro: true, Component: teaserOf( 'logs' ) },
];

/** Extra admin screens under the media page: [ { name, label, Component } ]. */
export const extRoutes = [
	{ name: 'analytics', label: __( 'Analytics' ), Component: teaserOf( 'analytics' ) },
];

/** Extra library kinds (see Library.jsx / CreateModal.jsx for the shape). */
export const libraryKinds = [];

/** Extra row menu items for a library row. */
export function rowActions( row, { navigate } ) {
	return 'media' === row.kind
		? [ { label: __( 'Analytics' ), icon: 'analytics', onClick: () => navigate && navigate( 'analytics', { id: row.id } ) } ]
		: [];
}

/** Extra badges for a media row in the library. */
export function rowBadges() {
	return null;
}

/** Extra player templates: { video: [], audio: [] }. */
export const extTemplates = {};

/** Extra video-editor steps: [ { key, label, icon, subs, Component } ]. */
const GatingTeaser = teaserOf( 'gating' );
const ProtectionTeaser = teaserOf( 'protection' );

export const editorTabs = [
	{
		key: 'access',
		label: __( 'Access & gating' ),
		icon: 'shield',
		pro: true,
		subs: [ [ 'gating', __( 'Verification & quiz' ) ], [ 'protection', __( 'Protection' ) ] ],
		Component: ( { sub = 'gating' } ) => ( 'protection' === sub ? <ProtectionTeaser /> : <GatingTeaser /> ),
	},
];

/** Extra sub-sections for existing editor steps: { interactions: [ { key, label, Component } ] }. */
export const editorSubs = {
	interactions: [ { key: 'timed', label: __( 'Timed content' ), pro: true, Component: teaserOf( 'timed' ) } ],
};

/** Extra choices for the player options: { skins, audioSkins, seekBars }. */
export const extOptions = {};

/** Whether a seek-bar style locks the timeline by itself. */
export function seekBarLocks() {
	return false;
}

/** Extra layer types for the layer editor: { [type]: { label, hint, create, Fields, unpositioned } }. */
export const layerEditors = {};

/** Where an email form can send contacts. */
export function loadProviders() {
	return Promise.resolve( [
		{ id: 'wp_mail', name: __( 'Email notification' ), available: true, lists: [] },
	] );
}

/** True when an extension build is running. */
export const extended = false;
