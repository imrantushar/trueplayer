import { rest } from '@Utils/rest';

export const api = {
	listVideos: () => rest.get( 'videos' ),
	getVideo: ( id ) => rest.get( `videos/${ id }` ),
	createVideo: ( title ) => rest.post( 'videos', { title, config: {} } ),
	updateVideo: ( id, data ) => rest.put( `videos/${ id }`, data ),
	deleteVideo: ( id ) => rest.del( `videos/${ id }` ),
	getSettings: () => rest.get( 'settings' ),
	saveSettings: ( data ) => rest.post( 'settings', data ),
	listViewers: ( id ) => rest.get( `viewers?video=${ id }` ),
	resetViewer: ( id ) => rest.post( 'viewers/reset', { id } ),
	getAnalytics: ( id ) => rest.get( `analytics?video=${ id }` ),
	getViewerDetail: ( id ) => rest.get( `analytics/viewer?id=${ id }` ),
	testWebhook: ( url, secret ) => rest.post( 'webhooks/test', { url, secret } ),
	getIntegrations: () => rest.get( 'integrations' ),
	listPlaylists: () => rest.get( 'playlists' ),
	getPlaylist: ( id ) => rest.get( `playlists/${ id }` ),
	createPlaylist: ( title ) => rest.post( 'playlists', { title, config: { layout: 'sidebar', videos: [] } } ),
	updatePlaylist: ( id, data ) => rest.put( `playlists/${ id }`, data ),
	deletePlaylist: ( id ) => rest.del( `playlists/${ id }` ),
};

export const EVENT_TYPES = [
	'view.started',
	'progress.milestone',
	'view.completed',
	'checkpoint.passed',
	'checkpoint.failed',
	'quiz.passed',
	'quiz.failed',
	'video.locked',
	'video.unlocked',
];
