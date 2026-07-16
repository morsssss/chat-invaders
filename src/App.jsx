import { useEffect, useRef, useState } from 'react'

const CANVAS_W = 480
const CANVAS_H = 640
const EDGE_PAD = 16

const PLAYER_W = 60
const PLAYER_H = 60
const ENEMY_W = 46
const ENEMY_H = 46
const GRID_COLS = 5
const GRID_ROWS = 4
const GRID_GAP = 14
const GRID_TOP = 70
const GRID_LEFT = (CANVAS_W - (GRID_COLS * ENEMY_W + (GRID_COLS - 1) * GRID_GAP)) / 2

const PLAYER_SPEED = 4.2
const BULLET_SPEED = 7
const ENEMY_BULLET_SPEED = 3.4
const FIRE_COOLDOWN_MS = 380
const ENEMY_FIRE_MIN = 700
const ENEMY_FIRE_MAX = 1600
const STEP_DOWN = 22
const ENEMY_STEP_X = 8
const BASE_MOVE_INTERVAL_MS = 500
const MOVE_INTERVAL_STEP_MS = 40
const MIN_MOVE_INTERVAL_MS = 120
const DEATH_ROTATE_MS = 500
const DEATH_PAUSE_MS = 1000
const INTRO_MS = 2000
const WIN_MS = 1800
const ENEMY_DEATH_MS = 620
const STAR_COUNT = 80
const SOCCER_BALL_W = 32
const SOCCER_BALL_H = 32
const SOCCER_BALL_SPEED = 2.5
const SOCCER_BALL_SPAWN_INTERVAL = 5000
const SOCCER_BALL_POINTS = 500

const rand = (min, max) => min + Math.random() * (max - min)

// How long the enemy grid pauses between chunky steps on a given wave -- shrinks
// each wave (down to a floor) so later waves march noticeably faster.
const moveIntervalForWave = (wave) =>
  Math.max(MIN_MOVE_INTERVAL_MS, BASE_MOVE_INTERVAL_MS - (wave - 1) * MOVE_INTERVAL_STEP_MS)

// Axis-aligned bounding box (AABB) collision check: true if the two rects intersect at all.
const rectsOverlap = (rectA, rectB) =>
  rectA.x < rectB.x + rectB.w &&
  rectA.x + rectA.w > rectB.x &&
  rectA.y < rectB.y + rectB.h &&
  rectA.y + rectA.h > rectB.y

// Traces a rounded-rectangle path (caller still has to fill/stroke it). Used for
// the message backdrop, so on-screen text stays legible over a busy background.
function traceRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// Generates the twinkling background starfield: random positions/sizes, each with
// its own phase offset so they twinkle independently rather than in sync.
function buildStars() {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: rand(0, CANVAS_W),
    y: rand(0, CANVAS_H),
    r: rand(0.5, 1.8),
    seed: rand(0, Math.PI * 2),
  }))
}

// Builds a fresh grid of enemy cats for a new wave, cycling through the three
// enemy sprite types (plain / tie / coder) by row for visual variety.
function buildEnemies() {
  const enemies = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      enemies.push({
        x: GRID_LEFT + col * (ENEMY_W + GRID_GAP),
        y: GRID_TOP + row * (ENEMY_H + GRID_GAP),
        w: ENEMY_W,
        h: ENEMY_H,
        type: ['plain', 'tie', 'coder'][row % 3],
        alive: true,
        dying: false,
        deathT: 0,
        flyVX: 0,
        flyVY: 0,
        rot: 0,
        rotSpeed: 0,
      })
    }
  }
  return enemies
}

// Returns a player object reset to its starting position, ready to move and shoot again.
function freshPlayer() {
  return {
    x: CANVAS_W / 2 - PLAYER_W / 2,
    y: CANVAS_H - PLAYER_H - 24,
    cooldown: 0,
    dying: false,
    deathT: 0,
  }
}

// Builds the full initial game state for a brand new game, with score, lives, and
// wave all reset to their starting values.
function freshState() {
  return {
    phase: 'intro',
    phaseTimer: INTRO_MS,
    score: 0,
    lives: 3,
    wave: 1,
    dir: 1,
    moveInterval: moveIntervalForWave(1),
    moveTimer: moveIntervalForWave(1),
    fireTimer: rand(ENEMY_FIRE_MIN, ENEMY_FIRE_MAX),
    player: freshPlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: buildEnemies(),
    stars: buildStars(),
    soccerBall: null,
    soccerBallTimer: SOCCER_BALL_SPAWN_INTERVAL,
  }
}

// Advances to the next wave: rebuilds the enemy grid (a bit faster than the last
// wave), clears bullets, resets the player, and queues up the "LET'S GO!" intro
// before play resumes.
function startWave(state) {
  state.enemies = buildEnemies()
  state.bullets = []
  state.enemyBullets = []
  state.dir = 1
  state.moveInterval = moveIntervalForWave(state.wave)
  state.moveTimer = state.moveInterval
  state.fireTimer = rand(ENEMY_FIRE_MIN, ENEMY_FIRE_MAX)
  state.player = freshPlayer()
  state.phase = 'intro'
  state.phaseTimer = INTRO_MS
}

// After the death animation finishes and the player still has lives left, puts the
// player back at its start position and replays the "LET'S GO!" intro.
function resetPlayerAfterDeath(state) {
  state.player = freshPlayer()
  state.bullets = []
  state.enemyBullets = []
  state.phase = 'intro'
  state.phaseTimer = INTRO_MS
}

// Spawns a soccer ball at a random edge position, moving across the screen.
function spawnSoccerBall() {
  const side = Math.random() < 0.5 ? 'left' : 'right'
  const y = rand(50, CANVAS_H - 100)
  if (side === 'left') {
    return {
      x: -SOCCER_BALL_W,
      y: y,
      w: SOCCER_BALL_W,
      h: SOCCER_BALL_H,
      vx: SOCCER_BALL_SPEED,
      vy: 0,
    }
  } else {
    return {
      x: CANVAS_W,
      y: y,
      w: SOCCER_BALL_W,
      h: SOCCER_BALL_H,
      vx: -SOCCER_BALL_SPEED,
      vy: 0,
    }
  }
}

// Top-level component: owns the canvas element and the sound toggle button. All of
// the actual game state lives in refs rather than React state, so the render loop
// can mutate it every frame without triggering React re-renders; `soundOn` is the
// one piece of real UI state, and it's mirrored into a ref so the game loop can
// read its latest value without closing over a stale copy.
export default function App() {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef({ left: false, right: false, space: false })
  const imagesRef = useRef(null)
  const audioRef = useRef(null)
  const [soundOn, setSoundOn] = useState(true)
  const soundOnRef = useRef(soundOn)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)

  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  if (!stateRef.current) stateRef.current = freshState()

  // Runs once on mount: preloads the sprite images and the meow sound, wires up
  // keyboard/click listeners, then defines and starts the update/render loop via
  // requestAnimationFrame. The returned cleanup function cancels the loop and
  // removes the listeners on unmount.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!imagesRef.current) {
      const plain = new Image()
      plain.src = '/images/cat-plain.png'
      const tie = new Image()
      tie.src = '/images/cat-with-tie.png'
      const coder = new Image()
      coder.src = '/images/cat-who-codes.png'
      const player = new Image()
      player.src = '/images/cat-player.png'
      const fish = new Image()
      fish.src = '/images/flying-fish.png'
      const dog = new Image()
      dog.src = '/images/surprised-dog.png'
      const soccerBall = new Image()
      soccerBall.src = '/images/soccer-ball.png'
      imagesRef.current = { plain, tie, coder, player, fish, dog, soccerBall }
    }
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/meow.mp3')
    }

    // Plays the meow sound effect (skipped entirely if sound is muted). Cloning the
    // audio node lets overlapping hits each play their own copy instead of cutting
    // each other off.
    const playMeow = () => {
      if (!soundOnRef.current) return
      const audioClone = audioRef.current.cloneNode()
      audioClone.volume = 0.6
      audioClone.play().catch(() => {})
    }

    const restart = () => {
      stateRef.current = freshState()
    }

    // Tracks arrow/space key state for movement and shooting, and restarts the
    // game on any keypress once it's over.
    const onKeyDown = (e) => {
      const state = stateRef.current
      if (e.code === 'ArrowLeft') keysRef.current.left = true
      if (e.code === 'ArrowRight') keysRef.current.right = true
      if (e.code === 'Space') keysRef.current.space = true
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
      if (state.phase === 'gameover') restart()
    }
    // Clears the corresponding movement/shooting flag when a tracked key is released.
    const onKeyUp = (e) => {
      if (e.code === 'ArrowLeft') keysRef.current.left = false
      if (e.code === 'ArrowRight') keysRef.current.right = false
      if (e.code === 'Space') keysRef.current.space = false
    }
    const onClick = () => {
      if (stateRef.current.phase === 'gameover') restart()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('click', onClick)

    let rafId
    let lastTime = performance.now()

    // Advances the game simulation by one frame. Runs every animation frame
    // regardless of game phase, since dying enemies keep animating their fly-off
    // mid-flight even while something else (an intro, a win, the player dying) is
    // happening. Most gameplay logic -- player movement/shooting, the enemy grid's
    // marching motion, enemy firing, and all collision checks -- only runs while
    // phase is 'playing'. The other phases ('intro', 'win', 'dying') just count
    // down a timer before transitioning to the next phase. If paused, nothing in
    // here runs at all -- the whole frame is frozen exactly as it was.
    const update = (deltaMs) => {
      if (pausedRef.current) return

      const state = stateRef.current
      const frameScale = deltaMs / 16.6667
      const keys = keysRef.current

      // dying enemies keep animating regardless of phase
      for (const enemy of state.enemies) {
        if (enemy.alive && enemy.dying) {
          enemy.deathT += deltaMs
          enemy.x += enemy.flyVX * frameScale
          enemy.y += enemy.flyVY * frameScale
          enemy.rot += enemy.rotSpeed * frameScale
          if (enemy.deathT > ENEMY_DEATH_MS) enemy.alive = false
        }
      }

      if (state.phase === 'intro') {
        state.phaseTimer -= deltaMs
        if (state.phaseTimer <= 0) state.phase = 'playing'
        return
      }

      if (state.phase === 'win') {
        state.phaseTimer -= deltaMs
        if (state.phaseTimer <= 0) {
          state.wave += 1
          startWave(state)
        }
        return
      }

      if (state.phase === 'dying') {
        state.player.deathT += deltaMs
        if (state.player.deathT >= DEATH_ROTATE_MS + DEATH_PAUSE_MS) {
          if (state.lives <= 0) state.phase = 'gameover'
          else resetPlayerAfterDeath(state)
        }
        return
      }

      if (state.phase !== 'playing') return

      // player movement
      if (keys.left) state.player.x -= PLAYER_SPEED * frameScale
      if (keys.right) state.player.x += PLAYER_SPEED * frameScale
      state.player.x = Math.max(EDGE_PAD, Math.min(CANVAS_W - EDGE_PAD - PLAYER_W, state.player.x))

      // shooting
      state.player.cooldown -= deltaMs
      if (keys.space && state.player.cooldown <= 0) {
        state.bullets.push({ x: state.player.x + PLAYER_W / 2 - 10, y: state.player.y, w: 20, h: 38 })
        state.player.cooldown = FIRE_COOLDOWN_MS
      }

      // bullets
      for (const bullet of state.bullets) bullet.y -= BULLET_SPEED * frameScale
      state.bullets = state.bullets.filter((bullet) => bullet.y > -24)

      for (const enemyBullet of state.enemyBullets) enemyBullet.y += ENEMY_BULLET_SPEED * frameScale
      state.enemyBullets = state.enemyBullets.filter((enemyBullet) => enemyBullet.y < CANVAS_H + 24)

      // soccer ball spawning and movement
      state.soccerBallTimer -= deltaMs
      if (state.soccerBallTimer <= 0) {
        state.soccerBall = spawnSoccerBall()
        state.soccerBallTimer = SOCCER_BALL_SPAWN_INTERVAL
      }
      if (state.soccerBall) {
        state.soccerBall.x += state.soccerBall.vx * frameScale
        state.soccerBall.y += state.soccerBall.vy * frameScale
        // Remove soccer ball if it goes off screen
        if (state.soccerBall.x > CANVAS_W + SOCCER_BALL_W || state.soccerBall.x < -SOCCER_BALL_W) {
          state.soccerBall = null
        }
      }

      // enemy grid movement
      const activeEnemies = state.enemies.filter((enemy) => enemy.alive && !enemy.dying)
      if (activeEnemies.length === 0) {
        state.phase = state.enemies.every((enemy) => !enemy.alive) ? 'win' : state.phase
        if (state.phase === 'win') state.phaseTimer = WIN_MS
      } else {
        // Enemies march in chunky, fixed-size steps on a timer (like the original
        // Space Invaders' tick-based movement) rather than gliding smoothly.
        state.moveTimer -= deltaMs
        if (state.moveTimer <= 0) {
          state.moveTimer += state.moveInterval

          let minX = Infinity
          let maxX = -Infinity
          for (const enemy of activeEnemies) {
            minX = Math.min(minX, enemy.x)
            maxX = Math.max(maxX, enemy.x + enemy.w)
          }
          const dx = state.dir * ENEMY_STEP_X
          if (minX + dx < EDGE_PAD || maxX + dx > CANVAS_W - EDGE_PAD) {
            state.dir *= -1
            for (const enemy of activeEnemies) enemy.y += STEP_DOWN
          } else {
            for (const enemy of activeEnemies) enemy.x += dx
          }
        }

        // enemy firing
        state.fireTimer -= deltaMs
        if (state.fireTimer <= 0) {
          const shooter = activeEnemies[Math.floor(Math.random() * activeEnemies.length)]
          state.enemyBullets.push({ x: shooter.x + shooter.w / 2 - 12, y: shooter.y + shooter.h, w: 28, h: 35 })
          state.fireTimer = rand(ENEMY_FIRE_MIN, ENEMY_FIRE_MAX)
        }

        // enemies reaching the player's row
        for (const enemy of activeEnemies) {
          if (enemy.y + enemy.h >= state.player.y) {
            state.phase = 'gameover'
            break
          }
        }
      }

      // collisions: player bullets vs enemies
      const usedBullets = new Set()
      for (const enemy of state.enemies) {
        if (!enemy.alive || enemy.dying) continue
        for (const bullet of state.bullets) {
          if (usedBullets.has(bullet)) continue
          if (rectsOverlap(bullet, enemy)) {
            usedBullets.add(bullet)
            enemy.dying = true
            enemy.deathT = 0
            enemy.flyVX = rand(-3.2, 3.2)
            enemy.flyVY = -rand(2.4, 4.6)
            enemy.rotSpeed = rand(-0.3, 0.3)
            state.score += 100
            playMeow()
            break
          }
        }
      }
      if (usedBullets.size) state.bullets = state.bullets.filter((bullet) => !usedBullets.has(bullet))

      // collisions: player bullets vs soccer ball
      if (state.soccerBall) {
        const soccerBallRect = state.soccerBall
        for (const bullet of state.bullets) {
          if (rectsOverlap(bullet, soccerBallRect)) {
            state.soccerBall = null
            state.score += SOCCER_BALL_POINTS
            playMeow()
            break
          }
        }
      }

      // collisions: enemy bullets vs player
      if (state.phase === 'playing' && !state.player.dying) {
        const playerRect = { x: state.player.x, y: state.player.y, w: PLAYER_W, h: PLAYER_H }
        for (const enemyBullet of state.enemyBullets) {
          if (rectsOverlap(enemyBullet, playerRect)) {
            state.enemyBullets = state.enemyBullets.filter((remaining) => remaining !== enemyBullet)
            state.lives -= 1
            state.player.dying = true
            state.player.deathT = 0
            state.phase = 'dying'
            break
          }
        }
      }
    }

    // Draws a large centered message (used for the intro/win/game-over overlays).
    // Since these appear over a busy starfield/enemy-grid background, the text
    // sits on a dark rounded panel sized to fit it, so it stays readable no
    // matter what's behind it.
    const drawCenterText = (text) => {
      const font = '22px "Press Start 2P", monospace'

      ctx.textAlign = 'center'
      ctx.font = font

      // textBaseline: 'middle' centers on the font's abstract ascent/descent box,
      // which reserves room for descenders this all-caps text never uses -- so it
      // renders looking a pixel or two too high. Center on the glyphs' actual ink
      // box instead, via the alphabetic baseline plus a computed offset.
      const metrics = ctx.measureText(text)
      const textWidth = metrics.width
      const inkCenterOffset = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
      const textY = CANVAS_H / 2 + inkCenterOffset

      const panelWidth = Math.min(CANVAS_W - 20, textWidth + 40)
      const panelHeight = 56
      const panelX = CANVAS_W / 2 - panelWidth / 2
      const panelY = CANVAS_H / 2 - panelHeight / 2

      ctx.fillStyle = 'rgba(5, 4, 10, 0.82)'
      ctx.strokeStyle = 'rgba(255, 215, 106, 0.45)'
      ctx.lineWidth = 2
      traceRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 10)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#ffd76a'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(text, CANVAS_W / 2, textY)
    }

    // Draws one frame: background and starfield, then enemies, bullets, the
    // player, the score/lives HUD, and finally whichever center-screen message
    // matches the current phase. Purely a function of `state` -- it reads state
    // but never mutates it; all mutation happens in update().
    const render = (now) => {
      const state = stateRef.current
      const imgs = imagesRef.current

      ctx.fillStyle = '#05040a'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      for (const star of state.stars) {
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin(now / 900 + star.seed))
        ctx.globalAlpha = alpha
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      for (const enemy of state.enemies) {
        if (!enemy.alive) continue
        const img = imgs[enemy.type]
        ctx.save()
        if (enemy.dying) {
          ctx.globalAlpha = Math.max(0, 1 - enemy.deathT / ENEMY_DEATH_MS)
          ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2)
          ctx.rotate(enemy.rot)
          ctx.drawImage(img, -enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h)
        } else {
          ctx.drawImage(img, enemy.x, enemy.y, enemy.w, enemy.h)
        }
        ctx.restore()
      }

      for (const bullet of state.bullets) ctx.drawImage(imgs.fish, bullet.x, bullet.y, bullet.w, bullet.h)
      for (const enemyBullet of state.enemyBullets) ctx.drawImage(imgs.dog, enemyBullet.x, enemyBullet.y, enemyBullet.w, enemyBullet.h)

      // Draw soccer ball if active
      if (state.soccerBall) {
        ctx.drawImage(imgs.soccerBall, state.soccerBall.x, state.soccerBall.y, state.soccerBall.w, state.soccerBall.h)
      }

      ctx.save()
      if (state.player.dying) {
        const angle = Math.min(state.player.deathT / DEATH_ROTATE_MS, 1) * Math.PI
        ctx.translate(state.player.x + PLAYER_W / 2, state.player.y + PLAYER_H / 2)
        ctx.rotate(angle)
        ctx.drawImage(imgs.player, -PLAYER_W / 2, -PLAYER_H / 2, PLAYER_W, PLAYER_H)
      } else {
        ctx.drawImage(imgs.player, state.player.x, state.player.y, PLAYER_W, PLAYER_H)
      }
      ctx.restore()

      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.fillText(`SCORE: ${state.score}`, 14, 24)
      ctx.textAlign = 'right'
      ctx.fillText(`LIVES: ${Math.max(state.lives, 0)}`, CANVAS_W - 14, 24)

      // Only one overlay message is ever shown at a time -- pause takes priority
      // over whatever phase-specific message would otherwise be showing.
      if (pausedRef.current) drawCenterText('PAWSED')
      else if (state.phase === 'intro') drawCenterText("LET'S GO!")
      else if (state.phase === 'win') drawCenterText('WOO HOO!')
      else if (state.phase === 'gameover') drawCenterText('GAME OVER')
    }

    // The requestAnimationFrame driver: computes the time elapsed since the last
    // frame (clamped so a stalled/backgrounded tab doesn't cause a huge jump),
    // then updates and renders.
    const loop = (now) => {
      const deltaMs = Math.min(now - lastTime, 50)
      lastTime = now
      update(deltaMs)
      render(now)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('click', onClick)
    }
  }, [])

  // Touch-button handlers just flip the same keysRef flags the keyboard uses, so
  // touch and keyboard input drive movement/shooting identically. A tap also
  // restarts the game once it's over, mirroring the keyboard/click restart.
  const handleTouchStart = (key) => (e) => {
    e.preventDefault()
    if (stateRef.current.phase === 'gameover') {
      stateRef.current = freshState()
      return
    }
    keysRef.current[key] = true
  }
  const handleTouchEnd = (key) => () => {
    keysRef.current[key] = false
  }

  return (
    <div className="game-shell">
      <div className="game-container">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
      </div>
      <div className="controls-row">
        <button className="sound-toggle" onClick={() => setSoundOn((prev) => !prev)}>
          <img className="btn-icon" src={soundOn ? '/images/sound-on.svg' : '/images/sound-off.svg'} alt="" />
          {soundOn ? 'Sound On' : 'Sound Off'}
        </button>
        <button className="sound-toggle" onClick={() => setPaused((prev) => !prev)}>
          <img className="btn-icon" src={paused ? '/images/play-button.png' : '/images/pause-button.png'} alt="" />
          {paused ? 'Resume' : 'Paws'}
        </button>
      </div>
      <div className="touch-controls">
        <div className="touch-controls-inner">
          <div className="dpad">
            <button
              className="touch-btn"
              onPointerDown={handleTouchStart('left')}
              onPointerUp={handleTouchEnd('left')}
              onPointerLeave={handleTouchEnd('left')}
              onPointerCancel={handleTouchEnd('left')}
            >
              <img src="/images/left-button.svg" alt="Move left" draggable="false" />
            </button>
            <button
              className="touch-btn"
              onPointerDown={handleTouchStart('right')}
              onPointerUp={handleTouchEnd('right')}
              onPointerLeave={handleTouchEnd('right')}
              onPointerCancel={handleTouchEnd('right')}
            >
              <img src="/images/right-button.svg" alt="Move right" draggable="false" />
            </button>
          </div>
          <button
            className="touch-btn shoot-btn"
            onPointerDown={handleTouchStart('space')}
            onPointerUp={handleTouchEnd('space')}
            onPointerLeave={handleTouchEnd('space')}
            onPointerCancel={handleTouchEnd('space')}
          >
            <img src="/images/shoot-button.png" alt="Shoot" draggable="false" />
          </button>
        </div>
      </div>
    </div>
  )
}
