const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  tslib: path.resolve(__dirname, "tslib-shim.js"),
};
config.resolver.assetExts = [...new Set([...(config.resolver.assetExts || []), "blob"])];
config.transformer = config.transformer || {};
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
  },
});
config.maxWorkers = 4;
config.stickyWorkers = false;

module.exports = config;
