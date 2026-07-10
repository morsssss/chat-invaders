# Cat Invaders — Spec

## Concept
Space Invaders, reskinned with cats. Purely a visual demo for a dev video — no tutorial, no explanation needed, just needs to read instantly as "oh, Space Invaders" within a second of watching.

## Tech
- Simple build process. It's ok to use React if that's useful.
- All code is in JavaScript.
- Minimal CSS required to make it look nice.

## Assets
- Images to use are currently in `public/images`. It's ok to move these. It's also ok to shrink them down to fit in the game.
- Sounds to use are currently in `public/sounds`.
- The enemy images can be a combination of cat-plain.png, cat-with-tie.png, and cat-who-codes.png.
- When an enemy cat gets hit, we use the meow sound at sounds/meow.mp3.

## Theme / fiction
- Player: a cat defending its home, shooting little fish upward.
- Enemies: a grid of alien invader cats descending from space.
- No plot beyond that — it's decorative.

## Visuals
- Dark background with a simple scrolling/twinkling starfield.
- The player cat should be a pixellated image (like 15 squares maximum in any direction) resembling the ones at https://www.newgrounds.com/art/view/stannco/garfieldrpg-garfield-sprites .
- Player cat sprite fixed near the bottom, moves left/right.
- Enemy cats arranged in a grid (e.g. 5 columns x 4 rows), same emoji repeated or 1-2 emoji variants for visual variety.
- When an enemy cat gets hit, it meows and flies off the screen
- On-screen score (top-left) and lives (top-right), rendered as plain text.
- The game area is in a container with a 10px margin on each side.
- When a player loses a life, it rotates around, stopping upside-down. One-second pause. Then we return to the "LET'S GO" moment.

## Core mechanics
- Before each round starts, the message "LET'S GO!" appears in the center of the playable area for two seconds. Then the game begins.
- Enemy grid moves side-to-side as a block. Once any cat in the block hits the edge, the whole block steps down and reverses direction (classic Space Invaders movement).
- Enemies occasionally fire back (simple downward projectile, random enemy, random interval).
- Player fires fish upward on input. Multiple fish can be on screen simultaneously. Basic cooldown so it can't be held down for a laser.
- Collision: player bullet + enemy = enemy destroyed (meow + flies off screen) + score increment; enemy bullet + player = lose a life.
- Losing a life does not reset the enemy grid — enemies stay wherever they are, only the player resets (rotate animation, pause, "LET'S GO!").
- If any enemy reaches the player's row, it's an immediate Game Over (same as running out of lives).

## Controls
- Left / Right arrow keys: player moves left and right.
- Spacebar: shoot.
- Small control on the bottom that toggles sound on and off.
- Small control on the bottom that pauses/resumes the game (freezes everything, including timers and animations).
- Responsive layout: the canvas scales to fit any viewport width (mobile phones included) while keeping its aspect ratio.
- On touch devices (detected via `pointer: coarse`, not screen width), on-screen buttons appear overlaid on the bottom of the canvas: left/right movement and a shoot button. They drive the same input state as the keyboard, so movement/shooting/game-over-restart all work identically to keyboard play.

## Win / lose states
- Lose: lives reach 0 → "Game Over" text + restart prompt (press any key/click to restart).
- Win: all enemies cleared → brief "Woo hoo!" text, then a new wave spawns (slightly faster), so the demo can loop indefinitely on camera without manual restarts.

## Scoring / lives
- Start with 3 lives.
- 100 points per enemy kill

## Explicit non-goals (keep it minimal)
- No difficulty settings, menus, or power-ups.
- No persistence (no high score storage).
- For any on-screen element where there's no image, use an emoji or a basic SVG.

## Documentation
- Simple README.md describing tech and how to install the game.
  - Include a credit to https://pixabay.com/sound-effects/search/meow/ for the meow sound.