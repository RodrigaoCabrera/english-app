import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import Link from "next/link";
import { LevelSelector } from "@/components/LevelSelector";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "English App",
  description: "AI-powered English learning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", geist.variable, "font-sans", inter.variable)}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>
          <header className="border-b">
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
              <nav className="flex items-center gap-6">
                <Link href="/" className="font-semibold text-sm">
                  English App
                </Link>
                <Link href="/reading" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Reading
                </Link>
              </nav>
              <LevelSelector />
            </div>
          </header>
          <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
