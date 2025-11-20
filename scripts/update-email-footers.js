const fs = require('fs');
const path = require('path');

const emailPath = path.join(__dirname, '../src/server/email.ts');
let content = fs.readFileSync(emailPath, 'utf8');

// Patterns for footers that need updating (missing "See you on the court! 🏓")

// Pattern 1: Footer with only "This notification was sent to"
const pattern1 = /(                <tr>\n\s+<td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">\n\s+<p style="margin: 0; font-size: 12px; color: #9ca3af;">\n\s+This notification was sent to \$\{to\}\n\s+<\/p>)/g;

const replacement1 = `                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                      See you on the court! 🏓
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      This notification was sent to \${to}
                    </p>`;

// Pattern 2: Footer with "This confirmation was sent to" (no "See you on the court!")
const pattern2 = /(                <tr>\n\s+<td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">\n\s+<p style="margin: 0; font-size: 12px; color: #9ca3af;">\n\s+This confirmation was sent to \$\{to\}\n\s+<\/p>)/g;

const replacement2 = `                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                      See you on the court! 🏓
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      This confirmation was sent to \${to}
                    </p>`;

// Pattern 3: Footer with "Thank you for your understanding"
const pattern3 = /(<td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">\n\s+<p style="margin: 0; font-size: 12px; color: #9ca3af;">\n\s+Thank you for your understanding\.)/g;

const replacement3 = `<td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                      See you on the court! 🏓
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      Thank you for your understanding.`;

// Pattern 4: Footer with "Questions about this tournament"
const pattern4 = /(<td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">\n\s+<p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">\n\s+Questions about this tournament\? Contact the tournament organizer for more information\.)/g;

const replacement4 = `<td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-align: center;">
                      See you on the court! 🏓
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                      Questions about this tournament? Contact the tournament organizer for more information.`;

// Pattern 5: Footer with "This is an automated reminder"
const pattern5 = /(<td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">\n\s+<p style="margin: 0; font-size: 12px; color: #6b7280;">\n\s+This is an automated reminder\. Please do not reply\.)/g;

const replacement5 = `<td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280;">
                      See you on the court! 🏓
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">
                      This is an automated reminder. Please do not reply.`;

console.log('Updating email footers...');

// Apply all replacements
let updatedContent = content;
let count = 0;

const match1 = content.match(pattern1);
if (match1) {
  updatedContent = updatedContent.replace(pattern1, replacement1);
  count += match1.length;
  console.log(`✓ Updated ${match1.length} footers with "This notification was sent to"`);
}

const match2 = updatedContent.match(pattern2);
if (match2) {
  updatedContent = updatedContent.replace(pattern2, replacement2);
  count += match2.length;
  console.log(`✓ Updated ${match2.length} footers with "This confirmation was sent to"`);
}

const match3 = updatedContent.match(pattern3);
if (match3) {
  updatedContent = updatedContent.replace(pattern3, replacement3);
  count += match3.length;
  console.log(`✓ Updated ${match3.length} footers with "Thank you for your understanding"`);
}

const match4 = updatedContent.match(pattern4);
if (match4) {
  updatedContent = updatedContent.replace(pattern4, replacement4);
  count += match4.length;
  console.log(`✓ Updated ${match4.length} footers with "Questions about this tournament"`);
}

const match5 = updatedContent.match(pattern5);
if (match5) {
  updatedContent = updatedContent.replace(pattern5, replacement5);
  count += match5.length;
  console.log(`✓ Updated ${match5.length} footers with "This is an automated reminder"`);
}

// Write back
fs.writeFileSync(emailPath, updatedContent, 'utf8');
console.log(`\n✓ Total ${count} email footers updated with "See you on the court! 🏓"`);
