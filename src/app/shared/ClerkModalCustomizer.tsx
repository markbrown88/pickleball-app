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

      // Find Clerk modal cards (works for both sign-in and sign-up)
      const clerkCards = document.querySelectorAll('[class*="cl-card"]');
      
      clerkCards.forEach((card) => {
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
        // Count images
        const allImages = Array.from(card.querySelectorAll('img'));
        const ourLogo = card.querySelector('.klyng-cup-logo');
        const otherImages = allImages.filter(img => !img.classList.contains('klyng-cup-logo'));
        
        // If there are other images, remove them
        if (otherImages.length > 0) {
          otherImages.forEach((img) => {
            img.remove();
          });
        }

        // Remove any logo containers/boxes from Clerk (but keep our logo)
        const logoContainers = card.querySelectorAll('[class*="logoBox"], [class*="logoContainer"]');
        logoContainers.forEach((container) => {
          // Only remove if it doesn't contain our logo
          if (!container.querySelector('.klyng-cup-logo')) {
            container.remove();
          }
        });

        // Now ensure we have exactly one logo
        const finalLogoCheck = card.querySelector('.klyng-cup-logo');
        if (!finalLogoCheck) {
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
          if (cardContent && finalLogoCheck !== cardContent && finalLogoCheck.parentElement === card) {
            card.insertBefore(finalLogoCheck, cardContent);
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
          (title as HTMLElement).style.display = 'none';
          (title as HTMLElement).style.visibility = 'hidden';
          (title as HTMLElement).style.height = '0';
          (title as HTMLElement).style.margin = '0';
          (title as HTMLElement).style.padding = '0';
        }
        
        if (subtitle) {
          const expectedText = isSignUp 
            ? 'Welcome!<br /><br />Please create your account below.'
            : 'Welcome back!<br />Please sign in to continue';
          
          const currentText = (subtitle as HTMLElement).innerHTML || (subtitle as HTMLElement).textContent || '';
          
          // Check if text needs updating
          const isCorrect = isSignUp 
            ? currentText.includes('Welcome!') && currentText.includes('create your account')
            : currentText.includes('Welcome back') && currentText.includes('sign in to continue');
          
          if (!isCorrect) {
            // Use innerHTML for both to allow line breaks
            (subtitle as HTMLElement).innerHTML = expectedText;
            (subtitle as HTMLElement).style.display = 'block';
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
        const target = mutation.target as Element;
        const isCard = target.classList?.toString().includes('cl-card');
        const hasCard = target.querySelector('[class*="cl-card"]');
        const hasNewImages = Array.from(mutation.addedNodes).some(node => 
          (node as Element)?.tagName === 'IMG' || (node as Element)?.querySelector('img')
        );
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
