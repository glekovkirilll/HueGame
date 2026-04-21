"use client";

import { RoundState } from "@huegame/contracts";

import type { Locale } from "@/lib/i18n";
import { phaseLabel } from "@/lib/i18n";

const phases = [
  RoundState.PREPARE_ROUND,
  RoundState.CLUE_VISIBLE,
  RoundState.VOTING_OPEN,
  RoundState.ALL_CONFIRMED_PENDING_FINALIZE,
  RoundState.REVEAL_VOTES,
  RoundState.REVEAL_ZONE,
  RoundState.ROUND_RESULTS,
  RoundState.ROUND_TRANSITION,
  RoundState.GAME_FINISHED
] as const;

type PhaseStripProps = {
  locale: Locale;
  state: RoundState | null;
};

export function PhaseStrip({ locale, state }: PhaseStripProps) {
  const activeIndex = state ? phases.indexOf(state) : -1;

  return (
    <ol className="phase-strip" aria-label={phaseLabel(locale, state)}>
      {phases.map((phase, index) => (
        <li
          className={[
            "phase-step",
            index === activeIndex ? "is-active" : "",
            activeIndex >= 0 && index < activeIndex ? "is-complete" : ""
          ].join(" ")}
          key={phase}
        >
          <span>{index + 1}</span>
          <strong>{phaseLabel(locale, phase)}</strong>
        </li>
      ))}
    </ol>
  );
}
