# Extension seam (`@Ext`)

Every module here is a default. Apart from `admin.js`, which lists Pro's menus as
teasers (copy and an upgrade link, no controls or saved state), they render
nothing and change no behaviour. The core plugin is complete without them.

A separate add-on can compile this plugin's sources with `@Ext` aliased to its
own directory of modules exporting the same names, and ship that bundle
instead (see `trueplayer/assets/build` in includes/assets.php).
