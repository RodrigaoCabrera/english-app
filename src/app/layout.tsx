import type { Metadata } from "next";
import { DM_Sans, Lora } from "next/font/google";
import Link from "next/link";
import {
  ClerkProvider,
  Show,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "English App",
  description: "AI-powered English learning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("dark h-full antialiased", dmSans.variable, lora.variable)}>
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <TooltipProvider>
            <header className="border-b border-border/60">
              <div className="max-w-3xl mx-auto px-6 h-13 flex items-center justify-between gap-4">
                <nav className="flex items-center gap-7">
                  <Link href="/" className="font-serif font-medium text-foreground tracking-tight">
                    English App
                  </Link>
                  <Show when="signed-in">
                    <Link href="/reading" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Reading
                    </Link>
                    <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Dashboard
                    </Link>
                  </Show>
                </nav>
                <div className="flex items-center gap-3">
                  <Show when="signed-out">
                    <SignInButton mode="modal">
                      <button className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Sign in
                      </button>
                    </SignInButton>
                  </Show>
                  <Show when="signed-in">
                    <UserButton />
                  </Show>
                </div>
              </div>
            </header>
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">{children}</main>
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
