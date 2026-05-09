# Physical Card Playability Analysis - 2026-05-07

## Goal

Last Hand Standing should work cleanly as a tabletop card game, not only as a browser game. The web prototype can automate timing, hidden state, and logging, but the physical rules should avoid hidden bookkeeping and temporary exceptions where possible.

## Current Physical Sticking Points

- Opening damage caps were awkward in physical play because players had to remember a special round-limited exception. They have been removed.
- Events are now mixed into the main deck after starting hands. This removes the extra event pile and round-start timing step.
- Reload is now physical-friendly because it no longer searches a discard pile for the strongest weapon.
- Debug hand snapshots, logs, and bot strategy are digital-only. They should not be part of printed rules.
- Pass-device privacy is digital-only. Physical play naturally uses hidden hands and table talk, so the rulebook should not reference pass-device behavior.
- Current event summaries are UI-only. Physical play should announce drawn events, resolve them immediately, and discard them.
- Tiebreakers need to be simple. Current recommendation: most eliminations, then pre-effect health, then hand size.
- Notifications/toasts are digital-only. Physical play should rely on explicit verbal announcements: damage taken, cards stolen, forced discard, elimination, and current event.

## Cards And Effects

- Minigun at 2 damage is easy to resolve physically: every other living player loses 2 health, no target chosen.
- Ricochet is playable physically but needs a clear verbal sequence: defender plays Ricochet, chooses the new target, then that target takes the redirected attack damage. Current implementation does not open a second defense window for that target.
- Grenade splash is physical-playable if the table has a fixed clockwise seating order. The rule should explicitly reference seating order.
- Backfire is physical-playable: cancel the incoming damage, attacker takes that same amount.
- Black Market is probably too costly for physical play as written because it asks for 2 discarded cards and 1 action just to keep 1 of 3. It should be rebalanced before printing.

## Table Components

- Main deck
- Main discard pile
- Event discard pile
- Player health trackers
- A visible first-player marker if rounds remain

## Recommendations

- Keep the current web prototype as the rules testbed, but mark digital-only features clearly in docs.
- Keep opening damage caps out of the printed rules.
- Add a printed-rules pass that removes web terms such as log, debug snapshots, bot levels, and pass-device mode.
- Before print testing, create a physical turn reference card covering turn actions, reaction timing, elimination loot, round cleanup, and event draw timing.
