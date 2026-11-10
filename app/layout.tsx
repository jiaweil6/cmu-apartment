import type { Metadata } from "next";
import { Zilla_Slab } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

const zillaSlab = Zilla_Slab({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-zilla-slab",
});

export const metadata: Metadata = {
  title: "Apartment Ranking",
  description:
    "Personalized off-campus apartment rankings for CMU students. Weigh commute, distance, price, rating and building age to rank apartments near campus.",
  icons: { icon: "https://cdn-icons-png.flaticon.com/128/11304/11304956.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={zillaSlab.variable}>
      <body>{children}</body>
    </html>
  );
}
