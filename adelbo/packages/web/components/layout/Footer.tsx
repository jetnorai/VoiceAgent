import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-bg-border mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber flex items-center justify-center">
                <span className="font-display font-black text-bg-base text-xs">A</span>
              </div>
              <span className="font-display font-bold text-lg text-text-primary">adelbo</span>
            </div>
            <p className="text-text-muted text-sm max-w-xs">
              Smarter stays start here. AI-assisted booking with real Travel Credit.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-text-muted">
            <Link href="/about" className="hover:text-text-primary transition-colors">About</Link>
            <Link href="/pool" className="hover:text-text-primary transition-colors">Pool</Link>
            <Link href="/rewards" className="hover:text-text-primary transition-colors">Rewards</Link>
            <Link href="/transparency" className="hover:text-text-primary transition-colors">Transparency</Link>
            <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-bg-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-text-muted">
          <p>© 2026 Adelbo. All rights reserved.</p>
          <p>Travel Credit and Pool rewards are subject to terms.</p>
        </div>
      </div>
    </footer>
  );
}
