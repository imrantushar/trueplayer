import { templatesFor } from '../data/preset-templates';
import { __ } from '@Utils/translation';

/**
 * What Settings → General → "Default player look" currently says, for one media
 * type.
 *
 * Two screens need to state this rather than only apply it: Settings, where it
 * is being chosen, and the create dialog, where an author is about to make an
 * item that will inherit it. Before this the answer was invisible at creation
 * time — the first sight of the site's own default was the finished player.
 *
 * Reads `TruePlayerGlobal` rather than taking settings as an argument, because
 * the create dialog has no settings of its own to pass and fetching them just
 * to print one sentence is not worth a round trip. Settings.jsx keeps that
 * global in step after every save (syncGlobalDefaults).
 *
 * @param {string} type 'video' | 'audio'.
 * @return {{preset: boolean, key: string, label: string}} `preset` true when a
 *         saved preset is in control, in which case `label` says so instead of
 *         naming a template — the id alone cannot be turned into a name here.
 */
export function defaultLook( type = 'video' ) {
	const general = ( typeof window !== 'undefined'
		&& window.TruePlayerGlobal
		&& window.TruePlayerGlobal.settings
		&& window.TruePlayerGlobal.settings.general ) || {};
	const isAudio = 'audio' === type;

	if ( parseInt( isAudio ? general.defaultAudioPreset : general.defaultPreset, 10 ) ) {
		return { preset: true, key: '', label: __( 'your saved default preset' ) };
	}

	// The fallbacks match Settings.jsx's own: an install that has never opened
	// that card still renders something, and it is these.
	const key = ( isAudio ? general.defaultAudioTemplate : general.defaultTemplate )
		|| ( isAudio ? 'podcast' : 'default' );
	const template = templatesFor( type ).find( ( t ) => t.key === key );
	return { preset: false, key, label: template ? template.label : key };
}
