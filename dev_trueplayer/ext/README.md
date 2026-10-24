# Extension seam (`@Ext`)

Every module here is an inert default: it renders nothing, adds no options and
changes no behaviour. The core plugin is complete without them.

A separate add-on can compile this plugin's sources with `@Ext` aliased to its
own directory of modules exporting the same names, and ship that bundle
instead (see `trueplayer/assets/build` in includes/assets.php).
