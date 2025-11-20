'use client';

import { useEffect } from 'react';

export function ClerkLogoInjector() {
  useEffect(() => {
    // Function to inject logo into Clerk modals
    const injectLogo = () => {
      // Find Clerk modal cards
      const clerkCards = document.querySelectorAll('[class*="cl-card"]');
      
      clerkCards.forEach((card) => {
        // Count existing logos
        const existingLogos = card.querySelectorAll('.klyng-cup-logo, img[src*="klyng-cup"]');
        
        // If we already have exactly one logo, ensure it's in the right place and return
        if (existingLogos.length === 1) {
          const logo = existingLogos[0];
          const cardContent = card.firstElementChild;
          // If logo is not the first child, move it
          if (cardContent && logo !== cardContent && logo.parentElement === card) {
            card.insertBefore(logo, cardContent);
          }
          return;
        }

        // Remove ALL logos (we'll add one back)
        existingLogos.forEach((logo) => logo.remove());

        // Remove any logo containers/boxes from Clerk
        const logoContainers = card.querySelectorAll('[class*="logoBox"], [class*="logoContainer"]');
        logoContainers.forEach((container) => container.remove());

        // Find the card content (skip if no content)
        const cardContent = card.firstElementChild;
        if (!cardContent) return;

        // Create our single logo element
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

        // Insert logo at the very beginning of the card
        card.insertBefore(logo, cardContent);
      });
    };

    // Run immediately
    injectLogo();

    // Watch for new modals (Clerk uses dynamic rendering)
    const observer = new MutationObserver(() => {
      // Debounce to avoid multiple rapid calls
      setTimeout(injectLogo, 100);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}

