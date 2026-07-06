import { createRoot } from 'react-dom/client';
import App from '@Admin/App';
import './admin/style.css';

document.addEventListener( 'DOMContentLoaded', () => {
	const el = document.getElementById( 'trueplayer-app' );
	if ( el ) {
		createRoot( el ).render( <App /> );
	}
} );
