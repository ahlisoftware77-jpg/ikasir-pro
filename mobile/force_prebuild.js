// Force prebuild by patching fs.rmSync to ignore EBUSY errors
const fs = require('fs');
const originalRmSync = fs.rmSync;
const originalRmdirSync = fs.rmdirSync;

fs.rmSync = function(path, options) {
  try {
    return originalRmSync.call(fs, path, options);
  } catch(e) {
    if (e.code === 'EBUSY') {
      console.log('[PATCH] Ignoring EBUSY for:', path);
      return;
    }
    throw e;
  }
};

fs.rmdirSync = function(path, options) {
  try {
    return originalRmdirSync.call(fs, path, options);
  } catch(e) {
    if (e.code === 'EBUSY') {
      console.log('[PATCH] Ignoring EBUSY for:', path);
      return;
    }
    throw e;
  }
};

// Also patch promises version
const originalRm = fs.promises.rm;
const originalRmdir = fs.promises.rmdir;

fs.promises.rm = async function(path, options) {
  try {
    return await originalRm.call(fs.promises, path, options);
  } catch(e) {
    if (e.code === 'EBUSY') {
      console.log('[PATCH] Ignoring EBUSY for:', path);
      return;
    }
    throw e;
  }
};

fs.promises.rmdir = async function(path, options) {
  try {
    return await originalRmdir.call(fs.promises, path, options);
  } catch(e) {
    if (e.code === 'EBUSY') {
      console.log('[PATCH] Ignoring EBUSY for:', path);
      return;
    }
    throw e;
  }
};

// Now run expo prebuild
require('child_process').execSync(
  'npx expo prebuild --platform android --clean',
  { stdio: 'inherit', env: { ...process.env } }
);

// Optimize build size by restricting reactNativeArchitectures to physical devices (exclude x86/x86_64)
const gradlePropsPath = './android/gradle.properties';
if (fs.existsSync(gradlePropsPath)) {
  let content = fs.readFileSync(gradlePropsPath, 'utf8');
  content = content.replace(
    /reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64/g,
    'reactNativeArchitectures=armeabi-v7a,arm64-v8a'
  );
  fs.writeFileSync(gradlePropsPath, content, 'utf8');
  console.log('[PATCH] Limited reactNativeArchitectures to physical devices (armeabi-v7a, arm64-v8a)');
}
