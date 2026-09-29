import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DisciplineTracker",
  description:
    "Personal discipline, goals, fitness, learning, and productivity tracker.",

  applicationName: "DisciplineTracker",

  appleWebApp: {
    capable: true,
    title: "DisciplineTracker",
    statusBarStyle: "black-translucent",
  },

  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },

  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
