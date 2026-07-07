
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai_generated',
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS questions_source_idx ON public.questions(source);
CREATE INDEX IF NOT EXISTS questions_needs_review_idx ON public.questions(needs_review);
