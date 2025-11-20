const fs = require('fs');
const path = require('path');

const emailPath = path.join(__dirname, '../src/server/email.ts');
let content = fs.readFileSync(emailPath, 'utf8');

console.log('Updating email spacing...\n');

let updateCount = 0;

// Pattern 1: Add margin-bottom to logo images (already updated, but kept for consistency)
const logoPattern = /<img src="https:\/\/klyngcup\.com\/images\/klyng-cup\.png" alt="Klyng Cup" style="max-width: 150px; height: auto;" \/>/g;
const logoReplacement = '<img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />';

const logoMatches = content.match(logoPattern);
if (logoMatches) {
  content = content.replace(logoPattern, logoReplacement);
  console.log(`✓ Added margin-bottom to ${logoMatches.length} logo images`);
  updateCount += logoMatches.length;
}

// Pattern 2: Reduce header padding from 40px to 20px (for gradient headers)
// Match style attributes that contain both "linear-gradient" and "padding: 40px"
const lines = content.split('\n');
let headerUpdateCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Check if line contains linear-gradient and padding: 40px
  if (line.includes('linear-gradient') && line.includes('padding: 40px')) {
    // Replace padding: 40px 30px with padding: 20px 30px
    if (line.includes('padding: 40px 30px')) {
      lines[i] = line.replace(/padding: 40px 30px/g, 'padding: 20px 30px');
      headerUpdateCount++;
    }
    // Replace padding: 40px 32px with padding: 20px 32px
    else if (line.includes('padding: 40px 32px')) {
      lines[i] = line.replace(/padding: 40px 32px/g, 'padding: 20px 32px');
      headerUpdateCount++;
    }
  }
}

content = lines.join('\n');

if (headerUpdateCount > 0) {
  console.log(`✓ Reduced header padding for ${headerUpdateCount} email templates`);
  updateCount += headerUpdateCount;
} else {
  console.log('✗ No header padding patterns found to update');
}

// Write back
fs.writeFileSync(emailPath, content, 'utf8');
console.log(`\n✓ Email spacing updated successfully (${updateCount} total updates)`);
