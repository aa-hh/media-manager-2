# How the deletion score learns from keep and delete answers

Linear: [AA-163](https://linear.app/aa-hh/issue/AA-163). Researched 2026-10-15 from primary sources (papers, official docs, project READMEs); no repo code was read. Feeds AA-166 (Score each movie, show and season for deletion, with reasons in plain words), AA-170 (Record every keep, delete and snooze answer on a suggestion) and AA-171 (Learn the deletion score's weights from keep and delete answers). The starting weights are Media Manager 1's (`scripts/lib/processors/deletion.py` in `aa-hh/media-manager`).

## Answer

Bayesian logistic regression with Media Manager 1's score as the prior: a weighted sum of item facts turned into a chance the owner says delete, starting from the old points and moving only as consistent decisions pile up. Refit from every stored decision after each review session (about 70 lines of TypeScript, no dependency). Hard rules stay outside the model. Weights are capped near their starting values, old reasons can't flip sign, and the model falls back to the old score if it does worse over the last 50 decisions. Full steps are under Recommended design; owner decisions are under Open questions.

---

## 1. Candidate approaches and how well they suit tiny data

### 1a. Bayesian logistic regression, with the hand-tuned weights as the prior

- **Model.** P(owner accepts "delete" | item) = σ(w·x). Each weight has a Gaussian prior N(μᵢ, σᵢ²). μᵢ comes from the old points table, and σᵢ sets how far the data can move it.
- **Precedent for this exact setup.** Chapelle & Li's Algorithm 3 is regularised logistic regression with a per-weight Gaussian prior N(mᵢ, qᵢ⁻¹). Each batch, it finds the most likely weights under that prior, then sets `qᵢ += Σ x²ᵢⱼ pⱼ(1−pⱼ)` (the Laplace approximation). The resulting posterior is both the prior for the next batch and the distribution sampled for Thompson sampling. They report the diagonal-Gaussian 95% intervals contained the true click rate 95.1% of the time. ([Chapelle & Li, NIPS 2011](https://proceedings.nips.cc/paper_files/paper/2011/file/e53a0a2978c28872a4505bdb51db06dc-Paper.pdf))
- **Per-example online version.** Microsoft's adPredictor (probit link) keeps a mean and variance per weight. Its update is `μ ← μ + y·x·(σ²/Σ)·v(y·xᵀμ/Σ)` and `σ² ← σ²·[1 − x·(σ²/Σ²)·w(·)]` with `Σ² = β² + Σx²σ²` (eqs. 6–9, §3.3.1).
  - The paper notes three useful properties. Surprising examples move weights more. Each weight's learning rate is σᵢ²/Σ. Variance only ever shrinks.
  - §3.3.3 adds "dynamics": the likelihood of past data is raised to the power (1−ε) per unit of time, which pulls weights back toward the **prior** (not toward zero) as data ages (eqs. 13–15). This is directly reusable as a forgetting mechanism. ([Graepel et al., ICML 2010](https://icml.cc/Conferences/2010/papers/901.pdf))
- **Fit for this app: best.**
  - Day one is exactly the old score, recalibrated as a probability.
  - Each weight keeps a named meaning, so explanations stay simple.
  - Uncertainty comes free and drives the confidence display and exploration.
  - With ~15 features and ≤ a few thousand rows, a **full refit from all stored decisions** (Newton's method) takes milliseconds. That beats sequential online updates for this app: undo and reset become exact, decision order doesn't matter, and the full covariance is affordable. The diagonal approximation exists for 2²⁴-feature ad models, not for 15.
- **Prior strength.** Gelman et al. show that a weakly informative prior on rescaled inputs keeps logistic regression stable, including under complete separation (when one feature perfectly splits the labels), which is common with few rows. ([Gelman et al. 2008, arXiv 0901.4011](https://arxiv.org/abs/0901.4011)) Here the prior is *strongly* informative on purpose, because it encodes the hand-tuned score.

### 1b. Pairwise preference learning (Bradley–Terry / RankNet)

- **What it is.** Bradley–Terry with a linear scorer means P(A deleted before B) = σ(w·(x_A − x_B)), which is logistic regression on feature differences.
  - RankNet uses the same cross-entropy-on-pairs cost with a neural scorer. ([Burges, MSR-TR-2010-82](https://www.microsoft.com/en-us/research/?p=159784))
  - Joachims built preference pairs from logs ("clicked > skipped above it") because people's judgements are relative, not absolute. ([Joachims, KDD 2002](https://www.cs.cornell.edu/people/tj/publications/joachims_02c.pdf))
  - Fitting algorithms for the general family: [Hunter, Annals of Statistics 2004](https://projecteuclid.org/journals/annals-of-statistics/volume-32/issue-1/MM-algorithms-for-generalized-Bradley-Terry-models/10.1214/aos/1079120141.full).
  - adPredictor's update is a special case of TrueSkill, the Bayesian pairwise rating system ([Graepel et al. §3.3](https://icml.cc/Conferences/2010/papers/901.pdf)). So the Bayesian machinery from 1a covers pairs as well.
- **Fit: good add-on, not a separate system.**
  - The owner's yes/no threshold moves with disk pressure: near the cap he accepts more deletes. A pair taken from one review session ("deleted A, kept B, same day") cancels that shift.
  - The same `fit()` code takes pair rows: x = x_A − x_B, y = 1, and the intercept drops out.
  - An explicit "which of these two goes first?" prompt is optional. It costs owner attention, so use it rarely.

### 1c. Contextual bandits (Thompson sampling, LinUCB)

- **LinUCB.** It ranks by the mean plus an uncertainty bonus. It was built for Yahoo news with 33M events. ([Li et al. 2010, arXiv 1003.0146](https://arxiv.org/abs/1003.0146))
- **Thompson sampling.** It ranks by one random draw from the posterior. A practical guide: [Russo et al. tutorial, arXiv 1707.02038](https://arxiv.org/abs/1707.02038).
  - Chapelle & Li found Thompson sampling degrades less than UCB when feedback arrives late and in batches (Table 1, Fig. 5). Our feedback arrives in review sessions, which is batched.
  - Shrinking the posterior spread (α = 0.5) reduced regret in short horizons (§3, §4).
- **Fit: use the idea, skip the framework.** This is supervised learning of the owner's preference plus a little deliberate exploration. It isn't a reward-per-pull problem. Use the posterior from 1a to pick a few borderline items on purpose (§4). Don't randomise the whole list: suggestions that look random cost trust.

### 1d. Per-feature weight nudging (perceptron-style)

- **What it is.** On each disagreement, move the weights by a step in the direction of the owner's choice.
- **Fit: poor.**
  - The step size is arbitrary.
  - There's no uncertainty, so no confidence display and no principled exploration.
  - One rash click moves weights as much as a considered one.
  - A Bayesian refit is about the same amount of code and has none of these problems.

### 1e. Gradient-boosted trees

- **Why probably not.**
  - LightGBM's default `min_data_in_leaf` is 20 ([docs](https://lightgbm.readthedocs.io/en/latest/Parameters.html)). With 200 decisions that allows roughly ten leaves in total.
  - The hand-tuned score can only enter as a fixed starting offset (`init_score`), not as a belief about each feature that data can revise.
  - Monotone constraints exist, but explanations become path-dependent.
  - It would need a dependency.
  - Revisit only at thousands of decisions.

### 1f. Survival / hazard models ("chance anyone plays this in the next N months")

- **Why it's different.** It answers a different question (will someone watch?) and learns from **Plex play history**, which is far larger than the decision log (thousands of plays a year for 4 users versus tens to hundreds of decisions).
- **Precedent.** Kapoor et al. used a Cox proportional-hazards model to predict when users return, and found it beat regression and classification baselines, partly because it handles censoring ([KDD 2014 talk](https://new.videolectures.net/videos/kdd2014_kapoor_user_return_time)). "Censoring" means items not yet watched, whose outcome is still unknown. Censoring basics: [lifelines docs](https://lifelines.readthedocs.io/en/latest/Survival%20Analysis%20intro.html).
- **Cheapest form.** Discrete-time survival analysis is logistic regression on "item-month" rows (did anyone start it in month t, given not before?). ([Singer & Willett 1993](https://doi.org/10.3102/10769986018002155)) That reuses the same `fit()` code. Weibull or Cox fits need more code and buy little at this scale. Rewatches of movies are rare in a 4-person household, so model "first play by anyone" and "next episode play" rather than rewatch gaps.
- **Fit: good as an input feature in phase 2.** Not as the decision model, because the owner keeps things for reasons other than predicted viewing.

### Recommendation

Use **Bayesian logistic regression with the old score as the prior, refit from all stored decisions**.

- Add same-session pairs as extra rows when ready.
- Add a discrete-time "chance of a play in 6 months" model as a feature in phase 2.
- Exploration comes from the posterior and is limited to a few labelled places in the list.

---

## 2. Turning raw signals into features

General rules:
- Snapshot each item's features **at decision time** and train on the snapshot, never on today's values.
- Scale each feature to roughly 0–1 so the prior widths are comparable ([Gelman et al. 2008](https://arxiv.org/abs/0901.4011) rescale to sd 0.5 for the same reason).

| Feature | Encoding | Prior mean source |
|---|---|---|
| Space actually freed | `log2(bytes freed)` scaled to 0–1 over the library's range. Bytes freed is 0 if a hardlinked torrent copy keeps seeding ([TRaSH hardlinks guide](https://trash-guides.info/File-and-Folder-Structure/Hardlinks-and-Instant-Moves/)). Log because 2→4 GB matters more than 40→42 GB for "worth bothering". | old size points (25) |
| Nobody started it | 0/1 | old 30 pts |
| Started, nobody passed 25% | 0/1 (exclusive with the row above) | old 20 pts |
| Requester never started it | 0/1 (0 if not requested) | old 20 pts |
| Inactivity | `min(weeks since last play by anyone, or since added, − 13, 78) / 78` | old 0.5 pt/week → 39 pts at cap |
| Inactivity × on a watchlist | product of the two | −0.75 × inactivity weight (the old ×0.25 rule) |
| Low rating | `max(0, 7 − TMDB) / 4`, capped at 1 | old 10 pts |
| Easy to re-download | `log1p(seeders of a release matching the quality profile)`, scaled; cache weekly, since searches hit indexers | 0 mean, positive expected; wide |
| Show still airing (if soft) | 0/1 | negative, moderate |
| Resolution/quality tier | 4K or remux = 1 | 0 mean |
| Popularity | log TMDB popularity, scaled | 0 mean |
| Household genre affinity | max over users of a shrunken per-user genre play share (§6) | negative, moderate |
| Type | is season (vs movie) | 0 mean |
| Disk pressure at decision time | used/cap | positive; shifts the threshold only, so it doesn't change ranking at a given moment |
| (phase 2) Chance of a play in 6 months | from the survival model | negative; may later replace inactivity |

**Decay.** The old linear "per week after 90 days" term is kept so the prior maps one-to-one. Recency decay is standard in recommender research ([Koren, KDD 2009](https://dl.acm.org/doi/10.1145/1557019.1557072)). In phase 2 the survival estimate gives a data-driven curve instead of a hand-picked slope.

**Per-user watch propensity** (how likely a user is to watch something):
- Per user: share of their plays in this genre, and how often they finish what they start.
- Combine as "max over users" (does anyone like this?) and "requester's value".

---

## 3. Feedback beyond button clicks

Implicit signals are biased and relative ([Joachims et al., SIGIR 2005](https://www.cs.cornell.edu/people/tj/publications/joachims_etal_05a.pdf)), so give them weights rather than full labels. Hu, Koren & Volinsky's confidence weight `c = 1 + α·r` is a precedent for weighting evidence by strength ([ICDM 2008](http://yifanhu.net/PUB/cf.pdf)).

| Event | Label | Weight | When |
|---|---|---|---|
| Delete accepted | 1 | 1.0 | immediately |
| Keep | 0 | 1.0 | immediately |
| "Delete in 2 weeks" | 1 | 1.0 | immediately. If the owner cancels during the 2 weeks, replace with 0. If someone plays it but the owner lets it go, leave as 1. |
| Snooze | no row | – | the owner's next decision on that item counts. Store the snooze for evaluation only. |
| Deleted item re-requested or re-downloaded within 12 months | flip that decision to 0 | 1.0 | when it happens. After 12 months, treat it as changed taste and add nothing. |
| Kept item later played by anyone within 6 months | keep the 0, raise weight to 1.5 | 1.5 | when it happens |
| Kept item not played for 12 months | **no change** to the owner model | – | the survival model learns from it. Optionally re-show the item. |
| Owner deletes an item from the library view that wasn't suggested | 1 | 0.5 | self-selected, see §4 |
| Owner marks "protect" | becomes a hard rule; also a 0 row | 1.0 | – |
| Item never shown | none | – | – |

**Waiting before labelling.** Chapelle's delayed-feedback model handles outcomes that arrive up to a month late ([KDD 2014](https://doi.org/10.1145/2623330.2623634); I only read the abstract and secondary descriptions). The scheme above avoids the problem: only *events* change labels (re-request, cancel, play). "Nothing happened" never creates a row, so no waiting window is needed.

**Ageing.** Weight each row by 0.5^(age / 18 months). This is the refit form of adPredictor's (1−ε)-per-unit-time forgetting toward the prior ([§3.3.3](https://icml.cc/Conferences/2010/papers/901.pdf)).

---

## 4. Selection bias

**What's actually biased.**
- The app chooses what to show using only the item's features, and the model also conditions on those features. So owner verdicts on shown items are not biased *given the features*.
- The real problem is gaps: feature regions the app never shows (items it thinks are obvious keeps) never get labels, and there the prior is all you have.
- Owner-initiated deletes are self-selected on knowledge the features don't hold. That's the missing-not-at-random case in [Schnabel et al., ICML 2016](https://arxiv.org/abs/1602.05352), and the reason for weight 0.5 above.

**Fixes, in order of value.**
1. **Exploration.** Reserve 1 of every ~10 suggestion places for an item drawn uniformly at random from the borderline band (predicted 0.3–0.7) or the high-uncertainty band, and label it "not sure, what do you think?". Then the chance of being shown is known exactly: places ÷ band size. Store it with the decision.
2. **Uncertainty sampling.** Picking where the model is least sure is the standard active-learning move for getting the most from few labels ([Settles survey](https://burrsettles.com/pub/settles.activelearning.pdf)).
3. **Inverse propensity weighting, for evaluation.** Weight each decision by 1 / (chance it was shown). This makes offline estimates unbiased ([Joachims et al. 2017, arXiv 1608.04468](https://arxiv.org/abs/1608.04468); [Schnabel et al.](https://arxiv.org/abs/1602.05352)).
   - Clip weights (e.g. ≤ 10) or self-normalise them, because raw weights overfit ([Swaminathan & Joachims, NeurIPS 2015](https://papers.nips.cc/paper/2015/hash/39027dfad5138c9ca0c474d71db915c3-Abstract.html)).
   - Replay evaluation of a new ranking rule needs these randomised logs ([Li et al. 2011, arXiv 1003.5956](https://arxiv.org/abs/1003.5956)).
   - For training, plain refits are fine. Don't apply these weights to training at this data size: they add variance without fixing the gap problem.

---

## 5. Keeping it trustworthy

- **Explanations from the weights.** Each feature's push toward "delete" is `wᵢ·(xᵢ − refᵢ)`, where ref is a typical kept item's value. Show the top three as fixed sentences ("big: 58 GB freed", "nobody has played it in 14 months", "requester never started it"). Linear models explain exactly this way ([Molnar, Interpretable ML, linear models](https://christophm.github.io/interpretable-ml-book/limo.html)).
  - Keep it to three. In a 3,800-person study, showing a transparent model's full internals made people *worse* at catching its big mistakes ([Poursabzi-Sangdeh et al., arXiv 1802.07810](https://arxiv.org/abs/1802.07810)).
- **Confidence.**
  - Predictive variance: `v = xᵀΣx`.
  - Displayed probability: `σ(μ / √(1 + πv/8))`, the standard probit approximation ([Bishop, PRML §4.5.2](https://www.microsoft.com/en-us/research/publication/pattern-recognition-machine-learning/)).
  - Show "sure / fairly sure / not sure" from whether the interval crosses 0.5.
- **Rash clicks.**
  - (a) Prior strength: the hand-tuned score counts as about 40 decisions (formula in §9).
  - (b) Hard cap: each weight is clamped to μᵢ ± 2σᵢ.
  - (c) Sign lock: the old features can't flip sign. "Nobody watched" can never argue for keeping.
- **Drift guard.** Track the learned model's log loss on its last 50 decisions against the hand-tuned score on its own, using the same decisions. If the learned model is worse, fall back to the prior and tell the owner. Log loss measures how surprised the model was by actual answers, so lower is better.
- **Undo and reset.** Decisions are rows, and the model is a deterministic refit. Undo marks a row undone and refits. Reset ignores all rows. Snapshot weights per refit for history.
- **"The model now weighs X more because you kept Y."** Refit with and without that decision and show the weight with the biggest change. It's exact and cheap at this size.
- **Give the owner some control.** People keep using an imperfect algorithm when they can adjust it, even slightly ([Dietvorst, Simmons & Massey, Management Science 2018](https://marketing.wharton.upenn.edu/wp-content/uploads/2020/07/Dietvorst-Overcoming-Algorithm-Aversion.pdf)).
  - Explain-then-correct loops raised users' understanding by 52% and roughly doubled how efficiently they fixed mistakes ([Kulesza et al., IUI 2015](https://openaccess.city.ac.uk/id/eprint/13819/)).
  - People label which *feature* matters much faster than they label examples ([Raghavan, Madani & Jones, JMLR 2006](https://jmlr.org/papers/v7/raghavan06a.html)). That supports reason chips.
  - General guidance on people-in-the-loop learning: [Amershi et al., AI Magazine 2014](https://ojs.aaai.org/aimagazine/index.php/aimagazine/article/view/2513).

---

## 6. Cold start and multiple users

- **Day one.** Prior only: the old score converted to a probability. Everything shows "not sure" until enough decisions arrive.
- **Who decides.** Only the owner decides, so there's **one household decision model**. Per-user models have no labels to learn from.
- **Where the 4 users come in.** Through watch features:
  - Per-user genre share, pulled toward the household share: `(user plays in genre + k·household share) / (user plays + k)`, with k ≈ 20.
  - This is partial pooling from hierarchical models ([Gelman et al., BDA3 ch. 5](http://www.stat.columbia.edu/~gelman/book/)). A light watcher looks like the household until their own history says otherwise.
- **If deciders multiply later.** Add a per-decider offset with a shared prior.
- **Movies vs seasons.** Start with one model plus an "is season" feature. If they diverge, give seasons their own weights with a prior centred on the shared weights (the same hierarchical idea).

---

## 7. Evaluating with little data

- **Score each decision before learning from it.** At show time, store the model version and its predicted probability. Every decision is then an honest test case.
- **Main metric.** Compare against the hand-tuned score on its own, on the same decisions:
  - mean log loss
  - agreement rate (model said ≥ 0.5 and owner deleted, or < 0.5 and owner kept)
  - Count the decisions where only one of the two was right. That shows which one wins far more clearly than the two overall rates.
- **Expected noise.** At 100 decisions and 80% agreement, the 95% interval is about ±8 points. Expect a clear signal after 100–200 decisions, not 20.
- **Calibration.** Use a 3–5 bin reliability check (predicted vs actual delete rate).
  - Below ~1000 samples, prefer sigmoid (Platt) over isotonic recalibration.
  - A lower Brier score alone doesn't prove calibration. ([scikit-learn calibration guide](https://scikit-learn.org/stable/modules/calibration.html))
- **Outcome metrics.**
  - Re-requests per 100 deletes (lagging).
  - GB freed per review session.
  - Share of exploration items the owner deleted.
  - Acceptance rate alone can be gamed by suggesting less, so always pair it with GB freed.

---

## 8. Prior art

**\*arr cleanup tools: none of them learn (README check, Oct 2026).**
- [Maintainerr](https://github.com/jorenn92/Maintainerr): AND/OR rules over Plex/Jellyfin/Emby/\*arr/Seerr/Tautulli properties. Has manual include/exclude, a "leaving soon" collection with a grace period, and actions including quality-profile changes. Exclusions are one-off overrides, not training signals.
- [Janitorr](https://github.com/Schaka/janitorr): age from grab history, or last watch via Jellystat/Streamystats. Has `janitorr_keep` tag exclusions, disk-threshold deletion, and season-by-season removal. The README doesn't mention seeding or hardlink checks.
- [Deleterr](https://github.com/rfsbraz/deleterr): watch/age/streaming-availability criteria, exclusions by genre/actor/collection/JustWatch/Trakt, and a "Leaving Soon" step.
- [MediaReducer (aquilaelabs)](https://github.com/aquilaelabs/MediaReducer): a fixed 0–100 keep score blending watch history with vote-weighted IMDb rating.
  - It shifts weight toward watch history once there's enough history.
  - Bigger files go first among near-ties.
  - It has a TV season episode cap and threshold-triggered deletion.
  - It does not learn from keep/delete feedback.

**Consumer products.**
- [iOS Offload Unused Apps](https://support.apple.com/en-za/guide/iphone/iph47c931112/ios) removes apps by usage but keeps their data, because they can be re-downloaded. That's the same logic as the "easy to re-download" feature.
- [Google One storage manager](https://one.google.com/about/articles/maximize-cloud-storage-with-google-one) groups large files, blurry photos and screenshots, and leaves selection to the user.
- [YouTube "Not interested → Tell us why"](https://support.google.com/youtube/answer/6342839) is a reason prompt after a negative action. Feedback is stored and can be deleted wholesale in My Activity, which parallels the reset in §5.
- [Netflix ratings](https://help.netflix.com/en/node/9977) use three levels ("Not for me / I like this / Love this!").
- None of them publish how feedback changes the model.

**Research.**
- Bergman et al. (CHI 2009, [DOI](https://doi.org/10.1145/1518701.1518745)): 81% of 96 participants found *demoting* low-value files easier than deleting them. The media analogue is shrinking to a lower-quality copy instead of deleting.
- Digital hoarding work ties reluctance to delete to anxiety and expected future use ([Sweeten et al. 2018](https://researchportal.northumbria.ac.uk/en/publications/digital-hoarding-behaviours-underlying-motivations-and-potential-/)).
- I found no published system that learns deletion recommendations from keep/delete feedback. Absence in my searches is not proof none exists.

---

## 9. JS/TS implementation notes

**Dependencies.** None needed.
- `ml-logistic-regression` 2.0.0: last release May 2020, ~14 KB, depends on `ml-matrix` (~1.1 MB unpacked). Its documented options are only `numSteps` and `learningRate`: no prior means, no row weights, no uncertainty. Not useful here.
- The math below is about 70 lines.

**Turning the old score into the prior.**
- The old score S is a sum of points. Map it to log-odds: `logit p = a + b·S`.
- With the anchors S=45 → p=0.5 and S=70 → p=0.85, b = 1.735/25 ≈ 0.069 and a ≈ −3.12. The anchors are for the owner to confirm.
- Each old feature, scaled 0–1 of its max points Pᵢ, gets μᵢ = b·Pᵢ. Examples: size 1.73, nobody started 2.08, requester never started 1.39, low rating 0.69.
- **Prior width from "how many decisions the prior is worth" (N₀).**
  - Formula: `σᵢ = 1 / √(N₀ · 0.25 · mean(xᵢ²))`.
  - N₀ = 40 with mean(x²) ≈ 0.3 gives σ ≈ 0.58.
  - New features get μ = 0 with the same σ.
- **Caps.** `lo = μ − 2σ` and `hi = μ + 2σ`. For old features, floor lo at 0 so the sign can't flip.

```ts
// learner.ts: Bayesian logistic regression, Gaussian prior, Laplace posterior.
// x[0] = 1 is the intercept. Refit from all decision rows; ~15 features, ms per fit.
export type Row = { x: number[]; y: 0 | 1; weight: number };
export type Prior = { mean: number[]; sd: number[]; lo: number[]; hi: number[] };
export type Model = { mean: number[]; cov: number[][] };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

function cholesky(A: number[][]): number[][] {
  const n = A.length, L = A.map(r => r.map(() => 0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j];
    }
  return L;
}
function cholSolve(L: number[][], b: number[]): number[] {
  const n = L.length, y = Array(n).fill(0), x = Array(n).fill(0);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}

export function fit(rows: Row[], prior: Prior, maxIter = 30): Model {
  const d = prior.mean.length;
  let w = prior.mean.slice(), L: number[][] = [];
  for (let it = 0; it < maxIter; it++) {
    const g = w.map((wi, i) => (wi - prior.mean[i]) / prior.sd[i] ** 2);
    const H = w.map((_, i) => w.map((_, j) => (i === j ? 1 / prior.sd[i] ** 2 : 0)));
    for (const r of rows) {
      const p = sigmoid(dot(w, r.x)), c = r.weight * p * (1 - p);
      for (let i = 0; i < d; i++) {
        g[i] += r.weight * (p - r.y) * r.x[i];
        for (let j = 0; j <= i; j++) H[i][j] += c * r.x[i] * r.x[j];
      }
    }
    for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) H[j][i] = H[i][j];
    L = cholesky(H);
    const step = cholSolve(L, g);
    w = w.map((wi, i) => wi - step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  w = w.map((wi, i) => Math.min(prior.hi[i], Math.max(prior.lo[i], wi))); // hard cap
  const cov = w.map((_, i) => cholSolve(L, w.map((_, j) => (i === j ? 1 : 0))));
  return { mean: w, cov };
}

export function predict(m: Model, x: number[]) {
  const mu = dot(m.mean, x);
  const v = x.reduce((s, xi, i) => s + xi * dot(m.cov[i], x), 0);
  return { p: sigmoid(mu / Math.sqrt(1 + (Math.PI * v) / 8)), sd: Math.sqrt(v) };
}

export function explain(m: Model, x: number[], ref: number[], names: string[]) {
  return names.map((name, i) => ({ name, push: m.mean[i] * (x[i] - ref[i]) }))
    .sort((a, b) => Math.abs(b.push) - Math.abs(a.push)).slice(0, 3);
}
```

**Building rows from decisions.**
- `weight = labelWeight × 0.5 ** (ageDays / 548)`.
- Pair rows: `x = xA − xB` with `x[0] = 0` and y = 1. Give each of k pairs from one session weight 1/k.
- A Thompson draw for exploration is `mean + chol(cov)·z` with z standard normal (Box–Muller).

**Per-decision online alternative.** adPredictor eqs. 7–8 ([paper](https://icml.cc/Conferences/2010/papers/901.pdf)), with v(t) = N(t)/Φ(t) and w(t) = v(t)(v(t)+t). Use it only if refits ever become too slow, which they won't at this scale.

**SQLite.**
- `decision`: id, item_id, kind, action, label, label_weight, decided_at, session_id, features_json, model_version, predicted_p, rank_shown, was_exploration, shown_probability, disk_used_frac, reason_chip, undone_at.
- `decision_event`: decision_id, event (re_requested | played | cancelled), at.
- `model_snapshot`: version, mean_json, cov_json, n_rows, fitted_at, log_loss_recent, prior_log_loss_recent.

---

## Recommended design

Terms used below:
- **Prior:** what the model believes before seeing any of your decisions.
- **Posterior:** what it believes after.
- **Logistic regression:** a weighted sum of item facts turned into a 0–100% chance.
- **Log loss:** a score for how surprised the model was by your actual answers. Lower is better.
- **Calibration:** whether "70% likely" turns out right about 70% of the time.

1. **Hard rules first, outside the model, never learned.** Filter out anything that fails:
   - tracker seeding minimums
   - "frees no space": the library copy is hardlinked to a torrent still seeding, so deleting one copy frees nothing
   - someone mid-watch
   - inside the 30-day grace period
   - marked "protect"
   - (owner's call) show still airing

   Hard-ruled items are never shown and never become training rows.
2. **Features.** Use the ~14 facts in §2. Measure size as *space that would actually be freed*. Save a copy of each item's facts at the moment the owner decides.
3. **Model.** One household model predicts "chance the owner says delete". It starts as the old score converted to a chance: 45 points ≈ 50%, 70 points ≈ 85%. The old score counts as if the owner had already made about 40 decisions, so it takes many consistent choices, not one click, to shift it.
4. **Update rule.** After each review session, refit from every stored decision. Older decisions count half after 18 months. Each weight is held within a set range of its starting value, and old reasons can never flip sign.
5. **Ranking.**
   - Hard rules, then sort by chance of delete, ties broken by space freed.
   - About 1 in 10 places goes to a "not sure, what do you think?" item, picked at random from the borderline cases. The app records that it was picked at random.
6. **Labels.**
   - delete = yes
   - keep = no
   - delete in 2 weeks = yes, turning to no if the owner cancels
   - snooze = no answer yet
   - re-requested within 12 months after a delete = turns that decision into a no
   - kept and then played within 6 months = the keep counts 1.5×
   - owner deletes something not suggested = yes, at half weight
7. **Safeguards.**
   - Every decision can be undone, and that refits the model.
   - "Reset learning" returns to the old score.
   - If the learned model does worse than the old score over its last 50 decisions, it switches itself back to the old score and says so.
   - A "what changed" line names the biggest weight shift and the decision that caused it.
8. **What each card shows.**
   - Three plain reasons from the biggest contributions, for example "58 GB freed · nobody has played it in 14 months · requester never started it".
   - A confidence word: sure / fairly sure / not sure.
9. **What the UI must collect.**
   - The action.
   - An optional reason chip on keep and snooze: *still want to watch it*, *someone else watches it*, *hard to get again*, *part of a collection/favourite*, *too soon*, *size doesn't matter for this*.
   - Session id, list position, whether it was a "not sure" pick, and the disk-usage level at the time.
   - Chips are first stored and shown in a monthly summary. Only *hard to get again* and *too soon* feed the model (as small nudges to those features), until enough are collected to judge the rest.
10. **Phase 2.**
    - Add a "chance anyone in the house plays this in the next 6 months" estimate learned from Plex history, using the same code on item-month rows.
    - Add same-session pairs ("deleted A, kept B") as extra rows, so changing disk pressure doesn't confuse the model.
11. **Checking it works.**
    - Every suggestion stores the model's prediction at the time shown.
    - Monthly, compare the model with the old score on the same decisions: agreement, log loss, a 3–5 bin calibration check, and re-requests per 100 deletes.
    - Expect a trustworthy signal after 100–200 decisions.

## Open questions for the owner

1. Should the model predict "would I approve deleting this" (recommended, with predicted viewing as one input), or "will anyone watch this"?
2. Calibration anchors: does 45 points ≈ "coin flip" and 70 ≈ "85% sure delete" match your sense of the old thresholds?
3. How heavily should the old score weigh: about 40 of your decisions, more, or less? And how far should any weight be allowed to drift (±2 widths proposed)?
4. Snooze: "ask me later, learn nothing" (proposed), or a weak "keep"?
5. Re-request after a delete: is 12 months the right window, and should it fully reverse the decision?
6. Are you OK with about 1 in 10 suggestions being labelled "not sure" picks chosen partly at random?
7. Show still airing: hard rule or just a strong reason to keep?
8. Sort order when disk is near the cap: by chance of approval, or by space freed × chance of approval?
9. Is the reason-chip list right? Which chips should change the model, and which should only protect that one item?
10. Should anyone else's actions count (for example a household member pressing "keep" on a "leaving soon" item), or only yours?
11. Seasons and movies: one model from the start (proposed), or separate weights from day one?
12. Add a "shrink" option (swap to a smaller quality) alongside delete? Bergman et al. found demoting easier than deleting, and Maintainerr already offers quality-profile changes.