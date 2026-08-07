// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js ships an `exports` map; Metro must honor it to resolve
// the correct build (otherwise it hits a broken CJS path → "tracingRegistry.cjs").
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
