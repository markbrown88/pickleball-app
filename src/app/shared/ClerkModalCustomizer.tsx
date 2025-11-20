'use client';

import { useEffect, useRef } from 'react';

export function ClerkModalCustomizer() {
  const processedCardsRef = useRef<Set<Element>>(new Set());
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const customizeModal = () => {
      const now = Date.now();
      // Debounce: don't run more than once every 500ms
      if (now - lastUpdateRef.current < 500) {
        return;
      }
      lastUpdateRef.current = now;

      // Find Clerk modal card boxes - only target the outer container
      const clerkCardBoxes = document.querySelectorAll('[class*="cl-cardBox"]');
      
      clerkCardBoxes.forEach((cardBox) => {
        // Find the inner .cl-card element (this is where we want to add the logo)
        const card = cardBox.querySelector('.cl-card');
        if (!card) return;
        
        // Skip if we've already processed this card and it's still the same
        const cardId = card.getAttribute('data-klyng-card-id') || Math.random().toString(36);
        card.setAttribute('data-klyng-card-id', cardId);
        
        // Check if already processed and still correct
        const logoCount = card.querySelectorAll('img').length;
        const ourLogo = card.querySelector('.klyng-cup-logo');
        const subtitleCheck = card.querySelector('[class*="headerSubtitle"], [class*="subtitle"]');
        const subtitleTextCheck = subtitleCheck?.innerHTML || subtitleCheck?.textContent || '';
        const hasCorrectText = subtitleTextCheck.includes('Welcome');
        
        if (processedCardsRef.current.has(card) && logoCount === 1 && ourLogo && hasCorrectText) {
          return; // Already processed correctly, skip
        }

        // ===== LOGO HANDLING =====
        // Always check and ensure we have exactly one logo
        const allImages = Array.from(card.querySelectorAll('img'));
        const ourLogos = allImages.filter(img => img.classList.contains('klyng-cup-logo'));
        const otherImages = allImages.filter(img => !img.classList.contains('klyng-cup-logo'));
        
        // Remove all non-custom logos
        otherImages.forEach((img) => {
          img.remove();
        });
        
        // If we have multiple custom logos, keep only the first one
        if (ourLogos.length > 1) {
          for (let i = 1; i < ourLogos.length; i++) {
            ourLogos[i].remove();
          }
        }
        
        // Remove any logo containers/boxes from Clerk
        const logoContainers = card.querySelectorAll('[class*="logoBox"], [class*="logoContainer"]');
        logoContainers.forEach((container) => {
          container.remove();
        });

        // Ensure we have exactly one logo
        const finalLogo = card.querySelector('.klyng-cup-logo');
        if (!finalLogo) {
          // Add our logo
          const cardContent = card.firstElementChild;
          if (cardContent) {
            const logo = document.createElement('img');
            logo.src = '/images/klyng-cup.png';
            logo.alt = 'Klyng Cup';
            logo.className = 'klyng-cup-logo';
            logo.setAttribute('data-klyng-logo', 'true');
            logo.style.cssText = `
              display: block !important;
              width: 200px;
              height: auto;
              max-height: 65px;
              margin: 0 auto;
              object-fit: contain;
            `;
            card.insertBefore(logo, cardContent);
          }
        } else {
          // Ensure our logo is positioned correctly
          const cardContent = card.firstElementChild;
          if (cardContent && finalLogo !== cardContent && finalLogo.parentElement === card) {
            card.insertBefore(finalLogo, cardContent);
          }
        }

        // ===== TEXT CUSTOMIZATION =====
        // Find title and subtitle elements using multiple possible selectors
        const titleSelectors = [
          '[class*="headerTitle"]',
          '[class*="cardTitle"]',
          'h1',
          'h2'
        ];
        
        const subtitleSelectors = [
          '[class*="headerSubtitle"]',
          '[class*="cardSubtitle"]',
          '[class*="subtitle"]',
          'p'
        ];

        let title: Element | null = null;
        let subtitle: Element | null = null;

        // Try to find title
        for (const selector of titleSelectors) {
          const found = card.querySelector(selector);
          if (found && found.textContent && found.textContent.trim().length > 0) {
            // Check if it's likely the title (not a button or link)
            if (!found.closest('button') && !found.closest('a')) {
              title = found;
              break;
            }
          }
        }

        // Try to find subtitle - check multiple elements, not just first match
        for (const selector of subtitleSelectors) {
          const found = card.querySelectorAll(selector);
          for (const elem of Array.from(found)) {
            if (elem.textContent && elem.textContent.trim().length > 0) {
              // Check if it's likely the subtitle (not a button or link)
              if (!elem.closest('button') && !elem.closest('a')) {
                // Prefer elements that are in the header area
                const isInHeader = elem.closest('[class*="header"]') || elem.closest('[class*="cardHeader"]');
                if (isInHeader || !subtitle) {
                  subtitle = elem;
                  if (isInHeader) break; // Prefer header subtitle
                }
              }
            }
          }
          if (subtitle) break;
        }

        // Determine which modal it is by checking for unique form fields
        // Sign-up has "firstName" field, sign-in doesn't
        const hasFirstNameField = card.querySelector('input[name*="firstName"], input[id*="firstName"], input[placeholder*="First"], input[placeholder*="first"], input[type="text"][name*="name"]');
        
        // Check URL path (most reliable for pages, not modals)
        const pathname = window.location.pathname;
        const isSignUpPath = pathname.includes('sign-up');
        const isSignInPath = pathname.includes('sign-in');
        
        // Check for "Don't have an account?" link (sign-in) or "Already have an account?" (sign-up)
        const cardText = card.textContent || '';
        const cardHTML = card.innerHTML || '';
        const hasDontHaveAccount = cardText.includes("Don't have an account") || cardHTML.includes("Don't have an account");
        const hasAlreadyHaveAccount = cardText.includes('Already have an account') || cardHTML.includes('Already have an account');
        
        // Check for sign-up specific text patterns
        const hasCreateAccount = (cardText.includes('Create') && cardText.includes('account')) || cardHTML.includes('Create your account');
        // Check for sign-up button text
        const signUpButton = Array.from(card.querySelectorAll('button[type="submit"]')).find(btn => 
          btn.textContent?.toLowerCase().includes('sign up') || btn.textContent?.toLowerCase().includes('create')
        );
        const hasSignUpButton = !!signUpButton;
        
        // Check title text for clues
        const titleText = title?.textContent?.toLowerCase() || '';
        const hasCreateTitle = titleText.includes('create') || titleText.includes('sign up');
        const hasSignInTitle = titleText.includes('sign in') || titleText.includes('welcome back');
        
        // Determine modal type - prioritize form fields (most reliable for modals), then content, then URL
        let isSignUp = false;
        
        // Most reliable: check for firstName field (sign-up only)
        if (hasFirstNameField) {
          isSignUp = true;
        }
        // Second: check for "Already have an account" link (sign-up)
        else if (hasAlreadyHaveAccount) {
          isSignUp = true;
        }
        // Third: check title text
        else if (hasCreateTitle) {
          isSignUp = true;
        }
        // Fourth: check for "Create account" text
        else if (hasCreateAccount) {
          isSignUp = true;
        }
        // Fifth: check URL path (for dedicated pages)
        else if (isSignUpPath) {
          isSignUp = true;
        }
        // Otherwise, it's sign-in (default for modals opened from homepage)

        // Always hide title and update text, even if Clerk resets it
        if (title) {
          (title as HTMLElement).style.cssText = 'display: none !important; visibility: hidden !important; height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important;';
          // Also try removing it from the DOM flow
          (title as HTMLElement).setAttribute('aria-hidden', 'true');
        }
        
        if (subtitle) {
          // Use \n for line breaks since we're using white-space: pre-line
          const expectedTextHTML = isSignUp 
            ? 'Welcome!<br />Please create your account below.'
            : 'Welcome back!<br />Please sign in to continue';
          
          const expectedTextPlain = isSignUp 
            ? 'Welcome!\nPlease create your account below.'
            : 'Welcome back!\nPlease sign in to continue';
          
          const currentText = (subtitle as HTMLElement).innerHTML || (subtitle as HTMLElement).textContent || '';
          
          // Check if text needs updating - be more lenient with the check
          const hasWelcome = currentText.includes('Welcome');
          const hasCorrectContent = isSignUp 
            ? currentText.includes('create your account')
            : currentText.includes('sign in to continue');
          
          // Check if line break is present (either <br or \n)
          const hasLineBreak = currentText.includes('<br') || currentText.includes('\n');
          
          // Always update if it doesn't have both parts or doesn't have the line break
          const needsUpdate = !hasWelcome || !hasCorrectContent || !hasLineBreak;
          
          if (needsUpdate) {
            // Try innerHTML first (for <br /> tags)
            (subtitle as HTMLElement).innerHTML = expectedTextHTML;
            (subtitle as HTMLElement).style.display = 'block';
            (subtitle as HTMLElement).style.whiteSpace = 'pre-line';
            
            // If that doesn't work, try textContent with \n
            setTimeout(() => {
              const checkText = (subtitle as HTMLElement).innerHTML || (subtitle as HTMLElement).textContent || '';
              if (!checkText.includes('<br') && !checkText.includes('\n')) {
                (subtitle as HTMLElement).textContent = expectedTextPlain;
              }
            }, 100);
          }
        }

        // Mark as processed
        processedCardsRef.current.add(card);
      });
    };

    // Run immediately
    customizeModal();

    // Watch for new modals (Clerk uses dynamic rendering) with better debouncing
    let timeoutId: NodeJS.Timeout | null = null;
    const observer = new MutationObserver((mutations) => {
      // Only trigger if there are actual changes to cards or images
      const hasRelevantChanges = mutations.some(mutation => {
        // Check if target is an Element (not a text node)
        if (!(mutation.target instanceof Element)) return false;
        
        const target = mutation.target;
        const isCard = target.classList?.toString().includes('cl-card');
        const hasCard = target.querySelector('[class*="cl-card"]');
        const hasNewImages = Array.from(mutation.addedNodes).some(node => {
          // Check if node is an Element
          if (!(node instanceof Element)) return false;
          return node.tagName === 'IMG' || node.querySelector('img');
        });
        return isCard || hasCard || hasNewImages;
      });
      
      if (hasRelevantChanges) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(customizeModal, 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      processedCardsRef.current.clear();
    };
  }, []);

  return null;
}
