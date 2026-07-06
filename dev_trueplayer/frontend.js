import './player/style.css';
import { mountPlayers } from '@Player/mount';

/**
 * Frontend runtime entry. Scans the DOM for [data-trueplayer] mount nodes and
 * boots a player per node. The player engine itself (MediaProvider, controls,
 * coverage tracker, gate/quiz layers) is built out in Phases 1–3.
 */
function boot() {
	mountPlayers();
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
