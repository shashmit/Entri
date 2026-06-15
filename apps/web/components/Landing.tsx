"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import "@/app/landing.css";

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);

  // reveal-on-scroll + swipe/stage entrances
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    root.querySelectorAll(".rise, .swipe, .stage").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing relative z-[2]" ref={rootRef}>
      {/* ================= TOPBAR ================= */}
      <div className="topbar">
        <div className="inner">
          <a className="lbrand" href="#">
            entri<i>.</i>
          </a>
          <nav className="nav">
            <a className="link" href="#how">How it works</a>
            <a className="link" href="#trust">Trust</a>
            <a className="link" href="#exam">Exam mode</a>
            <a className="link" href="#pricing">Pricing</a>
            <Link className="btn btn-p" href="/today" style={{ padding: "10px 18px" }}>
              Get started
            </Link>
          </nav>
        </div>
      </div>

      {/* ================= HERO ================= */}
      <header className="hero">
        <div className="wrap">
          <div className="kicker">Photo → flashcards → exam-ready</div>
          <h1>
            It keeps <em className="swipe">your notes</em>.
            <br />
            Not a robot&apos;s version.
          </h1>
          <p className="lead">
            Photograph your handwritten notes. entri reads them — never rewrites them —
            and quizzes you on a forgetting curve tuned to your exam date. Every card
            links back to the page you actually wrote.
          </p>
          <div className="cta">
            <Link className="btn btn-p" href="/today">Start studying free</Link>
            <a className="btn btn-s" href="#how">See how it works</a>
          </div>
          <p className="fine">Free while you study for your first exam. No credit card.</p>

          <div className="stage rise">
            <div className="idxcard settle">
              <span className="tape-strip2" />
              <div className="idx-top">
                <span className="chiplabel">Mechanics · 4 / 18</span>
                <span className="streak">▲ 12-day streak</span>
              </div>
              <div className="idx-q">What does centripetal force depend on?</div>
              <div className="grade">
                <button>Again<small>&lt;1m</small></button>
                <button>Hard<small>6m</small></button>
                <button>Good<small>2d</small></button>
                <button>Easy<small>5d</small></button>
              </div>
            </div>

            <svg className="doodle" viewBox="0 0 74 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M10 6 C 38 4, 58 18, 56 44" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path d="M48 38 L 56 46 L 63 36" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>

            <div className="page-slip settle">
              <div className="fn-label">From your notes</div>
              <span className="hl">F&nbsp;=&nbsp;mv²⁄r</span> — the force points toward the
              centre; a bigger speed or a smaller radius means more force.
              <span className="src">Physics · Notebook 2, p.14 · captured 3 Jun</span>
            </div>

            <div className="hero-sticky settle">
              <div className="t">AI-inferred · pending</div>
              <p>
                Double the speed at the same radius → <b>4×</b> the force. Add this card?
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ================= PROOF STRIP ================= */}
      <div className="proof">
        <div className="wrap inner">
          <span>Built on <b>FSRS</b> — the scheduler behind Anki&apos;s best results</span>
          <span><b>Every card</b> cites its source page</span>
          <span>AI suggestions are <b>opt-in, never silent</b></span>
        </div>
      </div>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how">
        <div className="wrap">
          <div className="center">
            <div className="kicker">How it works</div>
            <h2>Three acts. One notebook.</h2>
            <p className="note">
              No retyping, no importing decks made by strangers. Your handwriting goes in;
              an exam coach comes out.
            </p>
          </div>
          <div className="acts">
            <div className="act rise">
              <div className="num">1.</div>
              <h3>Photograph your notes</h3>
              <p>
                Snap a page — or a whole notebook in one batch. entri reads your
                handwriting and keeps it exactly as written. Anything it can&apos;t read
                gets flagged, never guessed.
              </p>
              <div className="visual">
                <div className="photo-mock">
                  <span>
                    centripetal force → F = mv²/r
                    <br />
                    points to CENTRE of circle!!
                    <br />↑ speed or ↓ radius = ↑ force
                  </span>
                  <span className="shutter" />
                </div>
              </div>
            </div>
            <div className="act rise">
              <div className="num">2.</div>
              <h3>Review on the curve</h3>
              <p>
                entri turns your notes into cards and schedules each one with FSRS — the
                spaced-repetition science Anki users swear by — so you review right before
                you&apos;d forget.
              </p>
              <div className="visual">
                <div className="cardlet">
                  <b>Why does force increase when radius shrinks?</b>
                  <div className="meta">Due today · interval 2d → 5d</div>
                </div>
              </div>
            </div>
            <div className="act rise">
              <div className="num">3.</div>
              <h3>Ask your own notes</h3>
              <p>
                Miss a card? Ask why. The chat answers only from your material and cites
                the page — if it&apos;s not in your notes, it says so instead of making
                something up.
              </p>
              <div className="visual">
                <div className="chat-mock">
                  <div className="bubble you">Why did I get the radius question wrong?</div>
                  <div className="bubble ai">
                    Your notes say force grows as radius <b>shrinks</b> — you answered the
                    inverse. <span className="cite">→ Notebook 2, p.14</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRUST ================= */}
      <section id="trust">
        <div className="wrap">
          <div className="trust-grid">
            <div>
              <div className="kicker">Why you can trust it</div>
              <h2>
                Other apps rewrite your notes. <em>entri shows its work.</em>
              </h2>
              <div className="trust-points">
                <div className="tp">
                  <div className="ic ok">✓</div>
                  <div>
                    <h3>Every card cites its page</h3>
                    <p>
                      Tap any flashcard and see the exact line of your handwriting it came
                      from. You never have to wonder whether the AI made it up.
                    </p>
                  </div>
                </div>
                <div className="tp">
                  <div className="ic warn">✎</div>
                  <div>
                    <h3>Corrections are suggestions</h3>
                    <p>
                      Wrote &quot;10⁻³&quot; where the math says &quot;10³&quot;? entri
                      flags it and asks. It never silently &quot;fixes&quot; what you wrote
                      — your notes stay yours.
                    </p>
                  </div>
                </div>
                <div className="tp">
                  <div className="ic pend">◌</div>
                  <div>
                    <h3>AI ideas wait for your OK</h3>
                    <p>
                      Inferred facts arrive on a sticky note, clearly labeled. Nothing
                      enters your reviews until you accept it — so you never memorize a
                      hallucination.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rise">
              <div className="correction">
                <div className="t">✎ Possible correction — your call</div>
                <p>
                  &quot;Boiling point of water at sea level: <del>100°F</del>{" "}
                  <ins>100°C</ins>&quot; — your note says °F, but the value matches °C.
                  Keep as written, or accept the fix?
                </p>
              </div>
              <div className="sticky2">
                <div className="t">AI-inferred · pending</div>
                <p>
                  Since F = mv²/r, doubling speed at the same radius means <b>4×</b> the
                  force. Add this as a card?
                </p>
                <div className="actions">
                  <button className="accept">Accept</button>
                  <button className="dismiss">Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= EXAM MODE ================= */}
      <section id="exam">
        <div className="wrap">
          <div className="exam-grid">
            <div className="rise">
              <div className="curve-card">
                <div className="hd">
                  <span className="t">Scheduling intensity</span>
                  <span className="d">Exam · Jun 28</span>
                </div>
                <svg
                  className="curve-svg"
                  viewBox="0 0 480 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Review intensity rises as the exam approaches; a generic scheduler stays flat"
                >
                  <line x1="24" y1="170" x2="466" y2="170" stroke="var(--line)" strokeWidth="1.5" />
                  <line x1="24" y1="12" x2="24" y2="170" stroke="var(--line)" strokeWidth="1.5" />
                  <line x1="430" y1="16" x2="430" y2="170" stroke="var(--brick)" strokeWidth="1.5" strokeDasharray="4 4" opacity=".6" />
                  <text x="430" y="190" textAnchor="middle" fontFamily="var(--mono)" fontSize="10" fill="var(--brick)">
                    exam
                  </text>
                  <path d="M24 130 C 140 124, 300 122, 430 120" stroke="var(--taupe)" strokeWidth="2.5" strokeDasharray="6 5" />
                  <path d="M24 142 C 160 138, 280 120, 360 78 C 400 56, 418 40, 430 30" stroke="var(--marigold)" strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx="430" cy="30" r="5" fill="var(--marigold)" />
                  <text x="30" y="190" fontFamily="var(--mono)" fontSize="10" fill="var(--muted)">
                    today
                  </text>
                </svg>
                <div className="legend">
                  <span><i style={{ background: "var(--marigold)" }} />entri — tuned to your date</span>
                  <span><i style={{ background: "var(--taupe)" }} />generic spaced repetition</span>
                </div>
              </div>
            </div>
            <div>
              <div className="kicker">Exam mode</div>
              <h2>Mastery that peaks the week it matters.</h2>
              <p className="note" style={{ marginBottom: 18 }}>
                Tell entri your exam date and the scheduler bends the forgetting curve
                around it — reviews compress as the day approaches, so your weakest topics
                surface while there&apos;s still time to fix them.
              </p>
              <p className="note">
                Generic apps drill you the same way in week one and the night before.
                That&apos;s how you peak too early — or never.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= READINESS ================= */}
      <section>
        <div className="wrap narrow">
          <div className="center">
            <div className="kicker">The honest number</div>
            <h2>
              Know if you&apos;re ready. <em>Actually.</em>
            </h2>
            <p className="note">
              Readiness is your predicted recall on exam day — computed from every review
              you&apos;ve done, not a feel-good progress bar. Never &quot;cards
              generated.&quot;
            </p>
          </div>
          <div className="report rise" style={{ marginTop: 40 }}>
            <div className="report-h">
              <div>
                <div className="lbl">Exam readiness · Jun 28</div>
                <div className="big tabnum">72%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="lbl">Due today</div>
                <div className="big tabnum" style={{ color: "var(--paper)", fontSize: 34 }}>18</div>
              </div>
            </div>
            <div className="report-body">
              {[
                ["Thermodynamics", 41, "var(--brick)"],
                ["Circular motion", 63, "var(--marigold)"],
                ["Electrostatics", 79, "var(--teal)"],
                ["Optics", 88, "var(--teal)"],
              ].map(([t, p, c]) => (
                <div className="weak" key={t as string}>
                  <span className="t">{t}</span>
                  <span className="bar">
                    <i style={{ width: `${p}%`, background: c as string }} />
                  </span>
                  <span className="p">{p}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= HABIT ================= */}
      <section>
        <div className="wrap">
          <div className="center">
            <div className="kicker">Ten minutes a day</div>
            <h2>A habit, not a chore.</h2>
            <p className="note">
              Most study apps are deleted within three weeks. entri is built around one
              small daily set — finished with your coffee, kept alive by a streak that
              respects you.
            </p>
          </div>
          <div className="streak-row">
            <div className="streak-card rise">
              <div className="n tabnum">
                12 <span style={{ fontSize: 20, color: "var(--marigold-deep)" }}>▲</span>
              </div>
              <div className="l">day streak — one nudge a day, never a guilt trip</div>
              <div className="dots" aria-hidden="true">
                <i className="on" /><i className="on" /><i className="on" /><i className="on" />
                <i className="on" /><i className="on" /><i className="today" />
              </div>
            </div>
            <div className="streak-card rise">
              <div className="n tabnum">
                ~10<span style={{ fontSize: 20, color: "var(--muted)" }}> min</span>
              </div>
              <div className="l">a typical daily set — sized by the scheduler, not by guilt</div>
            </div>
            <div className="streak-card rise">
              <div className="n tabnum">1</div>
              <div className="l">reminder per day, timed to when you actually study</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= QUOTES ================= */}
      <section>
        <div className="wrap">
          <div className="center">
            <div className="kicker">From the margin</div>
            <h2>Students keep the apps they trust.</h2>
          </div>
          <div className="quotes">
            <div className="quote rise">
              <p>
                &quot;I stopped using flashcard apps because I never knew if the AI cards
                were real. Seeing my own handwriting under every card fixed that
                instantly.&quot;
              </p>
              <div className="who">Priya · A-level physics</div>
            </div>
            <div className="quote rise">
              <p>
                &quot;The readiness number was brutal at 54%. Two weeks later it said 81%
                and the exam felt exactly like that. I believe it now.&quot;
              </p>
              <div className="who">Marcus · Med school, year 2</div>
            </div>
            <div className="quote rise">
              <p>
                &quot;It flagged that I&apos;d written the wrong year for the Treaty of
                Versailles instead of quietly fixing it. That&apos;s when I knew it
                actually read my notes.&quot;
              </p>
              <div className="who">Sofía · IB history</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section id="pricing">
        <div className="wrap">
          <div className="center">
            <div className="kicker">Pricing</div>
            <h2>Free to start. Fair when it counts.</h2>
            <p className="note">Study for your first exam free. Upgrade when entri has earned it.</p>
          </div>
          <div className="plans">
            <div className="plan rise">
              <h3>Notebook</h3>
              <div className="price">$0</div>
              <div className="per">free forever</div>
              <ul>
                <li>50 pages of handwritten capture</li>
                <li>Daily FSRS review, streaks &amp; reminders</li>
                <li>Source citations on every card</li>
                <li className="dim">Exam-date scheduling</li>
                <li className="dim">Ask-your-notes chat</li>
              </ul>
              <Link className="btn btn-s" href="/today">Start free</Link>
            </div>
            <div className="plan featured rise">
              <span className="flag">Exam season</span>
              <h3>Coach</h3>
              <div className="price">
                $8<span style={{ fontSize: 18, fontWeight: 400 }}>/mo</span>
              </div>
              <div className="per">billed monthly · cancel after the exam, no hard feelings</div>
              <ul>
                <li>Unlimited capture, whole-notebook batches</li>
                <li>Exam-date scheduling &amp; readiness report</li>
                <li>Ask-your-notes chat with page citations</li>
                <li>Miss a card → instant explanation from your notes</li>
                <li>AI-suggested cards (always opt-in)</li>
              </ul>
              <Link className="btn btn-p" href="/today">Get exam-ready</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section>
        <div className="wrap">
          <div className="center">
            <div className="kicker">Questions</div>
            <h2>Fair questions.</h2>
          </div>
          <div className="faq">
            <details>
              <summary>Can it really read my handwriting?</summary>
              <div className="a">
                It reads most handwriting well — including messy margins, arrows, and
                formulas. When a word is genuinely illegible, entri flags it for you to
                confirm instead of guessing. You&apos;ll never find a silent wrong guess in
                your cards.
              </div>
            </details>
            <details>
              <summary>How do I know a card isn&apos;t an AI hallucination?</summary>
              <div className="a">
                Every card carries a citation to the exact note and line it came from — tap
                it and see your own handwriting. Anything the AI inferred beyond your notes
                is labeled &quot;AI-inferred,&quot; lives on a sticky note, and stays out of
                your reviews until you accept it.
              </div>
            </details>
            <details>
              <summary>What is FSRS and why should I care?</summary>
              <div className="a">
                FSRS is the open spaced-repetition scheduler that outperforms the
                algorithms in Quizlet-style apps — it&apos;s what serious Anki users
                switched to. It predicts when you&apos;ll forget each card and schedules
                the review just before. entri adds one thing on top: your exam date, so
                intensity ramps when it matters.
              </div>
            </details>
            <details>
              <summary>What happens to my photos?</summary>
              <div className="a">
                Your notes are yours. Photos are stored privately per-account, used only to
                build your cards, and deleting your account purges everything — images,
                cards, and history.
              </div>
            </details>
            <details>
              <summary>Do I need to study every day?</summary>
              <div className="a">
                No — but ten minutes most days beats three hours the night before, and the
                schedule self-heals when you miss a day. The streak is there to encourage
                you, not to punish you.
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="final">
        <div className="wrap">
          <div className="kicker">Your notebook is already written</div>
          <h2>
            Turn it into your <em className="swipe">exam coach</em>.
          </h2>
          <p className="lead" style={{ margin: "18px auto 0", textAlign: "center" }}>
            Photograph one page. See your first cards — with citations — in about a minute.
          </p>
          <div className="cta">
            <Link className="btn btn-p" href="/today">Start studying free</Link>
            <a className="btn btn-s" href="#how">How it works</a>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer>
        <div className="wrap foot">
          <div>
            <a className="lbrand" href="#">
              entri<i>.</i>
            </a>
            <p className="legal">
              Your own notes, taken seriously.
              <br />© 2026 entri.
            </p>
          </div>
          <div className="cols">
            <div>
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#trust">Trust &amp; provenance</a>
              <a href="#exam">Exam mode</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
            <div>
              <h4>Science</h4>
              <a href="#">Why FSRS</a>
              <a href="#">Why citations matter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
