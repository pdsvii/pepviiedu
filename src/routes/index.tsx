import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, School, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground display font-bold">v</span>
          <span className="display text-xl font-bold">viiVision <span className="text-primary">PEP</span></span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth" search={{ mode: "signup" as const }}>
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="grid gap-10 py-16 md:grid-cols-2 md:items-center">
          <div>
            <span className="band-chip" data-band="proficient">
              <Sparkles className="h-3.5 w-3.5" /> Built for Grades 4–6
            </span>
            <h1 className="display mt-4 text-4xl font-extrabold leading-tight md:text-6xl">
              Confident kids.<br/>Ready for <span className="text-primary">PEP</span>.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              viiVision PEP is a friendly practice app for Jamaica's Primary Exit Profile. Playful for children,
              powerful for parents and teachers — covering the Ability Test, the Curriculum-Based Test, and
              Performance Tasks across all four subjects.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "signup" as const, role: "parent" as const }}>
                <Button size="lg" className="rounded-full">I'm a parent</Button>
              </Link>
              <Link to="/auth" search={{ mode: "signup" as const, role: "teacher" as const }}>
                <Button size="lg" variant="secondary" className="rounded-full">I'm a teacher</Button>
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Students sign in with the account their parent creates for them.
            </p>
          </div>
          <div className="relative">
            <div className="rounded-4xl bg-secondary p-6 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { emoji: "🧮", label: "Mathematics" },
                  { emoji: "📚", label: "Language Arts" },
                  { emoji: "🔬", label: "Science" },
                  { emoji: "🌍", label: "Social Studies" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl bg-card p-4 text-center shadow-sm">
                    <div className="text-3xl">{s.emoji}</div>
                    <div className="mt-2 text-sm font-semibold">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-accent px-4 py-3 text-sm">
                <span>Today's streak</span>
                <span className="font-bold">🔥 4 days</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="band-chip" data-band="beginning">Beginning</span>
                <span className="band-chip" data-band="developing">Developing</span>
                <span className="band-chip" data-band="proficient">Proficient</span>
                <span className="band-chip" data-band="highly_proficient">Highly Proficient</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-3">
          <Feature icon={<GraduationCap className="h-6 w-6" />} title="For Students" body="Bite-sized practice, instant feedback, rewards, and progress rings — no scary scores." />
          <Feature icon={<Users className="h-6 w-6" />} title="For Parents" body="Create your child's account, keep them safe, and see progress by subject at a glance." />
          <Feature icon={<School className="h-6 w-6" />} title="For Teachers" body="Build classes, assign practice, and spot weak strands with a topic × student heatmap." />
        </section>

        <section className="py-16 text-center">
          <h2 className="display text-3xl font-bold">Practice built around the PEP</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Every question is tagged by grade, subject, and PEP component — Ability Test, Curriculum-Based Test, or Performance Task —
            and reported using the four official proficiency bands.
          </p>
          <div className="mt-8">
            <Link to="/auth" search={{ mode: "signup" as const }}>
              <Button size="lg" className="rounded-full">Create a free account</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © viiVision PEP — practice content, not real past papers.
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-sm">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-secondary-foreground">{icon}</div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
