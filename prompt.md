# 🎮 COMPLETE FINAL PROMPT FOR ARENA AI AGENTS
**Agent Role:** Expert Web Game Development Researcher specializing in Three.js, open-source 3D assets, and browser-based game architectures.

**Mission:** Conduct comprehensive research before any code development begins. This research will inform Phase 2 development.

---

## PROJECT OVERVIEW

You are researching for a 3D endless runner web game called **"School Runner: Teacher Chase"**. 

**Core Concept:**
- Student character runs forward through school environment
- Gravel/tiled ground with infinite scrolling
- Dodge obstacles, collect floating grade papers
- Teacher appears ONLY when player makes mistakes (not always visible)
- Web-based (HTML/JavaScript/Three.js), playable in browser

**Key Mechanics:**
- 3-lane system (left, center, right)
- Third-person camera behind player
- Progressive difficulty (speed increases, harder obstacles)
- Teacher chase system with recovery mechanic
- Desktop keyboard + mobile swipe controls (NO on-screen buttons)
- Background music + sound effects

---

## RESEARCH TASKS

### Task 1: Open-Source Code & Framework Research

**Objective:** Find existing Three.js endless runner projects and code patterns we can leverage.

**Search for:**
- GitHub repositories: "Three.js endless runner", "Three.js subway surfers", "Three.js lane switching game"
- Code examples for:
  - Object pooling in Three.js
  - Third-person camera follow systems
  - Infinite ground tile generation
  - Mobile swipe detection (vanilla JS or minimal library)

**For each repository found, document:**
- GitHub URL
- Star count and last update date
- Key features we can use
- Specific code modules to extract (e.g., camera controller, tile spawner)
- License type (MIT, GPL, etc.)
- Code quality assessment

**Deliverable:** Markdown table with 5-10 repositories ranked by usefulness.

---

### Task 2: 3D Asset Discovery (Critical - Must Find Low-Poly Models)

**Objective:** Find free, open-source 3D models compatible with Three.js GLTFLoader.

**IMPORTANT:** All models must be:
- `.glb` or `.gltf` format
- Low polygon count (< 5000 polygons for web performance)
- Free license (CC0, CC-BY, MIT)
- Downloadable

**Assets Needed:**

#### A) Environment Models
- **Ground/floor tiles** (school hallway floor, concrete, or pavement - must tile seamlessly)
- **Side decorations:**
  - Lockers (school hallway style)
  - Desks
  - Trash cans
  - Benches
  - Bulletin boards
  - Simple trees/bushes (for outdoor variant)
  - School building exterior (optional)

#### B) Obstacle Models
- **Low obstacles** (player must jump): desks, boxes, small benches
- **High obstacles** (player must slide under): barriers, gates, overhead signs
- **Lane blockers** (player must switch lanes): traffic cones, barriers, roadblocks

#### C) Collectible Models
- **Floating paper/document models** (or simple planes we can texture as grade papers)
- Alternative: Star, coin, or token models we can retexture

#### D) Textures (Backup Resources)
- Seamless gravel texture (1024x1024px minimum)
- Concrete/pavement texture
- School hallway floor texture
- (User will provide primary ground texture, these are fallbacks)

**Search These Platforms:**
1. **poly.pizza** - Free low-poly models
2. **Kenney.nl** - Free game asset packs (search "school", "city", "furniture")
3. **Quaternius** - Free ultimate asset packs
4. **Sketchfab** - Filter by: CC license, Downloadable, Low-poly tag
5. **OpenGameArt.org**
6. **Free3D.com**
7. **CGTrader** - Free models section

**For textures:**
- **ambientCG.com** (CC0 textures)
- **polyhaven.com** (free PBR textures)
- **textures.com** (free tier)

**Deliverable:** Spreadsheet with columns:
| Asset Name | Category | Download Link | License | Polygon Count | Format | Preview Image | Usage Notes |
|------------|----------|---------------|---------|---------------|--------|---------------|-------------|

Aim for 15-20 assets minimum.

---

### Task 3: Character System Research (2D Image to 3D Billboard)

**Problem:** User will provide 2D PNG images of characters (student and teacher). We need to display these as 3D sprites in the game.

**Research Topics:**

#### A) Billboard Sprite Systems in Three.js
- How to use `THREE.Sprite` with transparent PNGs
- `THREE.SpriteMaterial` alpha/transparency handling
- Making sprites always face the camera
- Sprite scaling and positioning
- Performance considerations

#### B) Alternative Approach: Textured 3D Mesh
- Creating simple capsule/box geometry as character body
- UV mapping 2D image onto 3D shape
- Pros/cons vs billboard sprites

#### C) Animation Techniques (Without Sprite Sheets)
Since user provides single static images, research:
- Bobbing/rotation animations to simulate running
- Jump animation (scaling + position)
- Slide animation (squash effect)
- Stumble animation (shake/tilt)
- Particle effects for motion lines/dust

**Find Code Examples For:**
```javascript
// Example of what to research
const texture = new THREE.TextureLoader().load('character.png');
const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
const sprite = new THREE.Sprite(spriteMaterial);
// ... etc
```

**Deliverable:** Technical document comparing:
- Billboard Sprite approach (recommended for this project)
- Textured 3D mesh approach
- With pros, cons, code snippets, and performance notes
- Recommendation on which to use for web game

---

### Task 4: Core Game Mechanics Implementation Research

#### A) Mobile Swipe Detection (NO UI Buttons)

**Critical Requirement:** Touch controls must work via gestures only, no visible arrow buttons.

**Research:**
- Vanilla JavaScript touch events: `touchstart`, `touchmove`, `touchend`
- Algorithm to detect swipe direction (up/down/left/right)
- Minimum swipe distance thresholds
- Preventing default browser scrolling
- iOS Safari vs Android Chrome differences

**Find or create code pattern for:**
```javascript
// Detect: Swipe Up = Jump, Swipe Down = Slide, Swipe Left/Right = Lane change
// Minimum viable implementation without external libraries
```

**Optional:** Research lightweight libraries like Hammer.js if needed.

**Deliverable:** Code snippet for swipe detection with comments explaining thresholds.

---

#### B) Object Pooling System

**Why:** Endless runners need to recycle objects (tiles, obstacles, coins) to avoid memory issues.

**Research:**
- Object pooling patterns in JavaScript/Three.js
- How to create reusable pools for ground tiles, obstacles, collectibles
- Efficient position reset when recycling
- Memory management best practices

**Find examples of:**
- Creating an object pool manager
- Recycling objects that move past the camera
- Performance comparisons (pooling vs creating/destroying)

**Deliverable:** Code example of a generic ObjectPool class for Three.js meshes.

---

#### C) Progressive Difficulty System

**Game Requirements:**
- Speed increases gradually over time
- Obstacle spawn rate increases
- Three difficulty tiers based on distance:
  - **0-500m:** Easy (D and C grade papers, slow speed)
  - **500-1500m:** Medium (B grade papers, faster)
  - **1500m+:** Hard (A+ papers, max speed, tight patterns)

**Research:**
- Speed curve algorithms (linear vs exponential increase)
- Spawn rate formulas tied to distance/time
- Balancing difficulty progression

**Deliverable:** Code snippet showing:
```javascript
// Example function
function calculateDifficulty(distanceTraveled) {
    // Return current speed, spawn rate, grade tier
}
```

---

#### D) Teacher Chase Mechanic (Conditional Visibility)

**Unique Mechanic:** Teacher is invisible by default, only appears on mistakes.

**Behavior:**
1. Player hits first obstacle → Teacher appears **close behind** (high pressure)
2. Teacher chases player (moves faster than player)
3. If player runs 100m without hitting obstacles → Teacher disappears
4. If player hits 3+ obstacles quickly → Teacher catches player → Game Over

**Research:**
- Character spawn/despawn with smooth fade effects
- Distance tracking between two objects (player and teacher)
- Trigger systems based on collision counters
- State machines (states: hidden, chasing, caught)

**Deliverable:** Pseudocode or logic flowchart for teacher chase system.

---

### Task 5: Audio System Research

**Required Sounds:**
1. **Jump sound** (whoosh/spring)
2. **Collect grade sound** (paper rustle/ding/chime)
3. **Hit obstacle sound** (thud/crash)
4. **Teacher appears sound** (whistle/alert/bell)
5. **Game over sound** (fail buzzer/dramatic sting)
6. **Background music** (upbeat, loopable, 1-2 minutes)

**Research Topics:**

#### A) Audio Library Choice
Compare:
- **Web Audio API** (vanilla, no dependencies)
- **Howler.js** (popular library, easier API)

Which is better for:
- Playing multiple sounds simultaneously
- Looping background music
- Volume control
- Mobile browser compatibility
- File size

**Deliverable:** Recommendation with reasoning.

---

#### B) Free Sound Effect Sources

Find and list:
- 10-15 free sound effects from:
  - **freesound.org** (search with CC0 filter)
  - **Kenney.nl** audio packs
  - **zapsplat.com** (free tier)
  - **mixkit.co**
  - **OpenGameArt.org**

**For each sound:**
- Direct download link
- License type
- File format (prefer .mp3 or .ogg)
- Duration/size

---

#### C) Implementation Patterns

**Find code examples for:**
- Loading and playing sounds
- Background music looping
- Mute/unmute toggle
- Sound effect pooling (playing same sound multiple times)
- Volume control

**Deliverable:** Code snippet showing basic audio manager class.

---

### Task 6: UI/UX Design Research

**Game Has 3 Screens:**

#### A) Start Screen
- Game title (large, arcade-style font)
- Story text: *"The teacher is coming! RUN!"*
- START button (animated, glowing)
- Control instructions (desktop: arrow keys, mobile: swipe)
- Background: Blurred game preview or school image

**Research:**
- Arcade-style web fonts (Google Fonts: "Press Start 2P", "Orbitron", "Bungee")
- Animated button effects (CSS glow, pulse, hover effects)
- Responsive layouts (mobile-first design)
- Examples: Search CodePen for "arcade start screen", "retro game UI"

---

#### B) HUD (Heads-Up Display During Gameplay)
**Elements:**
- **Top-left:** Score counter
- **Top-center:** Current grade tier (D/C/B/A+)
- **Top-right:** Distance traveled (meters)
- **Full-screen overlay:** Red vignette warning when teacher is close

**Design requirements:**
- Minimal, semi-transparent (doesn't block gameplay)
- Readable fonts
- Glass-morphism effect (backdrop-filter: blur)

**Research:**
- CSS for transparent HUD overlays
- Red vignette effect (radial gradient)
- Performance-friendly UI rendering

---

#### C) Game Over Screen
- "Teacher Caught You!" message (animated entrance)
- Statistics display:
  - Final Score
  - Distance Traveled (meters)
  - Grades Collected (total count)
- "Play Again" button
- Optional: "Share Score" button

**Research:**
- Animated text effects (slide-in, fade-in)
- Stats display layouts
- Restart button best practices

**Deliverable:** 
- Links to 3-5 UI inspiration examples (CodePen, Dribbble, game screenshots)
- Recommended font pairings
- Color palette for school theme (suggest hex codes for: primary, secondary, danger, success, text, background)

---

### Task 7: Performance Optimization Research

**Target Performance:**
- 60 FPS on desktop (Chrome, Firefox, Safari)
- 30+ FPS on mobile (iOS Safari, Chrome Android)
- Load time < 5 seconds
- Memory usage < 200MB

**Research Topics:**

#### A) Three.js Optimization Techniques
- Geometry instancing (for repeated obstacles)
- Frustum culling (don't render off-screen objects)
- Level of Detail (LOD) systems
- Texture compression (basis/KTX2 format)
- Shadow map optimization (resolution, update frequency)
- Reducing draw calls

**Find:**
- Three.js performance best practices documentation
- Code examples for optimization

---

#### B) Asset Loading Strategies
- Lazy loading vs preloading
- Loading screen implementation with progress bar
- Compression techniques for 3D models
- Texture atlas/sprite sheets

---

#### C) Mobile-Specific Optimizations
- Reducing polygon count for mobile detection
- Simplified shaders on mobile
- Battery consumption considerations
- Touch input latency reduction

**Deliverable:** 
- Performance optimization checklist (15-20 items)
- Code snippet for FPS counter (for debugging)
- Mobile vs desktop settings comparison table

---

### Task 8: Deployment & Sharing Research

**User Requirement:** Game must run in browser and be shareable with friends.

**Research Options:**

#### A) Local Development Server
Compare methods:
1. **VS Code Live Server extension**
   - Installation steps
   - Usage instructions
   
2. **Python HTTP Server**
   ```bash
   python -m http.server 8000
   ```
   
3. **Node.js http-server**
   ```bash
   npx http-server -p 8000
   ```

**For each:** Pros, cons, setup difficulty.

---

#### B) Free Hosting Platforms

**Compare:**
1. **GitHub Pages**
   - Setup process
   - Deployment steps
   - Limitations for games
   - Custom domain options
   
2. **Netlify**
   - Drag-and-drop deployment
   - Free tier limits
   - Build settings for static sites
   
3. **Vercel**
   - Deployment process
   - Performance benefits
   - Free tier
   
4. **itch.io** (HTML5 games)
   - Upload process
   - Embedding options
   - Community features

**Deliverable:** Comparison table with:
| Platform | Ease of Use | Free Tier Limits | Best For | Setup Time |
|----------|-------------|------------------|----------|------------|

---

#### C) Network Sharing (Local Play)

**Research:**
- How to find local IP address (Windows/Mac/Linux)
- Sharing game on local WiFi network
- Port forwarding basics
- Using ngrok for temporary public URL
- QR code generation for mobile testing

**Deliverable:** Step-by-step guide for sharing locally.

---

### Task 9: Browser Compatibility Research

**Required Support:**
- Chrome 120+ (Desktop & Mobile)
- Firefox 120+ (Desktop)
- Safari 17+ (Desktop & iOS)
- Edge 120+

**Research:**
- Three.js browser compatibility matrix
- WebGL support detection code
- Known issues:
  - Audio autoplay policies (Chrome, Safari)
  - Touch event differences (iOS vs Android)
  - Shadow rendering limitations
- Fallback strategies for unsupported browsers

**Deliverable:** 
- Browser compatibility table
- Code snippet for feature detection
- Fallback message HTML for unsupported browsers

---

### Task 10: CORS and Asset Loading Issues

**Research:**
- Common CORS errors when loading textures/models locally
- Solutions:
  - Proper server setup
  - Relative vs absolute paths
  - Fetch API vs XMLHttpRequest
- Three.js TextureLoader and GLTFLoader error handling

**Deliverable:** Troubleshooting guide for asset loading errors.

---

## PHASE 1 FINAL DELIVERABLE FORMAT

**Create a comprehensive research report document (Markdown or Google Doc) with these sections:**

```markdown
# School Runner: Teacher Chase - Research Report

## Executive Summary
[1-paragraph overview of findings and recommendations]

## 1. Code Repositories Analysis
[Table of 5-10 GitHub repos with ratings and notes]

## 2. 3D Assets Library
[Spreadsheet of all models/textures found with download links]
- Organized by category (Environment, Obstacles, Collectibles)
- Include preview images
- License information

## 3. Character System Technical Approach
[Detailed comparison of Billboard vs 3D Mesh]
- Recommendation: [Billboard Sprite / 3D Textured Mesh]
- Code example
- Animation strategy

## 4. Game Mechanics Code Patterns
### 4.1 Swipe Detection
[Code snippet with explanation]

### 4.2 Object Pooling
[Code example]

### 4.3 Difficulty Progression
[Algorithm/formula]

### 4.4 Teacher Chase Logic
[Flowchart or pseudocode]

## 5. Audio Implementation
- Library Recommendation: [Web Audio API / Howler.js]
- Sound effects library (15 links)
- Code example for audio manager

## 6. UI/UX Design System
- Font recommendations: [Font names + Google Fonts links]
- Color palette:
  - Primary: #______
  - Secondary: #______
  - Danger: #______
  - Success: #______
  - Text: #______
  - Background: #______
- Inspiration links (5 examples)
- CSS examples for key components

## 7. Performance Optimization Strategy
- Checklist (15-20 items)
- Code snippets (FPS counter, memory monitor)
- Mobile vs desktop settings table

## 8. Deployment Guide
- Local server comparison table
- Recommended hosting: [Platform name]
- Step-by-step instructions for:
  - Local testing
  - Network sharing
  - Public deployment

## 9. Browser Compatibility Report
- Compatibility matrix
- Known issues and workarounds
- Feature detection code

## 10. Troubleshooting Guide
- Common CORS errors
- Asset loading failures
- Audio autoplay issues
- Performance problems

## 11. Recommended Tech Stack Summary
**Final Recommendations:**
- Three.js version: r___
- Audio library: [Choice]
- Character system: [Approach]
- Hosting: [Platform]
- Additional libraries: [If any]

## 12. Questions for User
[List any clarifications needed before development]

## 13. Asset Download Package
[ZIP file or folder structure with all downloaded open-source assets organized]
```

---

## APPROVAL CHECKPOINT

**STOP HERE after completing research.**

**Do NOT proceed to development (Phase 2) until:**
1. User reviews this research report
2. User approves recommended approaches
3. User provides their 3 custom images:
   - `ground-gravel.png` (ground texture)
   - `student-character.png` (student sprite)
   - `teacher-character.png` (teacher sprite)
4. User answers any questions in section 12

**Present findings with:**
- Summary of best assets found
- Preview images/videos of recommended 3D models
- Links to test the code patterns you researched
- Estimated development time for Phase 2

---

**END OF PHASE 1 RESEARCH PROMPT**

---

---

# 💻 ARENA AI AGENT - PHASE 2: DEVELOPMENT

**Copy this entire section and paste it into your second Arena AI Agent AFTER Phase 1 is approved**

---

**Agent Role:** Senior Three.js Game Developer & Full-Stack Web Engineer

**Prerequisites:** 
- ✅ Phase 1 Research Report approved
- ✅ User has provided 3 custom images (ground texture, student character, teacher character)
- ✅ Open-source 3D assets downloaded and organized

**Mission:** Build a complete, production-ready, fully functional 3D endless runner web game based on research findings and specifications below.

---

## PROJECT SPECIFICATIONS

### Game Information
- **Title:** School Runner: Teacher Chase
- **Genre:** 3D Endless Runner (Web-based)
- **Inspired By:** Subway Surfers + Temple Run
- **Unique Hook:** Teacher only appears when player makes mistakes

### Technical Stack (Use Research Recommendations)
```
- Three.js r160+ (latest stable)
- GLTFLoader (for 3D models)
- [Audio Library from Phase 1: Web Audio API or Howler.js]
- Vanilla JavaScript ES6+ (no build tools)
- Single HTML file deployment
```

---

## FILE STRUCTURE

**Create this exact folder structure:**

```
school-runner/
├── index.html                      # Main entry point
├── css/
│   └── style.css                   # All UI styling
├── js/
│   ├── config.js                   # Game configuration constants
│   ├── main.js                     # Game initialization & loop
│   ├── managers/
│   │   ├── GroundManager.js        # Tile pooling & recycling
│   │   ├── ObstacleManager.js      # Obstacle spawning & collision
│   │   ├── CollectibleManager.js   # Grade paper system
│   │   ├── AudioManager.js         # Sound effects & music
│   │   └── UIManager.js            # Screen transitions & HUD
│   ├── entities/
│   │   ├── Player.js               # Player character controller
│   │   └── Teacher.js              # Teacher chase logic
│   ├── utils/
│   │   ├── InputHandler.js         # Keyboard + swipe controls
│   │   ├── ObjectPool.js           # Generic pooling system
│   │   └── GameState.js            # State machine & scoring
│   └── lib/
│       ├── three.module.js         # Three.js (CDN or local)
│       └── GLTFLoader.js           # Model loader
├── assets/
│   ├── models/                     # Open-source .glb/.gltf files
│   │   ├── environment/
│   │   │   ├── ground-tile.glb     # From Phase 1 research
│   │   │   ├── locker.glb
│   │   │   └── ...
│   │   └── obstacles/
│   │       ├── desk.glb
│   │       ├── barrier.glb
│   │       └── ...
│   ├── textures/                   # User-provided images
│   │   ├── ground-gravel.png       # ← USER PROVIDES
│   │   ├── student-character.png   # ← USER PROVIDES
│   │   └── teacher-character.png   # ← USER PROVIDES
│   ├── sounds/                     # From Phase 1 research
│   │   ├── jump.mp3
│   │   ├── collect.mp3
│   │   ├── hit.mp3
│   │   ├── teacher-alert.mp3
│   │   ├── gameover.mp3
│   │   └── bg-music.mp3
│   └── fonts/                      # Web fonts (if not using Google Fonts CDN)
└── README.md                       # Complete setup guide
```

---

## CONFIGURATION FILE (js/config.js)

**Create this file with ALL tuneable game values:**

```javascript
/**
 * School Runner: Teacher Chase - Game Configuration
 * All game parameters in one place for easy tweaking
 */

export const CONFIG = {
    // ========== GROUND & MOVEMENT ==========
    GROUND: {
        TILE_LENGTH: 20,              // Length of each ground tile model
        TILE_WIDTH: 12,               // Width (must cover 3 lanes)
        VISIBLE_TILES: 20,            // Number of tiles in object pool
        INITIAL_SPEED: 15,            // Starting movement speed
        MAX_SPEED: 45,                // Maximum speed cap
        SPEED_INCREMENT: 0.5,         // Speed increase per second
    },
    
    // ========== LANE SYSTEM ==========
    LANES: {
        COUNT: 3,                     // Always 3 lanes
        WIDTH: 4,                     // Distance between lane centers
        POSITIONS: [-4, 0, 4],        // X positions: left, center, right
        SWITCH_SPEED: 10,             // Lane switch animation speed
        SWITCH_DURATION: 0.2,         // Seconds to complete lane switch
    },
    
    // ========== PLAYER CHARACTER ==========
    PLAYER: {
        SPRITE_HEIGHT: 2.5,           // Sprite scale height
        SPRITE_WIDTH: 1.5,            // Sprite scale width
        JUMP_HEIGHT: 3.5,             // How high player jumps
        JUMP_DURATION: 0.6,           // Seconds in air
        SLIDE_DURATION: 0.8,          // Slide animation time
        SLIDE_HEIGHT: 0.8,            // Height when sliding
        STUMBLE_DURATION: 1.5,        // Slowdown after hit
        STUMBLE_SPEED_MULT: 0.3,      // Speed multiplier when stumbling (30%)
        RUN_BOB_AMOUNT: 0.15,         // Up/down bobbing amount
        RUN_BOB_SPEED: 8,             // Bobbing frequency
        COLLISION_RADIUS: 0.8,        // Collision detection size
    },
    
    // ========== TEACHER CHASE MECHANIC ==========
    TEACHER: {
        APPEAR_DISTANCE: 12,          // Spawns this close behind player (HIGH PRESSURE)
        CATCH_DISTANCE: 1.5,          // Game over when this close
        CHASE_SPEED_MULTIPLIER: 1.3,  // Moves 30% faster than player
        RECOVERY_DISTANCE: 100,       // Meters to run clean to hide teacher
        MINOR_BLUNDER_THRESHOLD: 1,   // Mistakes needed to trigger appearance
        MAJOR_BLUNDER_THRESHOLD: 3,   // Instant game over threshold
        SPRITE_HEIGHT: 3,             // Teacher sprite size
        SPRITE_WIDTH: 2,
        FADE_DURATION: 0.5,           // Fade in/out animation time
    },
    
    // ========== OBSTACLES ==========
    OBSTACLES: {
        SPAWN_DISTANCE_AHEAD: 60,     // How far ahead to spawn
        MIN_GAP_BETWEEN: 12,          // Minimum space between obstacles
        INITIAL_SPAWN_CHANCE: 0.25,   // 25% spawn chance at start
        MAX_SPAWN_CHANCE: 0.65,       // Increases to 65% at max difficulty
        DESPAWN_DISTANCE: 15,         // Recycle when this far behind camera
        
        TYPES: {
            LOW: {                    // Must jump over
                height: 1.2,
                requiresJump: true,
                models: ['desk', 'box', 'bench']
            },
            HIGH: {                   // Must slide under
                height: 2.8,
                requiresSlide: true,
                models: ['barrier', 'gate']
            },
            BLOCKER: {                // Must switch lanes
                height: 2,
                requiresLaneSwitch: true,
                models: ['cone', 'roadblock']
            }
        }
    },
    
    // ========== COLLECTIBLES (GRADE PAPERS) ==========
    GRADES: {
        SPAWN_CHANCE: 0.5,            // 50% chance to spawn pattern
        SPAWN_DISTANCE_AHEAD: 50,
        FLOAT_HEIGHT: 1.5,            // Y position
        FLOAT_BOB_AMOUNT: 0.3,        // Up/down floating animation
        FLOAT_ROTATION_SPEED: 2,      // Rotation speed
        COLLECTION_RADIUS: 1.2,       // Pickup distance
        
        PATTERNS: ['line', 'arc', 'zigzag'], // Spawn patterns
        
        // Difficulty tiers
        TIERS: [
            { 
                minDistance: 0, 
                grade: 'D', 
                color: 0x8B4513,      // Brown
                points: 10,
                spawnWeight: 0.4      // 40% of spawns at this tier
            },
            { 
                minDistance: 0, 
                grade: 'C', 
                color: 0xFFD700,      // Gold
                points: 15,
                spawnWeight: 0.6      // 60% of spawns
            },
            { 
                minDistance: 500, 
                grade: 'B', 
                color: 0x4169E1,      // Royal Blue
                points: 25,
                spawnWeight: 1.0      // 100% at this tier
            },
            { 
                minDistance: 1500, 
                grade: 'A+', 
                color: 0xFF1493,      // Hot Pink
                points: 50,
                spawnWeight: 1.0
            }
        ]
    },
    
    // ========== CAMERA ==========
    CAMERA: {
        FOV: 75,                      // Field of view
        NEAR: 0.1,                    // Near clipping plane
        FAR: 1000,                    // Far clipping plane
        POSITION_OFFSET: {            // Offset from player
            x: 0,
            y: 5,                     // Height above player
            z: 10                     // Distance behind player
        },
        LOOK_AHEAD_DISTANCE: 8,       // How far ahead to look
        FOLLOW_SMOOTHNESS: 0.1,       // Camera lerp factor (0.1 = smooth, 1 = instant)
    },
    
    // ========== LIGHTING ==========
    LIGHTING: {
        AMBIENT: {
            color: 0xffffff,          // White
            intensity: 0.6
        },
        DIRECTIONAL: {
            color: 0xffffff,
            intensity: 0.8,
            position: { x: -10, y: 20, z: 10 },
            castShadow: true
        },
        HEMISPHERE: {                 // Optional sky/ground gradient
            skyColor: 0x87CEEB,       // Light blue
            groundColor: 0x654321,    // Brown
            intensity: 0.3
        },
        SHADOWS: {
            enabled: true,
            mapSize: 2048,            // Shadow quality (1024 for mobile)
            cameraSize: 20            // Shadow frustum size
        },
        FOG: {
            enabled: true,
            color: 0xcccccc,
            near: 30,
            far: 100
        }
    },
    
    // ========== AUDIO ==========
    AUDIO: {
        MASTER_VOLUME: 0.7,
        MUSIC_VOLUME: 0.4,
        SFX_VOLUME: 0.6,
        SOUNDS: {
            jump: 'assets/sounds/jump.mp3',
            collect: 'assets/sounds/collect.mp3',
            hit: 'assets/sounds/hit.mp3',
            teacherAlert: 'assets/sounds/teacher-alert.mp3',
            gameOver: 'assets/sounds/gameover.mp3',
            bgMusic: 'assets/sounds/bg-music.mp3'
        }
    },
    
    // ========== UI COLORS ==========
    COLORS: {
        PRIMARY: '#FFD700',           // Gold (grades, highlights)
        SECONDARY: '#4169E1',         // Royal Blue (school theme)
        DANGER: '#FF0000',            // Red (teacher warning)
        SUCCESS: '#00FF00',           // Green (good streak)
        TEXT_LIGHT: '#FFFFFF',
        TEXT_DARK: '#000000',
        BACKGROUND: '#1a1a2e',        // Dark blue-grey
        WARNING_OVERLAY: 'rgba(255, 0, 0, 0.3)' // Red tint
    },
    
    // ========== PERFORMANCE ==========
    PERFORMANCE: {
        TARGET_FPS: 60,
        MOBILE_PIXEL_RATIO: 1.5,      // Limit on mobile
        ENABLE_SHADOWS_MOBILE: false, // Disable shadows on mobile
        LOW_POLY_DISTANCE: 50         // Use simpler models beyond this
    },
    
    // ========== DEBUG ==========
    DEBUG: {
        SHOW_FPS: false,              // FPS counter
        SHOW_COLLISION_BOXES: false,  // Wireframe helpers
        GOD_MODE: false,              // No collisions
        SKIP_START_SCREEN: false
    }
};

// Export individual sections for easier imports
export const GROUND = CONFIG.GROUND;
export const LANES = CONFIG.LANES;
export const PLAYER = CONFIG.PLAYER;
export const TEACHER = CONFIG.TEACHER;
export const OBSTACLES = CONFIG.OBSTACLES;
export const GRADES = CONFIG.GRADES;
export const CAMERA = CONFIG.CAMERA;
export const LIGHTING = CONFIG.LIGHTING;
export const AUDIO = CONFIG.AUDIO;
export const COLORS = CONFIG.COLORS;
```

---

## DETAILED COMPONENT SPECIFICATIONS

### 1. Ground Manager (js/managers/GroundManager.js)

**Purpose:** Handle infinite scrolling ground tiles with user's custom texture.

**Requirements:**
- Load open-source ground tile model from Phase 1 research
- Apply user's `ground-gravel.png` texture on top
- Implement object pooling for seamless infinite scrolling
- Synchronize movement with game speed

**Implementation:**

```javascript
import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { CONFIG } from '../config.js';

export class GroundManager {
    constructor(scene) {
        this.scene = scene;
        this.tilePool = [];
        this.tilePrefab = null;
        this.userTexture = null;
        this.currentSpeed = CONFIG.GROUND.INITIAL_SPEED;
        this.textureLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();
    }
    
    /**
     * Load the ground tile 3D model from open-source assets
     */
    async loadTileModel(modelPath) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                modelPath,
                (gltf) => {
                    this.tilePrefab = gltf.scene;
                    
                    // Configure for shadows and performance
                    this.tilePrefab.traverse((child) => {
                        if (child.isMesh) {
                            child.receiveShadow = true;
                            child.castShadow = false; // Ground doesn't cast shadows
                        }
                    });
                    
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading ground tile model:', error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Load user's custom ground texture
     */
    async loadUserTexture(texturePath) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                texturePath,
                (texture) => {
                    // Configure texture for tiling
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(2, 2); // Adjust based on tile size
                    texture.anisotropy = 16; // Sharper at angles
                    
                    this.userTexture = texture;
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading user texture:', error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Create the initial pool of ground tiles
     */
    initialize() {
        if (!this.tilePrefab) {
            console.error('Tile model not loaded!');
            return;
        }
        
        for (let i = 0; i < CONFIG.GROUND.VISIBLE_TILES; i++) {
            const tile = this.tilePrefab.clone();
            
            // Position tiles in sequence
            tile.position.z = -i * CONFIG.GROUND.TILE_LENGTH;
            
            // Apply user texture if available
            if (this.userTexture) {
                this.applyUserTexture(tile);
            }
            
            this.scene.add(tile);
            this.tilePool.push({
                mesh: tile,
                zPosition: tile.position.z
            });
        }
    }
    
    /**
     * Apply user's custom texture to tile
     */
    applyUserTexture(tile) {
        tile.traverse((child) => {
            if (child.isMesh && child.material) {
                // Clone material to avoid affecting prefab
                child.material = child.material.clone();
                
                // Replace base texture with user's texture
                child.material.map = this.userTexture;
                child.material.needsUpdate = true;
            }
        });
    }
    
    /**
     * Update ground tiles each frame
     */
    update(deltaTime, speed) {
        this.currentSpeed = speed;
        const moveDistance = speed * deltaTime;
        
        this.tilePool.forEach((tileData) => {
            // Move tile forward
            tileData.mesh.position.z += moveDistance;
            tileData.zPosition += moveDistance;
            
            // Check if tile has passed camera (needs recycling)
            const cameraZ = this.scene.getObjectByName('mainCamera')?.position.z || 0;
            
            if (tileData.zPosition > cameraZ + CONFIG.GROUND.TILE_LENGTH) {
                // Find the furthest back tile
                let minZ = Infinity;
                this.tilePool.forEach(t => {
                    if (t.zPosition < minZ) minZ = t.zPosition;
                });
                
                // Move this tile to the back
                const newZ = minZ - CONFIG.GROUND.TILE_LENGTH;
                tileData.mesh.position.z = newZ;
                tileData.zPosition = newZ;
            }
        });
    }
    
    /**
     * Reset ground for new game
     */
    reset() {
        this.tilePool.forEach((tileData, index) => {
            const newZ = -index * CONFIG.GROUND.TILE_LENGTH;
            tileData.mesh.position.z = newZ;
            tileData.zPosition = newZ;
        });
        this.currentSpeed = CONFIG.GROUND.INITIAL_SPEED;
    }
}
```

**Critical Points:**
- Must handle seamless tiling (no gaps between tiles)
- User texture should overlay/replace model's default texture
- Efficient recycling (don't destroy/create, just reposition)
- Synchronized with game speed changes

---

### 2. Player Controller (js/entities/Player.js)

**Purpose:** Control player character (billboard sprite) with animations.

**Requirements:**
- Load user's `student-character.png` as sprite
- Handle lane switching, jumping, sliding
- Collision detection
- Run cycle animation (bobbing)

**Implementation:**

```javascript
import * as THREE from '../lib/three.module.js';
import { CONFIG, PLAYER, LANES } from '../config.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.sprite = null;
        
        // Lane system
        this.currentLane = 1;         // 0=left, 1=center, 2=right
        this.targetLane = 1;
        this.laneX = LANES.POSITIONS[1]; // Start in center
        
        // Movement state
        this.isJumping = false;
        this.isSliding = false;
        this.isStumbling = false;
        
        // Animation timers
        this.jumpTimer = 0;
        this.slideTimer = 0;
        this.stumbleTimer = 0;
        this.runBobTimer = 0;
        
        // Position
        this.baseY = 0;               // Ground level
        this.currentY = 0;
        this.velocityY = 0;
    }
    
    /**
     * Load player character sprite from user's image
     */
    async loadCharacter(imagePath) {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();
            
            textureLoader.load(
                imagePath,
                (texture) => {
                    const spriteMaterial = new THREE.SpriteMaterial({
                        map: texture,
                        transparent: true,
                        depthWrite: false
                    });
                    
                    this.sprite = new THREE.Sprite(spriteMaterial);
                    this.sprite.scale.set(
                        PLAYER.SPRITE_WIDTH,
                        PLAYER.SPRITE_HEIGHT,
                        1
                    );
                    
                    // Position at start
                    this.sprite.position.set(
                        this.laneX,
                        PLAYER.SPRITE_HEIGHT / 2, // Bottom of sprite at ground
                        0
                    );
                    
                    this.scene.add(this.sprite);
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading player character:', error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Switch to adjacent lane
     * @param {number} direction - -1 for left, +1 for right
     */
    switchLane(direction) {
        if (this.isSliding) return; // Can't switch while sliding
        
        this.targetLane += direction;
        
        // Clamp to valid lanes (0-2)
        this.targetLane = Math.max(0, Math.min(2, this.targetLane));
    }
    
    /**
     * Initiate jump
     */
    jump() {
        if (this.isJumping || this.isSliding || this.isStumbling) return;
        
        this.isJumping = true;
        this.jumpTimer = 0;
    }
    
    /**
     * Initiate slide
     */
    slide() {
        if (this.isJumping || this.isSliding || this.isStumbling) return;
        
        this.isSliding = true;
        this.slideTimer = 0;
    }
    
    /**
     * Trigger stumble animation after hitting obstacle
     */
    stumble() {
        if (this.isStumbling) return;
        
        this.isStumbling = true;
        this.stumbleTimer = 0;
        
        // Visual feedback: tilt sprite
        this.sprite.rotation.z = Math.PI * 0.15; // 27 degrees
    }
    
    /**
     * Update player each frame
     */
    update(deltaTime) {
        // Smooth lane switching (lerp to target lane)
        const targetX = LANES.POSITIONS[this.targetLane];
        this.laneX += (targetX - this.laneX) * LANES.SWITCH_SPEED * deltaTime;
        this.sprite.position.x = this.laneX;
        
        // Update current lane when close enough
        if (Math.abs(this.laneX - targetX) < 0.1) {
            this.currentLane = this.targetLane;
        }
        
        // Jump animation (parabolic arc)
        if (this.isJumping) {
            this.jumpTimer += deltaTime;
            const progress = this.jumpTimer / PLAYER.JUMP_DURATION;
            
            if (progress >= 1.0) {
                // Jump complete
                this.isJumping = false;
                this.currentY = this.baseY;
            } else {
                // Parabolic trajectory: y = -4h(x)(x-1) where h = jump height
                this.currentY = this.baseY + 
                    PLAYER.JUMP_HEIGHT * Math.sin(progress * Math.PI);
            }
        }
        
        // Slide animation
        else if (this.isSliding) {
            this.slideTimer += deltaTime;
            
            if (this.slideTimer >= PLAYER.SLIDE_DURATION) {
                // Slide complete
                this.isSliding = false;
                this.sprite.scale.y = PLAYER.SPRITE_HEIGHT;
                this.currentY = this.baseY;
            } else {
                // Squash sprite vertically
                const slideProgress = this.slideTimer / PLAYER.SLIDE_DURATION;
                this.sprite.scale.y = THREE.MathUtils.lerp(
                    PLAYER.SPRITE_HEIGHT,
                    PLAYER.SLIDE_HEIGHT,
                    Math.sin(slideProgress * Math.PI) // Smooth in/out
                );
                this.currentY = this.baseY + this.sprite.scale.y / 2;
            }
        }
        
        // Stumble animation
        else if (this.isStumbling) {
            this.stumbleTimer += deltaTime;
            
            if (this.stumbleTimer >= PLAYER.STUMBLE_DURATION) {
                // Recovery complete
                this.isStumbling = false;
                this.sprite.rotation.z = 0;
            } else {
                // Wobble effect
                const wobbleFreq = 15;
                const wobbleAmount = 0.1 * (1 - this.stumbleTimer / PLAYER.STUMBLE_DURATION);
                this.sprite.rotation.z = Math.sin(this.stumbleTimer * wobbleFreq) * wobbleAmount;
            }
        }
        
        // Run cycle bobbing (when not jumping/sliding)
        else {
            this.runBobTimer += deltaTime * PLAYER.RUN_BOB_SPEED;
            this.currentY = this.baseY + 
                Math.sin(this.runBobTimer) * PLAYER.RUN_BOB_AMOUNT;
        }
        
        // Apply Y position
        this.sprite.position.y = this.currentY + PLAYER.SPRITE_HEIGHT / 2;
    }
    
    /**
     * Get bounding box for collision detection
     */
    getBoundingBox() {
        const box = new THREE.Box3();
        
        if (this.isSliding) {
            // Smaller hitbox when sliding
            box.setFromCenterAndSize(
                new THREE.Vector3(
                    this.sprite.position.x,
                    this.currentY + PLAYER.SLIDE_HEIGHT / 2,
                    this.sprite.position.z
                ),
                new THREE.Vector3(
                    PLAYER.COLLISION_RADIUS,
                    PLAYER.SLIDE_HEIGHT,
                    PLAYER.COLLISION_RADIUS
                )
            );
        } else {
            // Normal hitbox
            box.setFromCenterAndSize(
                this.sprite.position,
                new THREE.Vector3(
                    PLAYER.COLLISION_RADIUS,
                    PLAYER.SPRITE_HEIGHT,
                    PLAYER.COLLISION_RADIUS
                )
            );
        }
        
        return box;
    }
    
    /**
     * Get current speed multiplier (reduced when stumbling)
     */
    getSpeedMultiplier() {
        return this.isStumbling ? PLAYER.STUMBLE_SPEED_MULT : 1.0;
    }
    
    /**
     * Reset player for new game
     */
    reset() {
        this.currentLane = 1;
        this.targetLane = 1;
        this.laneX = LANES.POSITIONS[1];
        this.isJumping = false;
        this.isSliding = false;
        this.isStumbling = false;
        this.jumpTimer = 0;
        this.slideTimer = 0;
        this.stumbleTimer = 0;
        this.runBobTimer = 0;
        this.currentY = this.baseY;
        this.sprite.rotation.z = 0;
        this.sprite.scale.y = PLAYER.SPRITE_HEIGHT;
        this.sprite.position.set(this.laneX, PLAYER.SPRITE_HEIGHT / 2, 0);
    }
}
```

---

### 3. Teacher Chase System (js/entities/Teacher.js)

**CRITICAL MECHANIC - This is the unique feature of the game.**

**Requirements:**
- Teacher is INVISIBLE by default
- Appears only after first mistake
- Spawns CLOSE behind player (high pressure)
- Disappears after 100m clean run
- 3+ mistakes = instant game over

**Implementation:**

```javascript
import * as THREE from '../lib/three.module.js';
import { CONFIG, TEACHER } from '../config.js';

export class Teacher {
    constructor(scene, audioManager) {
        this.scene = scene;
        this.audio = audioManager;
        this.sprite = null;
        
        // Visibility state
        this.isVisible = false;
        this.opacity = 0;
        
        // Position tracking
        this.distanceFromPlayer = TEACHER.APPEAR_DISTANCE;
        this.zPosition = -TEACHER.APPEAR_DISTANCE;
        
        // Mistake tracking
        this.mistakeCount = 0;
        this.recoveryDistance = 0;
        
        // Animation
        this.fadeTimer = 0;
        this.isFading = false;
        this.fadeDirection = 1; // 1 = fade in, -1 = fade out
    }
    
    /**
     * Load teacher sprite from user's image
     */
    async loadCharacter(imagePath) {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();
            
            textureLoader.load(
                imagePath,
                (texture) => {
                    const spriteMaterial = new THREE.SpriteMaterial({
                        map: texture,
                        transparent: true,
                        opacity: 0, // Start invisible
                        depthWrite: false
                    });
                    
                    this.sprite = new THREE.Sprite(spriteMaterial);
                    this.sprite.scale.set(
                        TEACHER.SPRITE_WIDTH,
                        TEACHER.SPRITE_HEIGHT,
                        1
                    );
                    
                    // Position behind player
                    this.sprite.position.set(
                        0, // Always in center lane
                        TEACHER.SPRITE_HEIGHT / 2,
                        this.zPosition
                    );
                    
                    this.scene.add(this.sprite);
                    this.sprite.visible = false;
                    
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading teacher character:', error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Called when player hits an obstacle
     * @returns {string|null} 'GAME_OVER' if caught, null otherwise
     */
    onPlayerMistake() {
        this.mistakeCount++;
        
        if (this.mistakeCount === TEACHER.MINOR_BLUNDER_THRESHOLD) {
            // First mistake - show teacher
            this.showTeacher();
        }
        
        if (this.mistakeCount >= TEACHER.MAJOR_BLUNDER_THRESHOLD) {
            // Too many mistakes - instant game over
            return 'GAME_OVER';
        }
        
        return null;
    }
    
    /**
     * Make teacher visible and play alert sound
     */
    showTeacher() {
        if (this.isVisible) return;
        
        this.isVisible = true;
        this.sprite.visible = true;
        this.isFading = true;
        this.fadeDirection = 1;
        this.fadeTimer = 0;
        this.recoveryDistance = 0;
        
        // Reset distance (spawn close)
        this.distanceFromPlayer = TEACHER.APPEAR_DISTANCE;
        
        // Play alert sound
        if (this.audio) {
            this.audio.playSound('teacherAlert');
        }
    }
    
    /**
     * Hide teacher after successful recovery
     */
    hideTeacher() {
        if (!this.isVisible) return;
        
        this.isFading = true;
        this.fadeDirection = -1;
        this.fadeTimer = 0;
        
        // Reset mistake counter
        this.mistakeCount = 0;
        this.recoveryDistance = 0;
    }
    
    /**
     * Update recovery progress
     * @param {number} distanceTraveled - Distance moved this frame
     */
    updateRecovery(distanceTraveled) {
        if (!this.isVisible) return;
        
        this.recoveryDistance += distanceTraveled;
        
        if (this.recoveryDistance >= TEACHER.RECOVERY_DISTANCE) {
            this.hideTeacher();
        }
    }
    
    /**
     * Update teacher each frame
     * @param {number} deltaTime 
     * @param {number} playerSpeed 
     * @param {number} playerZ - Player's Z position
     * @returns {string|null} 'CAUGHT' if caught player, null otherwise
     */
    update(deltaTime, playerSpeed, playerZ) {
        // Handle fade in/out animation
        if (this.isFading) {
            this.fadeTimer += deltaTime;
            const fadeProgress = Math.min(this.fadeTimer / TEACHER.FADE_DURATION, 1.0);
            
            if (this.fadeDirection === 1) {
                // Fading in
                this.opacity = fadeProgress;
                
                if (fadeProgress >= 1.0) {
                    this.isFading = false;
                    this.opacity = 1.0;
                }
            } else {
                // Fading out
                this.opacity = 1.0 - fadeProgress;
                
                if (fadeProgress >= 1.0) {
                    this.isFading = false;
                    this.isVisible = false;
                    this.sprite.visible = false;
                    this.opacity = 0;
                }
            }
            
            this.sprite.material.opacity = this.opacity;
        }
        
        // Only update position if visible
        if (!this.isVisible) return null;
        
        // Teacher moves faster than player to catch up
        const teacherSpeed = playerSpeed * TEACHER.CHASE_SPEED_MULTIPLIER;
        const relativeSpeed = teacherSpeed - playerSpeed;
        
        // Reduce distance (teacher catching up)
        this.distanceFromPlayer -= relativeSpeed * deltaTime;
        
        // Update Z position (always behind player)
        this.zPosition = playerZ - this.distanceFromPlayer;
        this.sprite.position.z = this.zPosition;
        
        // Check if caught player
        if (this.distanceFromPlayer <= TEACHER.CATCH_DISTANCE) {
            return 'CAUGHT';
        }
        
        return null;
    }
    
    /**
     * Get warning intensity for UI (0-1)
     */
    getWarningIntensity() {
        if (!this.isVisible) return 0;
        
        // Intensity increases as teacher gets closer
        const intensity = 1.0 - (this.distanceFromPlayer / TEACHER.APPEAR_DISTANCE);
        return Math.max(0, Math.min(1, intensity));
    }
    
    /**
     * Reset teacher for new game
     */
    reset() {
        this.isVisible = false;
        this.sprite.visible = false;
        this.sprite.material.opacity = 0;
        this.opacity = 0;
        this.mistakeCount = 0;
        this.recoveryDistance = 0;
        this.distanceFromPlayer = TEACHER.APPEAR_DISTANCE;
        this.isFading = false;
    }
}
```

**Key Features:**
- Conditional visibility (only when needed)
- Smooth fade in/out
- Distance-based warning system
- Recovery mechanic (100m clean run)
- Instant game over on 3+ mistakes

---

Due to character limits, I'll continue with the remaining components in a structured format:

---

## REMAINING COMPONENTS (Structured Overview)

### 4. ObstacleManager (js/managers/ObstacleManager.js)

**Key Methods:**
```javascript
- async loadModels() // Load 3 types from Phase 1 assets
- spawnObstacle(type, lane, zPos) // Get from pool
- update(deltaTime, playerZ, speed) // Move & recycle
- checkCollision(playerBoundingBox) // Returns hit obstacle or null
- updateDifficulty(speed) // Increase spawn chance
```

**Obstacle Types:**
- LOW: desk.glb, box.glb → requires jump
- HIGH: barrier.glb, gate.glb → requires slide  
- BLOCKER: cone.glb → requires lane switch

**Spawning Logic:**
- Spawn ahead of player (60 units)
- Random lane selection (avoid player's current lane if too close)
- Progressive difficulty (spawn chance increases)

---

### 5. CollectibleManager (js/managers/CollectibleManager.js)

**Key Methods:**
```javascript
- async loadPaperModel() // Simple plane with grade texture
- spawnPattern(type, zPos) // line/arc/zigzag
- update(deltaTime, playerZ, distance, speed)
- checkCollection(playerBBox) // Returns array of collected grades
- updateTier(distance) // Switch D/C/B/A+ based on CONFIG
```

**Grade Paper Visuals:**
- Floating planes with colored text
- Rotate slowly (y-axis)
- Bob up/down (sine wave)
- Glow effect for A+ (particle system optional)

**Spawn Patterns:**
- **Line:** 3 papers across all lanes
- **Arc:** Curved path requiring lane switches
- **Zigzag:** Alternating lanes (left-center-right)

---

### 6. InputHandler (js/utils/InputHandler.js)

**Keyboard:**
```javascript
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowLeft': case 'a': player.switchLane(-1); break;
        case 'ArrowRight': case 'd': player.switchLane(1); break;
        case 'ArrowUp': case 'w': case ' ': player.jump(); break;
        case 'ArrowDown': case 's': player.slide(); break;
    }
});
```

**Mobile Swipe (NO BUTTONS):**
```javascript
let touchStartX, touchStartY;
document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

document.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > 50) {
            player.switchLane(deltaX > 0 ? 1 : -1);
        }
    } else {
        // Vertical swipe
        if (Math.abs(deltaY) > 50) {
            if (deltaY < 0) player.jump();
            else player.slide();
        }
    }
});
```

---

### 7. AudioManager (js/managers/AudioManager.js)

**Using recommendation from Phase 1 (Web Audio API or Howler.js):**

```javascript
class AudioManager {
    async loadSounds() {
        // Load all CONFIG.AUDIO.SOUNDS
    }
    
    playSound(name) {
        // Play SFX (jump, collect, hit, etc.)
    }
    
    playMusic() {
        // Loop background music
    }
    
    stopMusic() {}
    
    toggleMute() {
        // Mute/unmute all
    }
}
```

**Sound Triggers:**
- Jump → jump.mp3
- Collect grade → collect.mp3
- Hit obstacle → hit.mp3
- Teacher appears → teacher-alert.mp3
- Game over → gameover.mp3
- Background → bg-music.mp3 (loops)

---

### 8. UIManager (js/managers/UIManager.js)

**HTML Structure:**
```html
<div id="start-screen">
    <h1>School Runner</h1>
    <p>"The teacher is coming! RUN!"</p>
    <button id="start-btn">START</button>
    <div class="controls">Desktop: Arrow Keys | Mobile: Swipe</div>
</div>

<div id="game-screen" style="display:none;">
    <div class="hud">
        <span id="score">0</span>
        <span id="grade">Grade: D</span>
        <span id="distance">0m</span>
    </div>
    <div id="warning-overlay"></div>
</div>

<div id="gameover-screen" style="display:none;">
    <h1>Teacher Caught You!</h1>
    <p>Score: <span id="final-score"></span></p>
    <p>Distance: <span id="final-distance"></span>m</p>
    <p>Grades: <span id="final-grades"></span></p>
    <button id="restart-btn">Play Again</button>
</div>
```

**CSS (style.css):**
- Font: Google Fonts "Orbitron" or "Press Start 2P"
- Colors from CONFIG.COLORS
- Warning overlay: red radial gradient at screen edges
- HUD: glass-morphism effect (backdrop-filter: blur(10px))
- Buttons: glow animation on hover

---

### 9. GameState (js/utils/GameState.js)

**State Machine:**
```javascript
class GameState {
    state = 'START'; // START, PLAYING, PAUSED, GAME_OVER
    score = 0;
    distance = 0;
    currentSpeed = CONFIG.GROUND.INITIAL_SPEED;
    gradesCollected = { D: 0, C: 0, B: 0, 'A+': 0 };
    
    start() { this.state = 'PLAYING'; this.reset(); }
    pause() { this.state = 'PAUSED'; }
    gameOver() { this.state = 'GAME_OVER'; }
    
    updateDistance(delta) {
        this.distance += delta;
    }
    
    updateSpeed(deltaTime) {
        if (this.currentSpeed < CONFIG.GROUND.MAX_SPEED) {
            this.currentSpeed += CONFIG.GROUND.SPEED_INCREMENT * deltaTime;
        }
    }
    
    collectGrade(grade) {
        this.gradesCollected[grade]++;
        const tier = CONFIG.GRADES.TIERS.find(t => t.grade === grade);
        this.score += tier.points;
    }
}
```

---

### 10. Main Game Loop (js/main.js)

**Structure:**
```javascript
import { CONFIG } from './config.js';
import { GroundManager } from './managers/GroundManager.js';
import { ObstacleManager } from './managers/ObstacleManager.js';
import { CollectibleManager } from './managers/CollectibleManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { UIManager } from './managers/UIManager.js';
import { Player } from './entities/Player.js';
import { Teacher } from './entities/Teacher.js';
import { InputHandler } from './utils/InputHandler.js';
import { GameState } from './utils/GameState.js';

class SchoolRunnerGame {
    constructor() {
        this.setupThreeJS();
        this.setupManagers();
        this.init();
    }
    
    setupThreeJS() {
        // Create scene, camera, renderer
        // Setup lighting from CONFIG.LIGHTING
    }
    
    async init() {
        // Load all assets
        await this.loadAssets();
        
        // Setup input
        new InputHandler(this.player);
        
        // UI event listeners
        this.setupUI();
        
        // Start render loop
        this.animate();
    }
    
    async loadAssets() {
        await this.ground.loadTileModel('assets/models/environment/ground-tile.glb');
        await this.ground.loadUserTexture('assets/textures/ground-gravel.png');
        await this.player.loadCharacter('assets/textures/student-character.png');
        await this.teacher.loadCharacter('assets/textures/teacher-character.png');
        await this.obstacles.loadModels();
        await this.collectibles.loadPaperModel();
        await this.audio.loadSounds();
        
        this.ground.initialize();
    }
    
    update() {
        if (this.gameState.state !== 'PLAYING') return;
        
        const deltaTime = this.clock.getDelta();
        const speedMult = this.player.getSpeedMultiplier();
        const effectiveSpeed = this.gameState.currentSpeed * speedMult;
        const distanceTraveled = effectiveSpeed * deltaTime;
        
        // Update game state
        this.gameState.updateDistance(distanceTraveled);
        this.gameState.updateSpeed(deltaTime);
        
        // Update entities
        this.ground.update(deltaTime, effectiveSpeed);
        this.player.update(deltaTime);
        this.obstacles.update(deltaTime, this.player.sprite.position.z, effectiveSpeed);
        this.collectibles.update(deltaTime, this.player.sprite.position.z, 
                                 this.gameState.distance, effectiveSpeed);
        
        // Collision detection
        const hitObstacle = this.obstacles.checkCollision(this.player.getBoundingBox());
        if (hitObstacle) {
            this.player.stumble();
            this.audio.playSound('hit');
            const result = this.teacher.onPlayerMistake();
            if (result === 'GAME_OVER') {
                this.endGame();
                return;
            }
        }
        
        // Collectibles
        const collected = this.collectibles.checkCollection(this.player.getBoundingBox());
        collected.forEach(grade => {
            this.gameState.collectGrade(grade);
            this.audio.playSound('collect');
        });
        
        // Teacher
        this.teacher.updateRecovery(distanceTraveled);
        const teacherStatus = this.teacher.update(
            deltaTime, 
            effectiveSpeed,
            this.player.sprite.position.z
        );
        if (teacherStatus === 'CAUGHT') {
            this.endGame();
            return;
        }
        
        // Camera follow
        this.updateCamera();
        
        // UI update
        this.ui.updateHUD(
            this.gameState.score,
            this.gameState.distance,
            this.collectibles.getCurrentTier().grade
        );
        this.ui.showWarning(this.teacher.getWarningIntensity());
    }
    
    updateCamera() {
        const targetZ = this.player.sprite.position.z + CONFIG.CAMERA.POSITION_OFFSET.z;
        this.camera.position.z += (targetZ - this.camera.position.z) * 
                                   CONFIG.CAMERA.FOLLOW_SMOOTHNESS;
        this.camera.lookAt(
            0,
            CONFIG.CAMERA.POSITION_OFFSET.y,
            this.player.sprite.position.z - CONFIG.CAMERA.LOOK_AHEAD_DISTANCE
        );
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    endGame() {
        this.gameState.gameOver();
        this.audio.stopMusic();
        this.audio.playSound('gameOver');
        this.ui.showGameOverScreen(this.gameState.getStats());
    }
}

// Start game
document.addEventListener('DOMContentLoaded', () => {
    new SchoolRunnerGame();
});
```

---

## index.html STRUCTURE

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>School Runner: Teacher Chase</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body>
    <!-- Start Screen -->
    <div id="start-screen" class="screen active">
        <h1 class="game-title">School Runner</h1>
        <p class="story-text">"The teacher is coming! RUN!"</p>
        <button id="start-btn" class="game-btn">START</button>
        <div class="controls-info">
            <p><strong>Desktop:</strong> Arrow Keys or WASD</p>
            <p><strong>Mobile:</strong> Swipe to move</p>
        </div>
    </div>

    <!-- Game HUD -->
    <div id="game-screen" class="screen">
        <div class="hud">
            <div class="hud-item hud-left">
                <span>Score: </span><span id="score">0</span>
            </div>
            <div class="hud-item hud-center">
                <span id="grade">Grade: D</span>
            </div>
            <div class="hud-item hud-right">
                <span id="distance">0</span><span>m</span>
            </div>
        </div>
        <div id="warning-overlay" class="warning-overlay"></div>
        <button id="mute-btn" class="icon-btn">🔊</button>
    </div>

    <!-- Game Over Screen -->
    <div id="gameover-screen" class="screen">
        <h1 class="gameover-title">Teacher Caught You!</h1>
        <div class="stats">
            <p>Final Score: <span id="final-score">0</span></p>
            <p>Distance: <span id="final-distance">0</span>m</p>
            <p>Grades Collected: <span id="final-grades">0</span></p>
        </div>
        <button id="restart-btn" class="game-btn">Play Again</button>
    </div>

    <!-- Three.js Canvas -->
    <canvas id="game-canvas"></canvas>

    <!-- Scripts -->
    <script type="importmap">
    {
        "imports": {
            "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
            "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
        }
    }
    </script>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

---

## README.md (Complete Setup Guide)

```markdown
# 🏫 School Runner: Teacher Chase

A 3D endless runner web game built with Three.js where you run from an angry teacher!

## 🎮 How to Play

- **Dodge obstacles** by jumping, sliding, or switching lanes
- **Collect grade papers** (D, C, B, A+) to increase your score
- **Avoid the teacher** - he only appears when you make mistakes!
- **Recover** by running 100 meters without hitting obstacles

## ⚙️ Setup Instructions

### 1. Add Your Custom Assets

Place your 3 images in `assets/textures/`:

```
assets/textures/
├── ground-gravel.png       ← Your ground texture
├── student-character.png   ← Student sprite (transparent background)
└── teacher-character.png   ← Teacher sprite (transparent background)
```

**Image Requirements:**
- Ground: Seamless tileable texture, 1024x1024px minimum
- Characters: PNG with transparent background, 512x512px minimum

### 2. Run Locally

**Option A: VS Code Live Server** (Recommended)
1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"
4. Game opens at `http://localhost:5500`

**Option B: Python**
```bash
cd school-runner
python -m http.server 8000
```
Open: `http://localhost:8000`

**Option C: Node.js**
```bash
npx http-server -p 8000
```

### 3. Share with Friends

**Same WiFi Network:**
1. Find your local IP:
   - Windows: `ipconfig` (look for IPv4)
   - Mac/Linux: `ifconfig` or `ip addr`
2. Share: `http://YOUR_IP:8000`

**Public Access (Temporary):**
```bash
npx ngrok http 8000
```
Share the generated URL (valid for 2 hours).

## 🎯 Controls

**Desktop:**
- `←/→` or `A/D` - Switch lanes
- `↑` or `W` or `Space` - Jump
- `↓` or `S` - Slide

**Mobile:**
- Swipe left/right - Switch lanes
- Swipe up - Jump
- Swipe down - Slide

## 🎨 Game Mechanics

### Difficulty Tiers
| Distance | Grade Papers | Speed | Obstacles |
|----------|-------------|-------|-----------|
| 0-500m | D and C | Slow | Easy |
| 500-1500m | B | Medium | Moderate |
| 1500m+ | A+ | Fast | Hard |

### Teacher Chase System
- Teacher is **invisible** at start
- Appears **close behind** after first mistake
- **Disappears** after 100m clean run
- **3+ mistakes** = Instant Game Over

## 🔧 Customization

Edit `js/config.js` to adjust:
- Game speed and difficulty
- Lane width and spacing
- Jump height and duration
- Teacher chase distance
- Obstacle spawn rates
- Grade point values

## 🌐 Browser Compatibility

| Browser | Version | Performance | Notes |
|---------|---------|-------------|-------|
| Chrome | 120+ | ⭐⭐⭐⭐⭐ | Best |
| Firefox | 120+ | ⭐⭐⭐⭐⭐ | Excellent |
| Safari | 17+ | ⭐⭐⭐⭐ | Good |
| Edge | 120+ | ⭐⭐⭐⭐⭐ | Excellent |
| Mobile Chrome | Latest | ⭐⭐⭐⭐ | Good |
| Mobile Safari | Latest | ⭐⭐⭐ | Fair |

## 🐛 Troubleshooting

**Textures not loading:**
- Check browser console for CORS errors
- Ensure running via local server (not `file://`)
- Verify image paths are correct

**No sound on mobile:**
- Tap screen to trigger audio (browser autoplay policy)
- Check mute button in game

**Low FPS:**
- Disable shadows in `config.js`: `LIGHTING.SHADOWS.enabled = false`
- Reduce `GROUND.VISIBLE_TILES` to 15

## 📦 Deployment

**GitHub Pages:**
1. Create GitHub repository
2. Push code
3. Settings → Pages → Deploy from main branch
4. Access at: `https://yourusername.github.io/school-runner/`

**Netlify:**
1. Drag `school-runner` folder to netlify.com/drop
2. Get instant URL

## 📜 Credits

**Open-Source Assets:**
- [List 3D models from Phase 1 research]
- [List sound effects from Phase 1 research]

**Built With:**
- Three.js r160
- [Audio library name]
- Vanilla JavaScript

**License:**
MIT License - Feel free to modify and share!

## 🤝 Contributing

Found a bug? Have a suggestion?
- Open an issue on GitHub
- Submit a pull request

---

**Enjoy running from the teacher! 🏃‍♂️👨‍🏫**
```

---

## TESTING CHECKLIST

Before delivering, verify:

### Functionality ✅
- [ ] Game loads without console errors
- [ ] Start screen displays story text correctly
- [ ] Start button launches gameplay
- [ ] Keyboard controls work (all keys)
- [ ] Mobile swipe controls work (4 directions)
- [ ] Ground tiles scroll infinitely without gaps
- [ ] User's textures display correctly
- [ ] Obstacles spawn and recycle
- [ ] Grade papers spawn in patterns
- [ ] Collision detection accurate (no false positives)
- [ ] Player stumbles on hit
- [ ] Teacher appears ONLY on first mistake
- [ ] Teacher spawns close (high pressure confirmed)
- [ ] Recovery works (100m clean run)
- [ ] Teacher disappears after recovery
- [ ] 3+ mistakes triggers game over
- [ ] Game over screen shows correct stats
- [ ] Restart button resets game
- [ ] All sounds play correctly
- [ ] Mute button works

### Performance ⚡
- [ ] 60 FPS on desktop Chrome
- [ ] 30+ FPS on mobile
- [ ] No memory leaks after 5+ minutes
- [ ] Load time < 5 seconds

### Visual Quality 🎨
- [ ] Character sprites visible and scaled properly
- [ ] User textures applied correctly
- [ ] Lighting creates depth
- [ ] Warning overlay works (red edges)
- [ ] Smooth camera follow
- [ ] No Z-fighting or flickering

### Mobile 📱
- [ ] Responsive layout works
- [ ] Touch controls responsive
- [ ] No accidental scrolling
- [ ] Text readable on small screens

