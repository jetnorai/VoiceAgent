import { Sparkles } from 'lucide-react';

interface AISearchBadgeProps {
  text: string;
}

export function AISearchBadge({ text }: AISearchBadgeProps) {
  return (
    <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-amber/5 border border-amber/20">
      <Sparkles size={15} className="text-amber mt-0.5 flex-shrink-0" />
      <p className="text-sm text-text-secondary">{text}</p>
    </div>
  );
}
