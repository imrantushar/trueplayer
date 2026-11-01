/**
 * Conditional-rules evaluator (pro) — client mirror of PHP
 * TruePlayer\Services\Rules. Decides whether a layer applies to the current
 * viewer. Any change to fields/operators must be mirrored in includes/services/rules.php.
 *
 * A rule group: { match: 'all'|'any', rules: [ { field, operator, value, key? }, … ] }
 *
 * context = {
 *   viewer:     { loggedIn, isCrmContact, crmTags:[], crmLists:[] },
 *   url:        URLSearchParams,
 *   layerState: { seen:{id:true}, completed:{id:true}, emailSubmitted:bool },
 * }
 */

function cmpBool( actual, value, operator ) {
	const want = value === 'yes' || value === true || value === '1' || value === 1;
	const eq = actual === want;
	return operator === 'is_not' ? ! eq : eq;
}

function cmpIn( haystack, value, operator ) {
	const list = ( haystack || [] ).map( String );
	const inList = list.includes( String( value ) );
	return operator === 'is_not' ? ! inList : inList;
}

function cmpStr( actual, value, operator ) {
	const a = String( actual ?? '' );
	const v = String( value ?? '' );
	if ( operator === 'is_not' ) {
		return a !== v;
	}
	if ( operator === 'contains' ) {
		return v !== '' && a.indexOf( v ) !== -1;
	}
	return a === v;
}

function evalRule( rule, context ) {
	const { field, operator = 'is', value = '' } = rule || {};
	const viewer = context.viewer || {};
	const state = context.layerState || {};
	switch ( field ) {
		case 'logged_in':
			return cmpBool( !! viewer.loggedIn, value, operator );
		case 'crm_contact':
			return cmpBool( !! viewer.isCrmContact, value, operator );
		case 'crm_tag':
			return cmpIn( viewer.crmTags, value, operator );
		case 'crm_list':
			return cmpIn( viewer.crmLists, value, operator );
		case 'url_param': {
			const params = context.url || new URLSearchParams( '' );
			const actual = params.get ? params.get( rule.key || '' ) : null;
			return cmpStr( actual, value, operator );
		}
		case 'email_submitted':
			return cmpBool( !! state.emailSubmitted, value, operator );
		case 'layer_seen':
			return cmpBool( !! ( state.seen && state.seen[ value ] ), 'yes', operator === 'is_not' ? 'is_not' : 'is' );
		case 'layer_completed':
			return cmpBool( !! ( state.completed && state.completed[ value ] ), 'yes', operator === 'is_not' ? 'is_not' : 'is' );
		default:
			return true;
	}
}

export function passesConditions( group, context ) {
	if ( ! group || ! group.rules || ! group.rules.length ) {
		return true;
	}
	const match = group.match === 'any' ? 'any' : 'all';
	const results = group.rules.map( ( r ) => evalRule( r, context ) );
	return match === 'any' ? results.some( Boolean ) : results.every( Boolean );
}
