import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";
import { ModalProvider } from "./shared/ModalContext";
import { ClerkLogoInjector } from "./shared/ClerkLogoInjector";

const plusJakartaSans = Plus_Jakarta_Sans({ 
  variable: "--font-plus-jakarta-sans", 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

const outfit = Outfit({ 
  variable: "--font-outfit", 
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Klyng Cup - Multi-Stop Pickleball Championship",
  description: "The ultimate multi-stop pickleball championship experience. Where clubs compete across multiple stops, accumulating points toward the ultimate championship.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        elements: {
          // Modal overlay
          modalBackdrop: 'bg-black/60 backdrop-blur-sm',
          modalContent: 'bg-surface-1 border-border-subtle',
          modalContentBlur: 'bg-surface-1',
          
          // Card styling
          card: 'bg-surface-1 border-border-subtle shadow-xl',
          headerTitle: 'text-text-primary font-semibold',
          headerSubtitle: 'text-text-muted',
          header: 'flex flex-col items-center pb-4',
          headerLogo: 'mb-4 h-12 w-auto',
          
          // Social buttons
          socialButtonsBlockButton: 'bg-surface-2 border-border-subtle hover:bg-surface-1 transition-colors',
          socialButtonsBlockButtonText: '!text-[#F5F7FA] font-medium',
          socialButtonsBlockButtonArrow: '!text-[#F5F7FA]',
          
          // Dividers
          dividerLine: 'bg-border-subtle',
          dividerText: 'text-text-muted',
          
          // Form inputs
          formFieldInput: 'bg-surface-2 border-border-subtle text-text-primary placeholder:text-text-muted focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20',
          formFieldLabel: 'text-text-secondary',
          formFieldSuccessText: 'text-status-success',
          formFieldErrorText: 'text-status-error',
          
          // Buttons
          formButtonPrimary: 'bg-brand-primary hover:bg-brand-primary-hover active:bg-brand-primary-active text-brand-primary-text font-medium transition-colors',
          formButtonReset: 'text-brand-secondary hover:text-brand-secondary-hover',
          
          // Links - using explicit bright colors for visibility
          footerActionLink: '!text-[#01DFCB] hover:!text-[#13E9D6] !font-medium',
          formFieldInputShowPasswordButton: '!text-[#01DFCB] hover:!text-[#13E9D6]',
          formResendCodeLink: '!text-[#01DFCB] hover:!text-[#13E9D6]',
          footerAction: 'text-text-muted',
          footerActionText: 'text-text-muted',
          // Logo container
          logoBox: 'flex justify-center mb-4',
          logoImage: 'h-12 w-auto max-w-[200px] object-contain',
          
          // Identity preview
          identityPreviewText: 'text-text-primary',
          identityPreviewEditButton: 'text-brand-secondary hover:text-brand-secondary-hover',
          
          // OTP
          otpCodeFieldInput: 'bg-surface-2 border-border-subtle text-text-primary focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20',
          
          // Alerts
          alertText: 'text-text-primary',
          alertTextDanger: 'text-status-error',
          
          // Close button
          modalCloseButton: 'text-text-muted hover:text-text-primary',
        },
        variables: {
          colorPrimary: '#0A2540', // brand-primary
          colorText: '#F5F7FA', // text-primary
          colorTextSecondary: '#E5E7EB', // text-secondary
          colorTextOnPrimaryBackground: '#FFFFFF', // brand-primary-text
          colorInputBackground: '#1F2937', // surface-2
          colorInputText: '#F5F7FA', // text-primary
          colorBackground: '#111827', // surface-1
          colorDanger: '#AA1E2C', // status-error
          colorSuccess: '#1B9E77', // status-success
          borderRadius: '0.625rem', // --radius
          fontFamily: 'var(--font-plus-jakarta-sans), ui-sans-serif, system-ui, sans-serif',
          fontSize: '0.875rem',
          fontWeight: {
            normal: '400',
            medium: '500',
            semibold: '600',
            bold: '700',
          },
        },
        layout: {
          socialButtonsPlacement: 'top',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${plusJakartaSans.variable} ${outfit.variable} antialiased`} suppressHydrationWarning>
          <ClerkLogoInjector />
          <ModalProvider>
            {children}
          </ModalProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
