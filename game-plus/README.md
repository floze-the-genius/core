# ВА-БАНК Deluxe / ALL IN Deluxe

The same casino clicker as `../game`, rebuilt with libraries where they add something visible:

- **Three.js**: a GPU shader background, physically based metal coins with bloom, the 3D coin toss, instanced 3D coin showers and the 3D vault door finale.
- **Tone.js**: FM bells, brass, drums and an adaptive soundtrack on the Transport.
- **Matter.js**: Plinko with real ball physics. Payout scaling was measured over 20 000 simulated drops.
- **GSAP**: letter-by-letter banners, the title animation, the coin toss timeline, tab transitions and count-up stats.
- **canvas-confetti**, **Lucide** icons, and the **Unbounded** and **Manrope** fonts.

Libraries load from cdnjs and jsDelivr. When WebGL is unavailable or software-rendered, the game falls back to the 2D renderer from the original edition. Without Tone.js it falls back to the Web Audio engine, and without Matter.js to the scripted Plinko. Add `?gl=1` to force 3D.
