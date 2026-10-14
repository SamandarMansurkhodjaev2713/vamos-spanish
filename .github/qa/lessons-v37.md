# Daily lessons — v6.22

The 30-day program remains about 35 minutes with assigned review, about 30 without it. The day plan now exposes the ordered program; videos, detailed teaching notes and progress records are folded. Main lessons retain one active task per screen and show the day and current task type. Original sentence recordings and 0.5× playback remain unchanged.

## Corrected teaching issues

- All 30 practice directions ask learners to listen before checking a translation; they no longer reveal the listening answer in advance.
- All 30 first gap hints guide meaning/grammar without naming the missing Spanish word. The full model is a separate disclosure.
- Second oral attempts have a specific changed condition in 28 ordinary days; special days 26/30 retain their bounded tasks.
- Days 1, 11 and 25 now align first attempts and criteria with their actual goals. Five optional second quizzes have explicit model support; four text-only models clearly say they have no exact recording. Help is tagged as assistance.

## Corrected functional issues

Daily sessions in days 22–23 previously kept the captured old topic after the branch label changed. Day 24 had the same issue when selecting a recovery topic. A shared switch now synchronizes the session's actual source, stops old playback and resets only current preparation. Original completed days, card schedules and history remain intact.

On small screens the disabled oral completion button did not explain the required self-rating below the fold. A visible action now focuses that rating without selecting an answer or granting completion. The day/task label wraps correctly at 320px with large text. Finished microphone recordings remain visible for playback and comparison.

## Five review lenses

1. Clear next step: visible daily phases, one active main exercise and explicit oral completion requirement.
2. Density/readability: main plan first, optional sources folded; adult palette and fonts preserved.
3. Navigation/return: answer selection retains scroll; topic changes and reload restore the actual source; previewing another day does not replace the active session.
4. Correct learning/progress: independent review of all 60 authored quizzes, all 30 generated gaps and 120 active dialogue variants. Assistance and oral self-rating do not certify pronunciation or CEFR.
5. Mobile accessibility: independent 39-state browser review at 320px large text, 390px and 1440px, followed by bounded confirmation of the corrected states. Physical phones and Safari were not tested.

## Verification

- `check-lesson-content-v33.cjs`: 60 quiz keys, 120 exact voice captions, 150 grading modes, recovery mappings and workshop structures.
- `check-lesson-flow-v33.cjs`: 150 real rendered main tasks across 30 days; stable answer scroll, exact audio help, preserved progress and separate listening screens.
- `check-lesson-topics-v37.cjs`: 18 source-switch/reload cases, 60 introduction/oral screens and microphone recording machinery with a synthetic test device, never personal audio.
- `check-lesson-ux-v37.cjs`: 90 read-only day previews, three accessible oral action links and five supported optional quizzes with aid tracking.
- Daily journey at three widths passed lesson → finite conversation → own response → saved day.
- Daily-plan 12 groups, lesson-help 180 combinations, guidance independent witnesses, studio 21 groups and cross-tab persistence 28 groups passed.

Tests establish behavior in these bounded scenarios. They do not establish learning efficacy, live pronunciation scoring or guaranteed levels. The synthetic microphone checks recording controls, not a learner's speech.
