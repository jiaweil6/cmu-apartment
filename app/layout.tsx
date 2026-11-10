import type { Metadata, Viewport } from "next";
import { Zilla_Slab } from "next/font/google";
import Link from "next/link";
import { BrandMark } from "@/components/icons";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

const zillaSlab = Zilla_Slab({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-zilla-slab",
});

export const metadata: Metadata = {
  title: "Apartment Ranking",
  description:
    "Personalized off-campus apartment rankings for CMU students. Weigh commute, distance, price, rating and building age to rank apartments near campus.",
  icons: { icon: "https://cdn-icons-png.flaticon.com/128/11304/11304956.png" },
};

export const viewport: Viewport = {
  themeColor: "#f7f3ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={zillaSlab.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand">
              <BrandMark className="brand-mark" />
              Apartment Ranking
            </Link>
            <SiteNav />
          </div>
        </header>
        <main id="main" className="site-main">
          {children}
        </main>
        <footer className="site-footer">
          Commute and walking times are calculated with{" "}
          <a href="https://www.rideprt.org/" target="_blank" rel="noopener noreferrer">
            Pittsburgh Regional Transit
          </a>{" "}
          schedules and map data ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap contributors
          </a>{" "}
          (ODbL).
        </footer>
      </body>
    </html>
  );
}
