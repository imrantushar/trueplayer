import { useEffect, useState } from '@wordpress/element';
import { Card, Field, Input, Button, Textarea } from '../../components/UI';
import { pickMedia } from '../../utils/media';
import { parseChapters, secToClock, clockToSec } from '../../utils/chapters';

/** mm:ss text input that commits a seconds value on blur / Enter. */
function TimeInput( { seconds, onCommit } ) {
	const [ v, setV ] = useState( secToClock( seconds ) );
	useEffect( () => { setV( secToClock( seconds ) ); }, [ seconds ] );
	const commit = () => {
		const s = clockToSec( v );
		if ( s === null ) {
			setV( secToClock( seconds ) ); // revert bad input
		} else {
			onCommit( s );
		}
	};
	return (
		<Input
			className="w-24 text-center tabular-nums"
			value={ v }
			onChange={ ( e ) => setV( e.target.value ) }
			onBlur={ commit }
			onKeyDown={ ( e ) => e.key === 'Enter' && commit() }
			placeholder="0:00"
		/>
	);
}

export default function AppearanceTab( { config, patch } ) {
	const branding = config.branding || {};
	const chapters = config.chapters || [];
	const source = config.source || {};
	const subtitles = source.subtitles || [];
	const captionUrl = subtitles[ 0 ]?.src || '';

	const [ importOpen, setImportOpen ] = useState( false );
	const [ importText, setImportText ] = useState( '' );
	const [ note, setNote ] = useState( '' );
	const [ loadingCaps, setLoadingCaps ] = useState( false );

	const setBranding = ( partial ) => patch( { branding: { ...branding, ...partial } } );

	const setCaptions = ( url ) => {
		const next = url
			? [ { label: subtitles[ 0 ]?.label || 'English', srclang: subtitles[ 0 ]?.srclang || 'en', src: url, default: true } ]
			: [];
		patch( { source: { ...source, subtitles: next } } );
	};

	const sortChapters = ( list ) => list.slice().sort( ( a, b ) => a.at - b.at );
	const setChapter = ( i, partial ) => patch( { chapters: chapters.map( ( c, idx ) => ( idx === i ? { ...c, ...partial } : c ) ) } );
	const addChapter = () => patch( { chapters: [ ...chapters, { at: 0, label: '' } ] } );
	const removeChapter = ( i ) => patch( { chapters: chapters.filter( ( _, idx ) => idx !== i ) } );

	const applyImport = ( parsed, mode ) => {
		if ( ! parsed.length ) {
			setNote( 'No timestamps found. Use lines like "1:30 Chapter title" or paste a WebVTT file.' );
			return;
		}
		const merged = mode === 'replace' ? parsed : sortChapters( [ ...chapters, ...parsed ] );
		patch( { chapters: sortChapters( merged ) } );
		setNote( `Imported ${ parsed.length } chapter${ parsed.length === 1 ? '' : 's' }.` );
		setImportText( '' );
		setImportOpen( false );
	};

	const importPasted = ( mode ) => applyImport( parseChapters( importText ), mode );

	const fromCaptions = async () => {
		if ( ! captionUrl ) {
			return;
		}
		setLoadingCaps( true );
		setNote( '' );
		try {
			const res = await fetch( captionUrl );
			const text = await res.text();
			applyImport( parseChapters( text ), 'replace' );
		} catch ( e ) {
			setNote( "Couldn't read the caption file (it may block cross-origin requests). Paste its contents instead." );
		} finally {
			setLoadingCaps( false );
		}
	};

	return (
		<div className="space-y-6">
			<div className="grid md:grid-cols-2 gap-6">
				<Card className="p-6">
					<h3 className="font-semibold text-gray-900 mb-4">Logo / watermark</h3>
					<Field label="Logo image" hint="Shown top-right during playback. Colors live under Player options.">
						<div className="flex gap-2">
							<Input value={ branding.logo || '' } onChange={ ( e ) => setBranding( { logo: e.target.value } ) } placeholder="https://…/logo.png" />
							<Button variant="ghost" onClick={ () => pickMedia( 'image', ( url ) => setBranding( { logo: url } ) ) }>Media library</Button>
						</div>
					</Field>
					{ branding.logo && (
						<div className="mt-3 p-3 bg-gray-900 rounded-md inline-flex">
							<img src={ branding.logo } alt="" className="max-h-10 max-w-[140px]" />
						</div>
					) }
				</Card>

				<Card className="p-6">
					<h3 className="font-semibold text-gray-900 mb-4">Captions / transcript</h3>
					<Field label="Subtitle file (WebVTT)" hint="Powers the on-screen captions and the in-player transcript panel.">
						<div className="flex gap-2">
							<Input value={ captionUrl } onChange={ ( e ) => setCaptions( e.target.value ) } placeholder="https://…/captions.vtt" />
							<Button variant="ghost" onClick={ () => pickMedia( '', ( url ) => setCaptions( url ) ) }>Media library</Button>
						</div>
					</Field>
					<p className="text-xs text-gray-400">Works with self-hosted, HLS and Bunny videos. YouTube/Vimeo embeds use their own captions.</p>
				</Card>
			</div>

			<Card className="p-6">
				<div className="flex items-center justify-between mb-1">
					<h3 className="font-semibold text-gray-900">Chapters</h3>
					<div className="flex gap-2">
						<Button variant="ghost" onClick={ () => { setImportOpen( ( o ) => ! o ); setNote( '' ); } }>Import</Button>
						<Button variant="ghost" onClick={ addChapter }>+ Add</Button>
					</div>
				</div>
				<p className="text-sm text-gray-400 mb-4">Chapters segment the scrubber and appear in the “In this video” panel. Times are mm:ss.</p>

				{ importOpen && (
					<div className="mb-4 p-4 bg-gray-50 rounded-md border border-line">
						<p className="text-[13px] font-medium text-ink mb-2">Paste timestamps or a WebVTT file</p>
						<Textarea
							rows={ 5 }
							value={ importText }
							onChange={ ( e ) => setImportText( e.target.value ) }
							placeholder={ '0:00 Intro\n1:30 Getting started\n4:05 Wrap up' }
							className="font-mono text-xs"
						/>
						<div className="flex flex-wrap items-center gap-2 mt-3">
							<Button onClick={ () => importPasted( 'replace' ) }>Replace chapters</Button>
							<Button variant="ghost" onClick={ () => importPasted( 'append' ) }>Add to existing</Button>
							{ captionUrl && (
								<Button variant="subtle" onClick={ fromCaptions } disabled={ loadingCaps }>
									{ loadingCaps ? 'Reading…' : 'Generate from caption file' }
								</Button>
							) }
						</div>
					</div>
				) }

				{ note && <p className="text-xs text-brand-600 mb-3">{ note }</p> }

				{ chapters.length === 0 && ! importOpen && <p className="text-sm text-gray-400">No chapters yet — add one or import a list.</p> }

				<div className="space-y-2">
					{ chapters.map( ( c, i ) => (
						<div key={ i } className="flex gap-2 items-center">
							<TimeInput seconds={ c.at } onCommit={ ( s ) => setChapter( i, { at: s } ) } />
							<Input value={ c.label } onChange={ ( e ) => setChapter( i, { label: e.target.value } ) } placeholder="Chapter title" />
							<Button variant="danger" onClick={ () => removeChapter( i ) }>×</Button>
						</div>
					) ) }
				</div>
			</Card>
		</div>
	);
}
