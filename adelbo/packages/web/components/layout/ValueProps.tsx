import { Brain, CreditCard, Users, ShieldCheck } from 'lucide-react';

const props = [
  {
    icon: Brain,
    title: 'AI that actually helps',
    description:
      'Honest hotel fit assessments, rate explanations, and timing guidance — at the five moments that matter.',
  },
  {
    icon: CreditCard,
    title: 'Real Travel Credit',
    description:
      'Every completed stay earns 1.25% back as Travel Credit. Not points. Not tokens. Actual credit for future bookings.',
  },
  {
    icon: Users,
    title: 'Community Pool',
    description:
      'Every booking contributes to a visible Pool. Active travelers share in the reward each month.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified reviews',
    description:
      'Every review is tied to a real completed stay — verified by oracle consensus. No fake reviews.',
  },
];

export function ValueProps() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-12">
        <p className="section-label mb-3">Why Adelbo</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">
          Hotel booking that actually works for you
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {props.map(({ icon: Icon, title, description }) => (
          <div key={title} className="glass-card p-6 animate-fade-up">
            <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center mb-4">
              <Icon size={20} className="text-amber" />
            </div>
            <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
            <p className="text-text-muted text-sm leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
