import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { CtaSection } from "@/components/CtaSection";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <span id="top" />
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
