import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  type Card,
  type FSRS,
  type Grade as FsrsGrade,
} from "ts-fsrs";

// ts-fsrs Rating: Again=1 Hard=2 Good=3 Easy=4 — the grades the review UI sends.
export type Grade = 1 | 2 | 3 | 4;

export type SrsParams = {
  weights: number[] | null;
  desired_retention: number;
};

// Shape stored in public.card_srs (dates as ISO strings from PostgREST).
export type CardRow = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

export function scheduler(params?: Partial<SrsParams>): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: params?.desired_retention ?? 0.9,
      ...(params?.weights ? { w: params.weights } : {}),
    })
  );
}

export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

function rowToCard(row: CardRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  } as Card;
}

/** Apply a grade, returning the next FSRS card state and the review log row. */
export function review(f: FSRS, row: CardRow, grade: Grade, now: Date) {
  const { card, log } = f.next(rowToCard(row), now, grade as unknown as FsrsGrade);
  return { card, log };
}

/**
 * Predicted recall of a card at `at` from its current stored stability, with
 * no further reviews — the conservative "if you stopped studying now" reading
 * the readiness % is built from (PLAN.md E5). New/unstudied cards → 0.
 */
export function retrievabilityAt(f: FSRS, row: CardRow, at: Date): number {
  if (!row.last_review || row.stability <= 0) return 0;
  return f.get_retrievability(rowToCard(row), at, false) as number;
}
