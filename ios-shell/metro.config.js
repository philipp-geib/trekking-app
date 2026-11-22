// Geteilte, reine Rechenmodule (Abbiegehinweise, Geometrie) kommen direkt aus der Web-App: ../app/src/lib
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../app/src/lib')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;
