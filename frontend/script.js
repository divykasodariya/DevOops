const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'screens');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const f of files) {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let original = content;

  content = content.replace(/paddingTop:\s*Platform\.OS\s*===\s*['"](ios|android)['"]\s*\?\s*[^:,]+:\s*[^,}]+,?/g, 'paddingTop: 10,');
  
  if (f === 'AdminDashboard.js') {
    content = content.replace(/paddingTop:\s*18,?/, 'paddingTop: 0,');
    content = content.replace(/paddingTop:\s*6,?/, 'paddingTop: 10,');
  }

  // BookSpaceScreen.js also had some padding issues, let's just make sure all Platform.OS paddings are 10.
  // Wait, MakeRequestScreen had `paddingTop: 12,` later. That's fine.

  if (content !== original) {
    fs.writeFileSync(p, content);
    console.log('Fixed padding in', f);
  }
}
