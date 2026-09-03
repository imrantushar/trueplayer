import {
    __ as wp__,
    _x as wp_x,
    _n as wp_n,
    _nx as wp_nx,
    sprintf as wpSprintf,
} from '@wordpress/i18n';

const TEXT_DOMAIN = 'trueplayer';

/**
 * Basic translation.
 */
export const __ = (text) => (
    wp__(text, TEXT_DOMAIN)
);

/**
 * Translation with context.
 */
export const _x = (text, context) => (
    wp_x(text, context, TEXT_DOMAIN)
);

/**
 * Singular / plural translation.
 */
export const _n = (single, plural, number) => (
    wp_n(single, plural, number, TEXT_DOMAIN)
);

/**
 * Singular / plural translation with context.
 */
export const _nx = (
    single,
    plural,
    number,
    context
) => (
    wp_nx(
        single,
        plural,
        number,
        context,
        TEXT_DOMAIN
    )
);

/**
 * sprintf formatting only.
 *
 * Use when the string has already been translated.
 */
export const sprintf = (format, ...args) => (
    wpSprintf(format, ...args)
);

/**
 * Translate + sprintf in one call.
 *
 * @example
 * __sprintf('Hello %s', name)
 */
export const __sprintf = (text, ...args) => (
    wpSprintf(
        wp__(text, TEXT_DOMAIN),
        ...args
    )
);

/**
 * Context translation + sprintf.
 *
 * @example
 * _xSprintf('Hello %s', 'welcome message', name)
 */
export const _xSprintf = (
    text,
    context,
    ...args
) => (
    wpSprintf(
        wp_x(text, context, TEXT_DOMAIN),
        ...args
    )
);

/**
 * Plural translation + sprintf.
 *
 * Automatically passes number to sprintf.
 *
 * @example
 * _nSprintf('%d video', '%d videos', count)
 */
export const _nSprintf = (
    single,
    plural,
    number,
    ...args
) => (
    wpSprintf(
        wp_n(
            single,
            plural,
            number,
            TEXT_DOMAIN
        ),
        number,
        ...args
    )
);

/**
 * Contextual plural translation + sprintf.
 *
 * @example
 * _nxSprintf(
 *     '%d video',
 *     '%d videos',
 *     count,
 *     'playlist video count'
 * )
 */
export const _nxSprintf = (
    single,
    plural,
    number,
    context,
    ...args
) => (
    wpSprintf(
        wp_nx(
            single,
            plural,
            number,
            context,
            TEXT_DOMAIN
        ),
        number,
        ...args
    )
);