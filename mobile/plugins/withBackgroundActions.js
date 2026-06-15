const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withBackgroundActions(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
    
    // Remove existing if it matches to avoid duplicate/conflict
    mainApplication.service = mainApplication.service.filter(
      (s) => !(s.$ && s.$['android:name'] === serviceName)
    );

    // Add the correct service configuration
    mainApplication.service.push({
      $: {
        'android:name': serviceName,
        'android:foregroundServiceType': 'dataSync',
        'tools:replace': 'android:foregroundServiceType',
      },
    });

    const manifest = config.modResults.manifest;
    if (!manifest.$) {
      manifest.$ = {};
    }
    // Ensure manifest attributes for tools namespace is present
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });
};
