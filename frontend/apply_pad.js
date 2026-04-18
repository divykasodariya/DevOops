const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'screens');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

for (const f of files) {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');

  // We want to force a reliable paddingTop on `safe` and `safeArea` and `main` containers.
  // First, let's remove any existing `paddingTop` in these specific style blocks if they are 0 or 10.
  
  // We can just rely on string replacement in the stylesheet.
  // Look for `safe: {` or `safeArea: {`
  content = content.replace(/safe:\s*\{([^}]*)\}/, (match, inner) => {
    // remove existing paddingTop
    let newInner = inner.replace(/paddingTop:[^,]+,?/g, '');
    return `safe: {${newInner}, paddingTop: Platform.OS === 'android' ? 54 : 64 }`;
  });

  content = content.replace(/safeArea:\s*\{([^}]*)\}/, (match, inner) => {
    let newInner = inner.replace(/paddingTop:[^,]+,?/g, '');
    return `safeArea: {${newInner}, paddingTop: Platform.OS === 'android' ? 54 : 64 }`;
  });

  // Make sure Platform is imported. It should be, but let's check.
  if(!content.includes('Platform.')) {
     content = content.replace(/import {/, "import { Platform,");
  }

  // Also replace `<SafeAreaView` with `<View` and `</SafeAreaView>` with `</View>`
  // to ensure react-native-safe-area-context doesn't conflict or zero it out.
  content = content.replace(/<SafeAreaView/g, '<View');
  content = content.replace(/<\/SafeAreaView>/g, '</View>');

  // We don't need to remove the import, it can just be unused.

  fs.writeFileSync(p, content);
  console.log('Applied robust padding to', f);
}
