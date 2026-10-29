/**
 * The block's own control kit: the accordion sections, segmented buttons, radio
 * cards, switches, pills and swatches the block design is built from.
 *
 * Plain elements plus one scoped stylesheet rather than @wordpress/components,
 * because the design's controls have no equivalent there. The stylesheet is a
 * string rendered next to the markup (see `Styles`) instead of an imported
 * .css file: importing CSS into the block entry would make webpack merge the
 * CSS entries and stop emitting one of them (see Block::canvas_assets).
 */
import { useState } from '@wordpress/element';
import { __ } from '@Utils/translation';

const INK = '#1e1e1e';

const CSS = `
.tpb{font-family:inherit;color:#141A24}
.tpb *{box-sizing:border-box}
.tpb{max-width:100%;overflow-x:clip}
.tpb.tpb-modal{overflow:visible}
.components-modal__frame.tpb-frame{margin:auto!important;top:auto!important;left:auto!important;transform:none!important;position:relative}
.components-modal__screen-overlay:has(.tpb-frame){display:flex;align-items:center;justify-content:center}
.block-editor-block-inspector .block-editor-block-card{padding:16px;margin:0;gap:12px;align-items:flex-start;border-bottom:1px solid #E0E4E8}
.block-editor-block-inspector .block-editor-block-card .block-editor-block-icon{width:36px;height:36px;flex:none;background:#F0F0F0;border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0}
.block-editor-block-inspector .block-editor-block-card .block-editor-block-icon svg,.block-editor-block-inspector .block-editor-block-card .block-editor-block-icon img{width:22px;height:22px}
.block-editor-block-inspector .block-editor-block-card__title{font-size:14px;font-weight:600;line-height:1.3;margin:0}
.block-editor-block-inspector .block-editor-block-card__description{font-size:12px;color:#646C73;line-height:1.45;margin-top:2px;display:block}
.components-tools-panel:has(.tpb-lead){display:block;padding:0;gap:0;border-top:0}
.components-tools-panel:has(.tpb-lead)>.components-tools-panel-header,.components-tools-panel:has(.tpb-lead)>h2{display:none}
.color-block-support-panel__inner-wrapper:has(.tpb-lead){display:block!important;grid-template-columns:none!important;grid-column:1/-1}
.tpb-sec{border-bottom:1px solid #E0E4E8}
.tpb-sec__head{width:100%;height:48px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;background:none;border:0;cursor:pointer;font-family:inherit;font-weight:600;font-size:13px;line-height:1;color:#141A24;text-align:left}
.tpb-sec__head:hover{background:#F6F7F8}
.tpb-sec__head:focus-visible,.tpb-btn:focus-visible,.tpb-seg__b:focus-visible,.tpb-card:focus-visible,.tpb-pill:focus-visible,.tpb-sw:focus-visible,.tpb-row:focus-visible{outline:2px solid ${ INK };outline-offset:-2px}
.tpb-sec__chev{transition:transform .15s}
.tpb-sec__body{padding:0 16px 16px}
.tpb-badge{height:20px;padding:0 8px;border-radius:999px;background:#E0E0E0;color:${ INK };font-size:11px;font-weight:600;display:inline-flex;align-items:center}
.tpb-label{font-size:13px;font-weight:500;color:#344054;margin:0 0 6px;display:block}
.tpb-label--gap{margin-top:16px}
.tpb-help{font-size:11px;color:#646C73;margin-top:4px;line-height:1.4}
.tpb-input{width:100%;height:36px;border:1px solid #d0d5dd;border-radius:4px;padding:0 10px;font-size:13px;outline:none;background:#fff;color:#141A24;box-shadow:none;min-height:0}
.tpb-input--lg{height:40px;padding:0 12px}
.tpb-input:focus{border-color:${ INK };box-shadow:none}
.tpb-input--err{border-color:#FCA5A5}
textarea.tpb-input{height:auto;padding:8px 10px;line-height:1.5;resize:vertical}
.tpb-mono{font-family:"Roboto Mono",ui-monospace,monospace;font-size:12px;line-height:1.6}
.tpb-btn{min-width:0;min-height:32px;padding:6px 10px;text-align:center;border:1px solid #E0E4E8;background:#fff;border-radius:6px;font-family:inherit;font-weight:500;font-size:13px;line-height:1;cursor:pointer;color:#141A24;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:normal}
.tpb-btn:hover{background:#F6F7F8}
.tpb-btn--lg{min-height:40px;padding:6px 16px}
.tpb-btn--primary{background:${ INK };border-color:${ INK };color:#fff}
.tpb-btn--primary:hover{background:#000}
.tpb-btn--primary:disabled{opacity:.5;cursor:default}
.tpb-btn--danger{border:0;background:none;color:#991B1B;padding:6px}
.tpb-btn--danger:hover{background:none;text-decoration:underline}
.tpb-btn--dashed{width:100%;height:64px;border:1px dashed #d0d5dd;background:#F9FAFB}
.tpb-btn--dashed:hover{background:#F0F0F0}
.tpb-seg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));background:#F6F7F8;border-radius:6px;padding:2px;gap:2px}
.tpb-seg__b{height:30px;padding:0 6px;border:0;background:transparent;border-radius:5px;font-family:inherit;font-weight:500;font-size:12px;line-height:1;cursor:pointer;color:#646C73;white-space:nowrap}
.tpb-seg__b[aria-checked=true]{background:#fff;color:#141A24;box-shadow:0 0 1px rgba(20,26,36,.2),0 1px 2px rgba(20,26,36,.1)}
.tpb-row{width:100%;display:flex;align-items:center;gap:12px;padding:10px 0;border:0;border-top:1px solid #F6F7F8;background:none;cursor:pointer;text-align:left;color:#141A24;font:inherit}
.tpb-row__t{font-size:13px;font-weight:500}
.tpb-row__h{font-size:11px;color:#646C73;margin-top:2px;line-height:1.35;font-weight:400}
.tpb-sw-track{width:38px;height:22px;border-radius:999px;background:#CBD1D7;position:relative;flex:none;transition:background .15s}
.tpb-sw-track::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:left .15s}
.tpb-row[aria-checked=true] .tpb-sw-track{background:${ INK }}
.tpb-row[aria-checked=true] .tpb-sw-track::after{left:19px}
.tpb-card{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #E0E4E8;background:#fff;border-radius:8px;cursor:pointer;width:100%;text-align:left;font:inherit;color:#141A24}
.tpb-card[aria-checked=true]{border-color:${ INK };background:#F0F0F0}
.tpb-cards--dense{display:grid!important;grid-template-columns:1fr 1fr;gap:6px!important}
.tpb-cards--dense .tpb-card{padding:6px 10px;gap:8px}
@media (max-height:720px){.tpb-modal .tpb-modal__cap{display:none}.tpb-modal .tpb-label--gap{margin-top:10px}.tpb-modal .tpb-modal__foot{margin-top:12px!important;padding:10px 0!important}.tpb-modal .tpb-cards--dense{gap:4px!important}}
@media (max-height:600px){.tpb-modal .tpb-cards--dense .tpb-card{padding:3px 10px}.tpb-modal .tpb-modal__foot{margin-top:8px!important;padding:8px 0!important}.tpb-modal .tpb-label--gap{margin-top:6px}}
@media (max-height:560px){.tpb-modal .tpb-card span span+span{display:none!important}.tpb-modal .tpb-cards--dense .tpb-card{padding:7px 10px}}

.tpb-radio{width:18px;height:18px;border-radius:50%;border:1.5px solid #8E949A;background:#fff;flex:none;display:flex;align-items:center;justify-content:center}
.tpb-card[aria-checked=true] .tpb-radio{border-color:${ INK };background:${ INK }}
.tpb-skin{border:1px solid #E0E4E8;background:#fff;border-radius:8px;padding:8px;cursor:pointer;text-align:left;font:inherit;color:#141A24}
.tpb-skin[aria-checked=true]{border-color:${ INK };background:#F0F0F0}
.tpb-pill{height:30px;padding:0 10px;display:inline-flex;align-items:center;border-radius:999px;font-family:inherit;font-weight:500;font-size:12px;line-height:1;cursor:pointer;border:1px solid #E0E4E8;background:#fff;color:#141A24}
.tpb-pill[aria-checked=true]{border-color:${ INK };background:#F0F0F0;color:${ INK }}
.tpb-sw{width:28px;height:28px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;border:0;padding:0;box-shadow:inset 0 0 0 1px rgba(20,26,36,.12)}
.tpb-sw[aria-checked=true]{box-shadow:0 0 0 2px #fff,0 0 0 4px ${ INK }}
.tpb-sw--custom{border:1px dashed #738496;background:none;color:#434A51;position:relative;overflow:hidden}
.tpb-sw--custom input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.tpb-media{display:flex;gap:12px;padding:10px;border:1px solid #E0E4E8;border-radius:8px;align-items:center}
.tpb-thumb{background:repeating-linear-gradient(135deg,#1B2330 0 6px,#202A3A 6px 12px);border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center}
.tpb-empty{border:1px solid #141A24;border-radius:4px;padding:36px 32px 32px;background:#fff;position:relative}
.tpb-bar{height:6px;border-radius:999px;background:#E0E4E8;overflow:hidden;max-width:360px;position:relative}
.tpb-bar::after{content:"";position:absolute;top:0;bottom:0;width:40%;background:${ INK };border-radius:999px;animation:tpb-slide 1.1s ease-in-out infinite}
@keyframes tpb-slide{0%{left:-40%}100%{left:100%}}
.tpb-err{margin-top:6px;font-size:12px;color:#991B1B}
.tpb-saved{display:flex;gap:12px;align-items:center;padding:10px;border-radius:8px;cursor:pointer;border:1px solid transparent;width:100%;background:none;text-align:left;font:inherit;color:#141A24}
.tpb-saved:hover{background:#F6F7F8}
.tpb-saved[aria-checked=true]{border-color:${ INK }}
.tpb-tag{font-size:11px;font-weight:600;color:${ INK };background:#E0E0E0;border-radius:999px;padding:3px 8px}
@media (prefers-reduced-motion:reduce){.tpb-bar::after,.tpb-sw-track,.tpb-sw-track::after,.tpb-sec__chev{animation:none;transition:none}}
`;

/** Render once per document that shows block chrome (canvas iframe and sidebar are separate). */
export const Styles = () => <style>{ CSS }</style>;

export const Check = ( { size = 16, color = '#fff' } ) => (
	<svg width={ size } height={ size } viewBox="0 0 24 24" fill={ color } aria-hidden="true">
		<path d="M16.7 7.1l-6.3 8.5-3.3-2.5-.9 1.2 4.5 3.4L17.9 8z" />
	</svg>
);

const Chevron = ( { open } ) => (
	<svg
		className="tpb-sec__chev"
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="currentColor"
		style={ { transform: open ? 'rotate(180deg)' : 'none' } }
		aria-hidden="true"
	>
		<path d="M7.4 8.6L12 13.2l4.6-4.6L18 10l-6 6-6-6z" />
	</svg>
);

/** One collapsible sidebar section. */
export function Section( { title, badge, initialOpen = false, children } ) {
	const [ open, setOpen ] = useState( initialOpen );
	return (
		<div className="tpb tpb-sec">
			<button type="button" className="tpb-sec__head" aria-expanded={ open } onClick={ () => setOpen( ( o ) => ! o ) }>
				<span>{ title }</span>
				<span style={ { display: 'flex', alignItems: 'center', gap: 8 } }>
					{ !! badge && <span className="tpb-badge">{ badge }</span> }
					<Chevron open={ open } />
				</span>
			</button>
			{ open && <div className="tpb-sec__body">{ children }</div> }
		</div>
	);
}

export const Label = ( { children, gap, className = '' } ) => <span className={ `tpb-label${ gap ? ' tpb-label--gap' : '' } ${ className }` }>{ children }</span>;
export const Help = ( { children } ) => <div className="tpb-help">{ children }</div>;

/** Segmented control: options are [ value, label ]. */
export function Segmented( { value, options, onChange, label } ) {
	return (
		<div className="tpb-seg" role="radiogroup" aria-label={ label }>
			{ options.map( ( [ v, l ] ) => (
				<button key={ v } type="button" role="radio" aria-checked={ value === v } className="tpb-seg__b" onClick={ () => onChange( v ) }>
					{ l }
				</button>
			) ) }
		</div>
	);
}

/** A labelled on/off row. */
export function Toggle( { label, hint, checked, onChange } ) {
	return (
		<button type="button" role="switch" aria-checked={ !! checked } className="tpb-row" onClick={ () => onChange( ! checked ) }>
			<span style={ { flex: 1, minWidth: 0 } }>
				<span className="tpb-row__t" style={ { display: 'block' } }>{ label }</span>
				{ !! hint && <span className="tpb-row__h" style={ { display: 'block' } }>{ hint }</span> }
			</span>
			<span className="tpb-sw-track" />
		</button>
	);
}

/** A radio list drawn as cards: options are { value, label, hint? }. */
export function RadioCards( { value, options, onChange, label, gap = 6, dense } ) {
	return (
		<div className={ dense ? 'tpb-cards--dense' : undefined } role="radiogroup" aria-label={ label } style={ { display: 'flex', flexDirection: 'column', gap } }>
			{ options.map( ( o ) => (
				<button key={ o.value } type="button" role="radio" aria-checked={ value === o.value } className="tpb-card" onClick={ () => onChange( o.value ) }>
					<span className="tpb-radio">{ value === o.value && <Check size={ 12 } /> }</span>
					<span>
						<span style={ { display: 'block', fontSize: 13, fontWeight: 500 } }>{ o.label }</span>
						{ !! o.hint && <span style={ { display: 'block', fontSize: 12, color: '#646C73' } }>{ o.hint }</span> }
					</span>
				</button>
			) ) }
		</div>
	);
}

/** Aspect-ratio style rounded pills: options are [ value, label ]. */
export function Pills( { value, options, onChange, label } ) {
	return (
		<div role="radiogroup" aria-label={ label } style={ { display: 'flex', flexWrap: 'wrap', gap: 6 } }>
			{ options.map( ( [ v, l ] ) => (
				<button key={ v } type="button" role="radio" aria-checked={ value === v } className="tpb-pill" onClick={ () => onChange( v ) }>
					{ l }
				</button>
			) ) }
		</div>
	);
}

/**
 * A "site default" swatch, a row of preset colours and a custom picker.
 * `presets` are [ name, colour ]; an empty `value` means the site default.
 */
export function ColorSwatches( { value, presets, onChange, label, fallback } ) {
	const known = presets.find( ( p ) => p[ 1 ] === value );
	return (
		<>
			<div role="radiogroup" aria-label={ label } style={ { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' } }>
				<button
					type="button"
					role="radio"
					aria-checked={ ! value }
					aria-label={ __( 'Site default' ) }
					title={ __( 'Site default' ) }
					className="tpb-sw"
					style={ { background: 'repeating-linear-gradient(135deg,#E0E4E8 0 4px,#fff 4px 8px)' } }
					onClick={ () => onChange( '' ) }
				>
					{ ! value && <Check color="#141A24" /> }
				</button>
				{ presets.map( ( [ name, color ] ) => (
					<button
						key={ color }
						type="button"
						role="radio"
						aria-checked={ value === color }
						aria-label={ name }
						title={ name }
						className="tpb-sw"
						style={ { background: color } }
						onClick={ () => onChange( color ) }
					>
						{ value === color && <Check color={ color === '#ffffff' ? '#141A24' : '#fff' } /> }
					</button>
				) ) }
				<label className="tpb-sw tpb-sw--custom" title={ __( 'Custom colour' ) }>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
					</svg>
					<input type="color" aria-label={ __( 'Custom colour' ) } value={ /^#[0-9a-f]{6}$/i.test( value ) ? value : fallback } onChange={ ( e ) => onChange( e.target.value ) } />
				</label>
			</div>
			<div className="tpb-help">{ value ? `${ known ? known[ 0 ] : __( 'Custom' ) } · ${ value }` : __( 'Site default' ) }</div>
		</>
	);
}
