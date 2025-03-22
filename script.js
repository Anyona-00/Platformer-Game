const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const canvas = document.getElementById("canvas");
const startScreen = document.querySelector(".start-screen");
const checkpointScreen = document.querySelector(".checkpoint-screen");
const checkpointMessage = document.querySelector(".checkpoint-screen > p");
const gameHUD = document.querySelector(".game-hud");
const victoryScreen = document.querySelector(".victory-screen");
const collectedCheckpointsElement = document.getElementById(
  "collected-checkpoints"
);
const totalCheckpointsElement = document.getElementById("total-checkpoints");

const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

const gravity = 0.5;
let isCheckpointCollisionDetectionActive = true;
let collectedCheckpoints = 0;
let gameStartTime;
let gameActive = false;

// Game sounds
const jumpSound = new Audio(
  "https://assets.mixkit.co/sfx/preview/mixkit-quick-jump-arcade-game-239.mp3"
);
const checkpointSound = new Audio(
  "https://assets.mixkit.co/sfx/preview/mixkit-melodic-bonus-collect-1938.mp3"
);
const victorySound = new Audio(
  "https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3"
);

// Lower the volume
jumpSound.volume = 0.3;
checkpointSound.volume = 0.3;
victorySound.volume = 0.3;

// Utility function for responsive sizing
const proportionalSize = (size) => {
  return innerHeight < 500 ? Math.ceil((size / 500) * innerHeight) : size;
};

// Create a particle system for visual effects
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  addParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        size: Math.random() * 5 + 2,
        speedX: (Math.random() - 0.5) * 5,
        speedY: (Math.random() - 0.5) * 5,
        color,
        alpha: 1,
        life: Math.random() * 30 + 10,
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.speedX;
      p.y += p.speedY;
      p.alpha -= 0.02;
      p.life--;

      if (p.life <= 0 || p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw() {
    this.particles.forEach((p) => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
}

const particleSystem = new ParticleSystem();

// Background with parallax effect
class Background {
  constructor() {
    this.layers = [
      { speed: 0.2, elements: [] },
      { speed: 0.5, elements: [] },
      { speed: 0.8, elements: [] },
    ];

    // Add stars to background
    for (let i = 0; i < 50; i++) {
      const layer = Math.floor(Math.random() * this.layers.length);
      this.layers[layer].elements.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.7,
        size: Math.random() * 3 + 1,
        color: `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.3})`,
      });
    }
  }

  update(playerVelocityX) {
    this.layers.forEach((layer) => {
      layer.elements.forEach((element) => {
        if (
          keys.rightKey.pressed &&
          player.position.x >= proportionalSize(400)
        ) {
          element.x -= layer.speed * 5;
        } else if (
          keys.leftKey.pressed &&
          player.position.x > proportionalSize(100)
        ) {
          element.x += layer.speed * 5;
        }

        // Wrap around screen
        if (element.x < -element.size) element.x = canvas.width + element.size;
        if (element.x > canvas.width + element.size) element.x = -element.size;
      });
    });
  }

  draw() {
    this.layers.forEach((layer) => {
      layer.elements.forEach((element) => {
        ctx.fillStyle = element.color;
        ctx.beginPath();
        ctx.arc(element.x, element.y, element.size, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }
}

const background = new Background();

class Player {
  constructor() {
    this.position = {
      x: proportionalSize(100),
      y: proportionalSize(400),
    };
    this.velocity = {
      x: 0,
      y: 0,
    };
    this.width = proportionalSize(40);
    this.height = proportionalSize(40);
    this.isJumping = false;
    this.jumpCount = 0;
    this.maxJumps = 2; // Double jump capability
    this.color = "#64b5f6";
    this.trailCounter = 0;
    this.trail = [];
    this.jumpPower = 18; // Increased jump power for higher jumps (was 15)
  }

  draw() {
    // Draw shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.ellipse(
      this.position.x + this.width / 2,
      this.position.y + this.height + 5,
      this.width / 2,
      this.width / 6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Draw player
    ctx.fillStyle = this.color;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

    // Draw face
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(
      this.position.x + this.width * 0.7,
      this.position.y + this.height * 0.3,
      this.width * 0.15,
      this.height * 0.15
    );
    ctx.fillRect(
      this.position.x + this.width * 0.3,
      this.position.y + this.height * 0.3,
      this.width * 0.15,
      this.height * 0.15
    );

    // Add trail effect when moving
    if (Math.abs(this.velocity.x) > 0 || Math.abs(this.velocity.y) > 0) {
      this.trailCounter++;
      if (this.trailCounter % 5 === 0) {
        this.trail.push({
          x: this.position.x,
          y: this.position.y,
          width: this.width,
          height: this.height,
          alpha: 0.7,
        });
      }
    }

    // Draw and update trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = this.color;
      ctx.fillRect(t.x, t.y, t.width, t.height);
      t.alpha -= 0.1;

      if (t.alpha <= 0) {
        this.trail.splice(i, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  update() {
    this.draw();
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Check if player is falling or at the bottom of the screen
    if (this.position.y + this.height + this.velocity.y <= canvas.height) {
      // Apply gravity (removed top boundary check)
      this.velocity.y += gravity;
    } else {
      // Player is on the ground
      this.velocity.y = 0;
      this.position.y = canvas.height - this.height;
      this.isJumping = false;
      this.jumpCount = 0;
    }

    // Keep player within canvas bounds horizontally only
    if (this.position.x < 0) {
      this.position.x = 0;
    }
    if (this.position.x >= canvas.width - this.width) {
      this.position.x = canvas.width - this.width;
    }
  }

  jump() {
    // Allow double jump
    if (this.jumpCount < this.maxJumps) {
      this.velocity.y = -this.jumpPower;
      this.isJumping = true;
      this.jumpCount++;

      // Play jump sound
      jumpSound.currentTime = 0;
      jumpSound.play().catch((e) => console.log("Audio play failed:", e));

      // Add jump particles
      particleSystem.addParticles(
        this.position.x + this.width / 2,
        this.position.y + this.height,
        this.color,
        8
      );
    }
  }
}

class Platform {
  constructor(x, y) {
    this.position = {
      x,
      y,
    };
    this.width = 200;
    this.height = proportionalSize(30);
    this.color = "#66bb6a";
  }

  draw() {
    // Draw platform shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(
      this.position.x + 5,
      this.position.y + this.height,
      this.width,
      10
    );

    // Draw platform
    const gradient = ctx.createLinearGradient(
      this.position.x,
      this.position.y,
      this.position.x,
      this.position.y + this.height
    );
    gradient.addColorStop(0, "#7bca7b");
    gradient.addColorStop(1, "#66bb6a");

    ctx.fillStyle = gradient;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

    // Add platform details (texture)
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    for (let i = 0; i < this.width; i += 30) {
      ctx.fillRect(this.position.x + i, this.position.y + 5, 15, 3);
    }
  }
}

class CheckPoint {
  constructor(x, y, id) {
    this.position = {
      x,
      y,
    };
    this.width = proportionalSize(40);
    this.height = proportionalSize(70);
    this.claimed = false;
    this.id = id;
    this.bounceOffset = 0;
    this.bounceDirection = 1;
    this.rotationAngle = 0;
  }

  draw() {
    if (this.claimed) return;

    // Update bounce animation
    this.bounceOffset += 0.05 * this.bounceDirection;
    if (this.bounceOffset > 5 || this.bounceOffset < 0) {
      this.bounceDirection *= -1;
    }

    // Update rotation
    this.rotationAngle += 0.02;

    // Save current context state
    ctx.save();

    // Move to checkpoint center
    ctx.translate(
      this.position.x + this.width / 2,
      this.position.y + this.height / 2 + this.bounceOffset
    );

    // Rotate
    ctx.rotate(this.rotationAngle);

    // Draw the checkpoint (a gold star)
    const starSize = this.width * 0.8;

    // Draw glow effect
    ctx.shadowColor = "#ffdd59";
    ctx.shadowBlur = 15;

    // Fill star with gold gradient
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, starSize);
    gradient.addColorStop(0, "#ffe66d");
    gradient.addColorStop(1, "#ffca28");
    ctx.fillStyle = gradient;

    // Draw a star shape
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const outerRadius = starSize / 2;
      const innerRadius = starSize / 4;

      // Outer point
      ctx.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);

      // Inner point
      const innerAngle = angle + Math.PI / 5;
      ctx.lineTo(
        Math.cos(innerAngle) * innerRadius,
        Math.sin(innerAngle) * innerRadius
      );
    }
    ctx.closePath();
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Restore context state
    ctx.restore();
  }

  claim() {
    if (this.claimed) return;

    this.claimed = true;
    collectedCheckpoints++;
    collectedCheckpointsElement.textContent = collectedCheckpoints;

    // Play checkpoint sound
    checkpointSound.currentTime = 0;
    checkpointSound.play().catch((e) => console.log("Audio play failed:", e));

    // Create particles explosion
    particleSystem.addParticles(
      this.position.x + this.width / 2,
      this.position.y + this.height / 2,
      "#ffdd59",
      20
    );

    // Update position to be out of the game
    this.position.y = Infinity;
    this.width = 0;
    this.height = 0;

    // Check if all checkpoints are collected
    if (collectedCheckpoints >= checkpoints.length) {
      setTimeout(() => {
        endGame();
      }, 1000);
    }
  }
}

// Initialize game objects
const player = new Player();

// Updated platform positions with new higher platforms
const platformPositions = [
  { x: 500, y: proportionalSize(450) },
  { x: 700, y: proportionalSize(400) },
  { x: 850, y: proportionalSize(350) },
  { x: 900, y: proportionalSize(350) },
  { x: 1050, y: proportionalSize(150) },
  { x: 1200, y: proportionalSize(50) }, // New higher platform
  { x: 2500, y: proportionalSize(450) },
  { x: 2900, y: proportionalSize(400) },
  { x: 3150, y: proportionalSize(350) },
  { x: 3400, y: proportionalSize(250) }, // New higher platform
  { x: 3650, y: proportionalSize(150) }, // New higher platform
  { x: 3900, y: proportionalSize(450) },
  { x: 4200, y: proportionalSize(400) },
  { x: 4400, y: proportionalSize(200) },
  { x: 4700, y: proportionalSize(150) },
  { x: 4900, y: proportionalSize(50) }, // New higher platform
];

const platforms = platformPositions.map(
  (platform) => new Platform(platform.x, platform.y)
);

// Updated checkpoint positions to include one at the top of the screen
const checkpointPositions = [
  { x: 1170, y: proportionalSize(80), id: 1 },
  { x: 2900, y: proportionalSize(330), id: 2 },
  { x: 4800, y: proportionalSize(80), id: 3 },
  { x: 4950, y: proportionalSize(0), id: 4 }, // New checkpoint at the top
];

const checkpoints = checkpointPositions.map(
  (checkpoint) => new CheckPoint(checkpoint.x, checkpoint.y, checkpoint.id)
);

// Set total checkpoints in UI
totalCheckpointsElement.textContent = checkpoints.length;

const keys = {
  rightKey: {
    pressed: false,
  },
  leftKey: {
    pressed: false,
  },
};

// Game animation loop
const animate = () => {
  if (!gameActive) return;

  requestAnimationFrame(animate);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  background.update();
  background.draw();

  // Draw platforms
  platforms.forEach((platform) => {
    platform.draw();
  });

  // Draw checkpoints
  checkpoints.forEach((checkpoint) => {
    checkpoint.draw();
  });

  // Update and draw particles
  particleSystem.update();
  particleSystem.draw();

  // Update player
  player.update();

  // Handle player movement
  if (keys.rightKey.pressed && player.position.x < proportionalSize(400)) {
    player.velocity.x = 5;
  } else if (
    keys.leftKey.pressed &&
    player.position.x > proportionalSize(100)
  ) {
    player.velocity.x = -5;
  } else {
    player.velocity.x = 0;

    // Camera following player by moving objects
    if (keys.rightKey.pressed && isCheckpointCollisionDetectionActive) {
      platforms.forEach((platform) => {
        platform.position.x -= 5;
      });

      checkpoints.forEach((checkpoint) => {
        checkpoint.position.x -= 5;
      });
    } else if (keys.leftKey.pressed && isCheckpointCollisionDetectionActive) {
      platforms.forEach((platform) => {
        platform.position.x += 5;
      });

      checkpoints.forEach((checkpoint) => {
        checkpoint.position.x += 5;
      });
    }
  }

  // Platform collision detection - FIXED COLLISION LOGIC
  platforms.forEach((platform) => {
    // Check if player is landing on platform
    const collisionDetectionRules = [
      player.position.y + player.height <= platform.position.y,
      player.position.y + player.height + player.velocity.y >=
        platform.position.y,
      player.position.x + player.width >= platform.position.x,
      player.position.x <= platform.position.x + platform.width,
    ];

    if (collisionDetectionRules.every((rule) => rule)) {
      player.velocity.y = 0;
      player.position.y = platform.position.y - player.height;
      player.isJumping = false;
      player.jumpCount = 0;

      // Add landing particles
      if (player.velocity.y > 2) {
        particleSystem.addParticles(
          player.position.x + player.width / 2,
          player.position.y + player.height,
          platform.color,
          5
        );
      }
    }
  });

  // Checkpoint collision detection
  checkpoints.forEach((checkpoint, index, checkpoints) => {
    if (checkpoint.claimed) return;

    const checkpointDetectionRules = [
      player.position.x + player.width >= checkpoint.position.x,
      player.position.x <= checkpoint.position.x + checkpoint.width,
      player.position.y + player.height >= checkpoint.position.y,
      player.position.y <= checkpoint.position.y + checkpoint.height,
      isCheckpointCollisionDetectionActive,
      index === 0 || checkpoints[index - 1].claimed === true,
    ];

    if (checkpointDetectionRules.every((rule) => rule)) {
      checkpoint.claim();
      showCheckpointScreen(
        index === checkpoints.length - 1
          ? "Final checkpoint reached!"
          : `Checkpoint ${index + 1} reached!`
      );
    }
  });
};

// Event handlers for player movement
const movePlayer = (key, isPressed) => {
  if (!isCheckpointCollisionDetectionActive) return;

  switch (key) {
    case "ArrowLeft":
      keys.leftKey.pressed = isPressed;
      break;
    case "ArrowUp":
    case " ":
    case "Spacebar":
      if (isPressed) player.jump();
      break;
    case "ArrowRight":
      keys.rightKey.pressed = isPressed;
      break;
  }
};

// Start the game
const startGame = () => {
  // Reset game state
  collectedCheckpoints = 0;
  collectedCheckpointsElement.textContent = collectedCheckpoints;
  isCheckpointCollisionDetectionActive = true;
  gameActive = true;

  // Reset player position
  player.position.x = proportionalSize(100);
  player.position.y = proportionalSize(400);
  player.velocity.x = 0;
  player.velocity.y = 0;

  // Reset checkpoints
  checkpoints.forEach((checkpoint, index) => {
    checkpoint.claimed = false;
    checkpoint.position.x = checkpointPositions[index].x;
    checkpoint.position.y = checkpointPositions[index].y;
    checkpoint.width = proportionalSize(40);
    checkpoint.height = proportionalSize(70);
  });

  // Reset platforms
  platforms.forEach((platform, index) => {
    platform.position.x = platformPositions[index].x;
    platform.position.y = platformPositions[index].y;
  });

  // Show game elements
  canvas.style.display = "block";
  gameHUD.style.display = "block";
  startScreen.style.display = "none";
  victoryScreen.style.display = "none";

  // Start the game loop
  gameStartTime = Date.now();
  animate();
};

// Show checkpoint notification
const showCheckpointScreen = (msg) => {
  checkpointScreen.style.display = "block";
  checkpointMessage.textContent = msg;

  setTimeout(() => {
    checkpointScreen.style.display = "none";
  }, 2000);
};

// End game and show victory screen
const endGame = () => {
  gameActive = false;
  isCheckpointCollisionDetectionActive = false;

  // Play victory sound
  victorySound.currentTime = 0;
  victorySound.play().catch((e) => console.log("Audio play failed:", e));

  // Show victory screen
  setTimeout(() => {
    canvas.style.display = "none";
    gameHUD.style.display = "none";
    victoryScreen.style.display = "block";
  }, 1000);
};

// Event listeners
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (e) => {
  movePlayer(e.key, true);
});

window.addEventListener("keyup", (e) => {
  movePlayer(e.key, false);
});

// Resize handler
window.addEventListener("resize", () => {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
});

// Mobile controls
const addTouchControls = () => {
  const touchControls = document.createElement("div");
  touchControls.className = "touch-controls";
  document.body.appendChild(touchControls);

  const leftBtn = document.createElement("button");
  leftBtn.className = "touch-btn left-btn";
  leftBtn.innerHTML = "&#8592;";
  touchControls.appendChild(leftBtn);

  const rightBtn = document.createElement("button");
  rightBtn.className = "touch-btn right-btn";
  rightBtn.innerHTML = "&#8594;";
  touchControls.appendChild(rightBtn);

  const jumpBtn = document.createElement("button");
  jumpBtn.className = "touch-btn jump-btn";
  jumpBtn.innerHTML = "Jump";
  touchControls.appendChild(jumpBtn);

  // Touch events
  leftBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    movePlayer("ArrowLeft", true);
  });

  leftBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    movePlayer("ArrowLeft", false);
  });

  rightBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    movePlayer("ArrowRight", true);
  });

  rightBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    movePlayer("ArrowRight", false);
  });

  jumpBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    movePlayer("ArrowUp", true);
  });

  // Add styles for touch controls
  const style = document.createElement("style");
  style.textContent = `
    .touch-controls {
      position: fixed;
      bottom: 20px;
      left: 0;
      width: 100%;
      display: flex;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 100;
      pointer-events: none;
    }
    
    .touch-btn {
      width: 60px;
      height: 60px;
      background-color: rgba(255, 255, 255, 0.3);
      border: 2px solid white;
      border-radius: 50%;
      color: white;
      font-size: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
    }
    
    .jump-btn {
      width: 80px;
      height: 80px;
      font-size: 18px;
    }
    
    @media (min-width: 768px) {
      .touch-controls {
        display: none;
      }
    }
  `;
  document.head.appendChild(style);
};

// Check if device supports touch
if ("ontouchstart" in window || navigator.maxTouchPoints) {
  addTouchControls();
}
