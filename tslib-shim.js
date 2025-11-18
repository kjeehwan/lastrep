// Ensure tslib has a default export so bundles that import `tslib.default` work.
const tslib = require("tslib");
module.exports = tslib;
module.exports.default = tslib;
