const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'screens');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const f of files) {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  if (content.includes('KeyboardAvoidingView')) {
     content = content.replace(/keyboardVerticalOffset=\{[^}]+\}/g,
       "keyboardVerticalOffset={Platform.OS === 'android' ? 54 : 64}"
     );
     fs.writeFileSync(p, content);
     console.log('Fixed KAV offset in', f);
  }
}
