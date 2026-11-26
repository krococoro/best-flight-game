# Kestrel Post — Island Mail Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/krococoro/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/krococoro/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete, original flight game that runs offline in a desktop browser from its own
static files — no library, no network request, no build step.

You fly the Kestrel K-1, a cream-and-teal mail plane, on one golden-hour sortie.
Roll down the home strip, lift off, and thread eight glowing rings over a patchwork
island — throttle and bank discipline keep you fast without stalling — then descend
to the far strip and put the mail down gently, with fuel to spare. Hard arrivals bend
the gear; the rough country off the strips ends the sortie. A full instrument panel
(attitude, airspeed, altimeter, vertical speed, RPM, fuel and throttle quadrant) and a
heading ribbon with an objective bug keep you oriented, and every sound — engine,
wind, ring chimes — is synthesised with WebAudio. No audio files.

Controls: SHIFT / CTRL throttle, W/S or ↑/↓ pitch, A/D or ←/→ bank, B or SPACE brake,
P pause. Title, pause and sortie-report screens, best score kept between visits.

Play it: `python3 -m http.server 8080 --directory game`, then open http://localhost:8080. MIT licensed.
