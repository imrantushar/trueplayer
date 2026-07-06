import { Card, Field, Input, Button } from '../../components/UI';
import { pickMedia } from '../../utils/media';

export default function AppearanceTab( { config, patch } ) {
	const branding = config.branding || {};
	const chapters = config.chapters || [];

	const setBranding = ( partial ) => patch( { branding: { ...branding, ...partial } } );

	const setChapter = ( i, partial ) => {
		const next = chapters.map( ( c, idx ) => ( idx === i ? { ...c, ...partial } : c ) );
		patch( { chapters: next } );
	};
	const addChapter = () => patch( { chapters: [ ...chapters, { at: 0, label: '' } ] } );
	const removeChapter = ( i ) => patch( { chapters: chapters.filter( ( _, idx ) => idx !== i ) } );

	return (
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
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-gray-900">Chapters</h3>
					<Button variant="ghost" onClick={ addChapter }>+ Add</Button>
				</div>
				{ chapters.length === 0 && <p className="text-sm text-gray-400">No chapters. Markers appear on the scrubber.</p> }
				<div className="space-y-2">
					{ chapters.map( ( c, i ) => (
						<div key={ i } className="flex gap-2 items-center">
							<Input type="number" className="w-24" value={ c.at } onChange={ ( e ) => setChapter( i, { at: parseInt( e.target.value, 10 ) || 0 } ) } placeholder="sec" />
							<Input value={ c.label } onChange={ ( e ) => setChapter( i, { label: e.target.value } ) } placeholder="Chapter title" />
							<Button variant="danger" onClick={ () => removeChapter( i ) }>×</Button>
						</div>
					) ) }
				</div>
			</Card>
		</div>
	);
}
