import { HeroSearch } from '@/components/search/HeroSearch';
import { PoolBanner } from '@/components/rewards/PoolBanner';
import { ValueProps } from '@/components/layout/ValueProps';
import { NavBar } from '@/components/layout/NavBar';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      {/* Hero section */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-glow opacity-40" />
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16">
            {/* Eyebrow */}
            <div className="flex justify-center mb-6">
              <span className="chip chip-amber text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
                AI-assisted booking
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-black text-center leading-tight tracking-tight mb-4">
              Smarter stays
              <br />
              <span className="text-gradient-amber">start here.</span>
            </h1>

            <p className="text-text-secondary text-lg sm:text-xl text-center max-w-2xl mx-auto mb-12 leading-relaxed">
              Book hotels with better judgment, earn Travel Credit, and unlock
              community rewards with every stay.
            </p>

            {/* Search */}
            <HeroSearch />
          </div>
        </section>

        {/* Pool banner */}
        <PoolBanner />

        {/* Value props */}
        <ValueProps />
      </main>

      <Footer />
    </div>
  );
}
