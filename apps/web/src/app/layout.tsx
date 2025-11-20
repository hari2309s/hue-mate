import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc";

export const metadata: Metadata = {
  title: "Hue & You - Extract Perfect Color Palettes",
  description:
    "Upload any image and instantly extract a perfect color palette with Tailwind configs, Figma variables, and CSS.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
