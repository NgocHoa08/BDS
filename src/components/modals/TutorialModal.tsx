import { TUTORIAL_STEPS } from '../../game/constants';
import { BrandLogo } from '../BrandLogo';
import { ModalFrame } from '../ui';

export function TutorialModal({
  step,
  next,
  done,
}: {
  step: number;
  next: () => void;
  done: () => void;
}) {
  const idx = Math.min(step, TUTORIAL_STEPS.length - 1);
  const [title, body] = TUTORIAL_STEPS[idx];
  const isLast = step >= TUTORIAL_STEPS.length - 1;

  return (
    <ModalFrame>
      {idx === 0 && (
        <div className="mb-3 flex justify-center">
          <BrandLogo size="lg" showSubtitle />
        </div>
      )}
      <div className="mb-1 text-xs text-muted-foreground">
        Hướng dẫn {idx + 1}/{TUTORIAL_STEPS.length}
      </div>
      <h3 className="text-gold text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed">{body}</p>
      <div className="mt-4 flex gap-2">
        <button className="btn-ghost flex-1" onClick={done}>
          Bỏ qua
        </button>
        <button className="btn-gold flex-1" onClick={isLast ? done : next}>
          {isLast ? 'Bắt đầu chơi' : 'Tiếp'}
        </button>
      </div>
    </ModalFrame>
  );
}
