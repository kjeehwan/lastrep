const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/private/defaults/exclusionList").default;
const path = require("path");

const config = getDefaultConfig(__dirname);
const escapeForRegex = (value) =>
  value
    .split(/[\\/]+/)
    .map((segment) => segment.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&"))
    .join("[/\\\\]");
const ignoredPaths = [
  "data",
  "dist",
  "functions",
  "samsung-health-data-sdk-1.1.0",
  ".expo/web/cache",
  "android",
  ".git",
  "docs",
  "doc",
  ".github",
  ".vscode",
  "native-overrides",
  ".dev-tools",
];

config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  tslib: path.resolve(__dirname, "tslib-shim.js"),
};
// Expo SDK 57 currently coerces `true` to `false`; a truthy non-boolean value
// keeps Watchman enabled until that upstream bug is fixed.
config.resolver.useWatchman = 1;
config.watcher = {
  ...(config.watcher || {}),
  forceNodeFilesystemAPI: true,
  // Avoid hashing every dependency before Metro can accept its first request.
  unstable_lazySha1: true,
};
config.resolver.assetExts = [...new Set([...(config.resolver.assetExts || []), "blob"])];
config.resolver.blockList = exclusionList(
  [
    ...ignoredPaths.map((relativePath) => {
      const absolutePath = path.resolve(__dirname, relativePath);
      return new RegExp(`^${escapeForRegex(absolutePath)}([/\\\\].*)?$`);
    }),
    /.*\.aab$/,
    /.*\.apk$/,
    // Gradle writes gigabytes of native intermediates inside native modules.
    // Metro never resolves these as JS dependencies.
    new RegExp(
      `${escapeForRegex(path.resolve(__dirname, "node_modules"))}[/\\\\].*[/\\\\]android[/\\\\](?:build|\\.cxx)(?:[/\\\\].*)?$`
    ),
    /.*firebase-debug(\..*)?\.log$/,
    /^.*[\/\\]Trello Boards\.json$/,
  ]
);
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
