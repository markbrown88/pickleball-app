const fs = require('fs');
const path = require('path');

const emailPath = path.join(__dirname, '../src/server/email.ts');
let content = fs.readFileSync(emailPath, 'utf8');

// Logo HTML to insert
const logoHTML = `                <!-- Logo -->
                <tr>
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto;" />
                  </td>
                </tr>

`;

// Pattern to find email table starts without logos
const pattern = /(              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba\(0,0,0,0\.1\);">)\n\n(\s+<!-- Header -->)/g;

// Replace pattern - add logo before <!-- Header -->
const replacement = `$1\n\n${logoHTML}$2`;

// Count occurrences before
const beforeCount = (content.match(pattern) || []).length;
console.log(`Found ${beforeCount} email templates without logos`);

// Apply replacement
const updatedContent = content.replace(pattern, replacement);

// Count logo sections after
const afterCount = (updatedContent.match(/<!-- Logo -->/g) || []).length;
console.log(`Total logo sections after update: ${afterCount}`);

// Write back
fs.writeFileSync(emailPath, updatedContent, 'utf8');
console.log('✓ Email logos updated successfully');
