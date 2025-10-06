import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";
import { ModalProvider } from "./shared/ModalContext";

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
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${plusJakartaSans.variable} ${outfit.variable} antialiased`} suppressHydrationWarning>
          <ModalProvider>
            {children}
          </ModalProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
