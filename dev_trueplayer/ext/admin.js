/**
 * Admin extension seam — inert defaults. See ./README.md.
 */
import { __ } from '@Utils/translation';

/** Named render slots: <ExtSlot name="settings.sources" … /> renders nothing here. */
export function ExtSlot() {
	return null;
}

/** Extra Settings sections: [ { key, group, label, icon, Component } ]. */
export const settingsTabs = [];

/** Extra admin screens under the media page: [ { name, label, Component } ]. */
export const extRoutes = [];

/** Extra library kinds (see Library.jsx / CreateModal.jsx for the shape). */
export const libraryKinds = [];

/** Extra row menu items for a library row. */
export function rowActions() {
	return [];
}

/** Extra badges for a media row in the library. */
export function rowBadges() {
	return null;
}

/** Extra player templates: { video: [], audio: [] }. */
export const extTemplates = {};

/** Extra video-editor steps: [ { key, label, icon, subs, Component } ]. */
export const editorTabs = [];

/** Extra sub-sections for existing editor steps: { interactions: [ { key, label, Component } ] }. */
export const editorSubs = {};

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
