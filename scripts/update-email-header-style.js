const fs = require('fs');
const path = require('path');

const emailPath = path.join(__dirname, '../src/server/email.ts');
let content = fs.readFileSync(emailPath, 'utf8');

console.log('Updating email header styles...\n');

let updateCount = 0;

// Pattern 1: Update logo <tr> background color to #111827
const logoTrPattern = /<tr style="background-color: #1e40af;">/g;
const logoTrReplacement = '<tr style="background-color: #111827;">';

const logoMatches = content.match(logoTrPattern);
if (logoMatches) {
  content = content.replace(logoTrPattern, logoTrReplacement);
  console.log(`✓ Updated logo background to #111827 for ${logoMatches.length} sections`);
  updateCount += logoMatches.length;
}

// Pattern 2: Update header <td> styles
// Change padding from "20px 30px" to "0px 20px 15px" and border-radius from "8px 8px 0 0" to "0"
const headerTdPattern = /(<td style="background: linear-gradient\([^)]+\); )padding: 20px 30px; text-align: center; border-radius: 8px 8px 0 0;/g;
const headerTdReplacement = '$1padding: 0px 20px 15px; text-align: center; border-radius: 0;';

const headerMatches = content.match(headerTdPattern);
if (headerMatches) {
  content = content.replace(headerTdPattern, headerTdReplacement);
  console.log(`✓ Updated header styles for ${headerMatches.length} email templates`);
  updateCount += headerMatches.length;
}

// Pattern 3: Also update header <td> with different gradient order (padding before gradient)
const headerTdPattern2 = /(<td style=")padding: 20px 30px; (background: linear-gradient\([^)]+\); text-align: center; )border-radius: 8px 8px 0 0;/g;
const headerTdReplacement2 = '$1padding: 0px 20px 15px; $2border-radius: 0;';

const headerMatches2 = content.match(headerTdPattern2);
if (headerMatches2) {
  content = content.replace(headerTdPattern2, headerTdReplacement2);
  console.log(`✓ Updated header styles (alt pattern) for ${headerMatches2.length} email templates`);
  updateCount += headerMatches2.length;
}

// Write back
fs.writeFileSync(emailPath, content, 'utf8');
console.log(`\n✓ Email header styles updated successfully (${updateCount} total updates)`);
