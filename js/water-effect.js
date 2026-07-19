/* ============================================================================
   FOND ANIMÉ — v10, basée sur ton vrai rendu TouchDesigner
   ============================================================================
   Par défaut (CONFIG.ENABLE_CURSOR_EFFECT = false), ce fichier affiche
   simplement ta vraie boucle vidéo exportée depuis TouchDesigner, en plein
   écran, SANS aucune interactivité de curseur — aucune retouche de
   couleur/grain/netteté, ton rendu tel quel. C'est la base stable actuelle
   du site.

   Tout le système interactif développé avant (trou qui suit la souris,
   siphon en vortex, traînée qui s'estompe, panneau de réglages en direct)
   est TOUJOURS PRÉSENT dans ce fichier plus bas, juste inactif. Pour le
   rebrancher un jour, il suffit de repasser CONFIG.ENABLE_CURSOR_EFFECT à
   `true` — rien d'autre à réécrire :

   1) Un "trou" sombre qui suit la souris, TOUJOURS net et bien visible,
      même en bougeant vite (voir point 3).
   2) Un effet de SIPHON en vortex : la texture est aspirée vers le trou en
      tournant sur elle-même, et cette rotation est ANIMÉE en continu dans
      le temps (pas une simple déformation figée) — comme un vrai tourbillon
      qui aspire l'eau. Un tout petit flou local dans la zone d'aspiration
      évite l'effet "pixels cassés". La force du siphon s'annule en douceur
      tout près des bords de l'écran, donc l'échantillonnage ne sort jamais
      de la vidéo (pas besoin de zoomer/cacher quoi que ce soit pour ça).
      (Désactivé par défaut : PULL_STRENGTH = 0.)
   3) Une TRAÎNÉE qui "creuse" derrière le trou : on n'accumule PAS l'image
      entière (ça la floute), seulement un masque (juste "à quel point ce
      pixel est-il actuellement dans un trou, passé ou présent") qui
      s'estompe avec le temps. Chaque frame, ce masque = le plus grand entre
      "le trou maintenant" et "l'ancien masque affaibli" (jamais un mélange
      à 50/50) : la position actuelle du trou est donc TOUJOURS affichée à
      pleine intensité, jamais diluée par la traînée — elle reste nette et
      visible pendant qu'elle se déplace, avec juste un sillage qui la suit.
   4) Fond : par défaut la vidéo est ré-échelonnée pour remplir exactement
      l'écran (CONFIG.FIT_MODE = 'stretch') — aucun bord, aucune marge,
      aucun fondu, juste ta vidéo d'un bord à l'autre. Un mode 'cover'
      (sans étirement, avec un léger recadrage) reste disponible si tu
      préfères plus tard.

   TOUT CE QUI EST RÉGLABLE (pour le mode interactif) est dans CONFIG juste
   en dessous, ET modifiable en direct via le panneau de réglages
   (CONFIG.SHOW_DEBUG_PANEL, actif seulement si ENABLE_CURSOR_EFFECT = true)
   qui s'affiche en haut à droite de la page — avec un bouton pour copier
   tous les réglages actuels et me les recoller directement dans le chat.
   ========================================================================= */

import * as THREE from 'three';
import GUI from 'lil-gui';

// ============================================================================
// CONFIG — les réglages à toucher en priorité
// ============================================================================
const CONFIG = {
  // --- Interrupteur principal ---
  // false = fond vidéo simple, plein écran, aucune interactivité (état
  // actuel du site). true = rebranche tout le système interactif ci-dessous
  // (trou + siphon + traînée + panneau de réglages), exactement comme avant.
  ENABLE_CURSOR_EFFECT: false,

  // --- Mouvement organique additionnel (optionnel, mode interactif seulement) ---
  // Ta vidéo TD bouge déjà toute seule (c'est le vrai mouvement designé
  // dans TD) : ce warp est donc désactivé par défaut (0). Ne monte cette
  // valeur que si tu veux ajouter un léger mouvement supplémentaire.
  WARP_AMOUNT: 0,
  WARP_SPEED: 1.0,

  // --- Trou interactif (souris) ---
  HOLE_RADIUS: 0.045,     // rayon du trou (0-1 = largeur d'écran)
  HOLE_SOFTNESS: 0.035,   // largeur du dégradé sur le bord du trou
  HOLE_COLOR: 0x02090a,   // couleur du trou À LA POSITION ACTUELLE (assombrissement, calé sur les tons sombres de ta vidéo)
  // Désactivé pour l'instant (mis à 0) : le rendu du siphon faisait "cheap"
  // par rapport à ta version TD. Le trou + la traînée restent actifs sans
  // lui. Remonte PULL_STRENGTH (dans le code ou le panneau) si tu veux le
  // retester plus tard — tout le reste du système est toujours là.
  PULL_STRENGTH: 0,       // force du siphon (aspiration VERS le trou, façon eau qui part dans une bonde)
  SWIRL_STRENGTH: 1.8,    // torsion du siphon selon la distance (façon tourbillon figé)
  SWIRL_SPEED: 2.2,       // vitesse de rotation ANIMÉE du tourbillon (radians/seconde, 0 = pas de mouvement)
  PULL_SOFTNESS: 0,       // léger flou appliqué juste dans la zone d'aspiration, pour un rendu "fluide"
                          // plutôt que des pixels qui se déchirent (désactivé avec le siphon)
  MOUSE_SMOOTHING: 0.15,  // lissage du mouvement de la souris (0 = instantané)

  // --- Traînée (le trou "creuse" un sillage qui s'estompe derrière lui) ---
  TRAIL_AMOUNT: 0.9,       // à quel point le sillage persiste d'une frame à l'autre (0 = pas de traînée, proche de 1 = traînée très longue)
  TRAIL_COLOR: 0x0c222b,   // couleur vers laquelle le sillage dérive en s'estompant (bleu foncé, calé sur les tons du fond) —
                           // le trou actuel reste HOLE_COLOR, seule la partie "traînée" (passée) tend vers cette couleur

  // --- Cadrage du fond ---
  // 'stretch' : la vidéo est ré-échelonnée pour remplir exactement l'écran,
  //             aucun bord, aucun recadrage (peut légèrement déformer la
  //             vidéo si la fenêtre a un ratio très différent de la vidéo).
  // 'cover'   : la vidéo garde ses proportions et remplit l'écran en étant
  //             recadrée sur les bords (comme CSS background-size: cover).
  FIT_MODE: 'stretch',

  // --- Vidéo source (ta boucle exportée depuis TouchDesigner) ---
  useVideo: true,
  videoSrc: 'assets/water-td.mp4',

  // --- Panneau de réglages en direct (lil-gui) ---
  // Pratique pour affiner tous les paramètres ci-dessus sans toucher au
  // code : recharge juste la page pour repartir des valeurs par défaut.
  // Mets à `false` avant de mettre en ligne si tu ne veux pas que tes
  // visiteurs le voient (ou laisse tel quel, ça ne gêne pas la démo).
  SHOW_DEBUG_PANEL: false,
};

// ============================================================================
// PASSE 1 — shader "instantané" : vidéo (avec siphon) + masque du trou
// ============================================================================
// Cette passe NE mélange PAS encore le trou dans l'image : elle sort la
// vidéo bien nette d'un côté (rgb), et juste "à quel point on est dans le
// trou maintenant" de l'autre (alpha, 0 à 1). C'est la passe 2 (traînée) qui
// décide ensuite, pixel par pixel, à quel point assombrir — en tenant compte
// à la fois du trou actuel ET de ce qu'il reste de la traînée.
const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const INSTANT_FRAGMENT_SHADER = /* glsl */`
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uVideoTex;
  uniform bool uVideoReady;
  uniform float uTime;
  uniform vec2 uMouse;       // 0-1, origine en bas à gauche (comme vUv)
  uniform bool uMouseInside;
  uniform float uAspect;     // largeur/hauteur de l'écran

  uniform vec2 uUvScale;     // cadrage du fond (voir CONFIG.FIT_MODE)
  uniform vec2 uUvOffset;

  uniform float uWarpAmount;
  uniform float uWarpSpeed;
  uniform float uHoleRadius;
  uniform float uHoleSoftness;
  uniform float uPullStrength;
  uniform float uSwirlStrength;
  uniform float uSwirlSpeed;
  uniform float uPullSoftness;

  // Bruit pseudo-aléatoire simple (utilisé seulement si WARP_AMOUNT > 0)
  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  // Échantillon vidéo toujours dans les bornes (0-1) : jamais de pixel de
  // bord répété/étiré visible.
  vec3 sampleVideo(vec2 uv) {
    vec2 c = clamp(uv, 0.0, 1.0);
    return uVideoReady ? texture2D(uVideoTex, c).rgb : vec3(0.05, 0.08, 0.08);
  }

  void main() {
    vec2 uv = vUv;

    // --- Distance au curseur (corrigée de l'aspect pour un trou bien rond) ---
    vec2 toMouse = uv - uMouse;
    toMouse.x *= uAspect;
    float dist = length(toMouse);
    vec2 dir = dist > 0.0001 ? toMouse / dist : vec2(0.0);

    // --- Mouvement organique additionnel (désactivé par défaut, voir CONFIG) ---
    vec2 warp = vec2(0.0);
    if (uWarpAmount > 0.0) {
      float n1 = noise(uv * 5.0 + uTime * uWarpSpeed * 0.06);
      float n2 = noise(uv * 9.0 - uTime * uWarpSpeed * 0.09 + 12.0);
      warp = (vec2(n1, n2) - 0.5) * uWarpAmount;
    }

    // --- Siphon : la texture est ASPIRÉE vers le trou (pas repoussée), comme
    // de l'eau qui part dans une bonde, en tournant sur elle-même (vortex). ---
    float pullZone = uMouseInside ? smoothstep(uHoleRadius * 3.0, uHoleRadius * 0.9, dist) : 0.0;

    // Ne jamais aspirer au-delà du bord réel de l'écran : la force du siphon
    // s'annule en douceur tout près des bords, donc l'échantillonnage ne
    // sort jamais de la vidéo, sans avoir besoin de zoomer/cacher quoi que
    // ce soit pour compenser.
    float edgeSafety = smoothstep(0.0, 0.05, min(uv.x, 1.0 - uv.x))
                      * smoothstep(0.0, 0.05, min(uv.y, 1.0 - uv.y));
    pullZone *= edgeSafety;

    // Rotation : une torsion qui dépend de la distance (SWIRL_STRENGTH) +
    // une rotation qui tourne en continu dans le temps (SWIRL_SPEED) — le
    // tourbillon est donc réellement animé, pas juste une déformation figée
    // qui ne bouge que quand la souris bouge.
    float swirlAngle = uSwirlStrength * pullZone + uTime * uSwirlSpeed;
    float sA = sin(swirlAngle);
    float cA = cos(swirlAngle);
    vec2 swirlDir = vec2(dir.x * cA - dir.y * sA, dir.x * sA + dir.y * cA);

    vec2 pull = vec2(swirlDir.x / uAspect, swirlDir.y) * pullZone * uPullStrength;

    // --- Échantillonnage vidéo (cadrage selon CONFIG.FIT_MODE) ---
    vec2 baseUv = (uv - 0.5) * uUvScale + 0.5 + uUvOffset + warp;
    vec2 sampleUv = baseUv + pull;

    vec3 sharpColor = sampleVideo(sampleUv);

    // --- Léger flou dans la zone d'aspiration seulement : la déformation y
    // est forte, un tout petit flou local évite l'aspect "pixels cassés" et
    // se rapproche plutôt d'un vrai mouvement de matière fluide. ---
    vec2 texel = vec2(uPullSoftness * 0.0015);
    vec3 blurred = sharpColor;
    blurred += sampleVideo(sampleUv + vec2(texel.x, 0.0));
    blurred += sampleVideo(sampleUv - vec2(texel.x, 0.0));
    blurred += sampleVideo(sampleUv + vec2(0.0, texel.y));
    blurred += sampleVideo(sampleUv - vec2(0.0, texel.y));
    blurred *= 0.2;

    vec3 src = mix(sharpColor, blurred, pullZone);

    // --- Masque du trou MAINTENANT (pas encore mélangé dans la couleur —
    // voir passe 2/3 pour savoir pourquoi) ---
    float hole = uMouseInside ? (1.0 - smoothstep(uHoleRadius - uHoleSoftness, uHoleRadius, dist)) : 0.0;

    gl_FragColor = vec4(src, hole);
  }
`;

// ============================================================================
// PASSE 2 — accumulation de la traînée (masque uniquement, pas l'image)
// ============================================================================
// nouveauMasque = le plus grand entre "le trou maintenant" et "l'ancien
// masque affaibli". Comme c'est un MAX (pas un mélange), la position
// actuelle du trou est toujours à pleine intensité — jamais diluée par la
// traînée, donc jamais "presque invisible" en bougeant. Et comme on
// n'accumule qu'un masque (pas la vidéo elle-même), la traînée ne floute
// jamais l'image — elle "creuse" juste un sillage qui s'estompe.
const TRAIL_FRAGMENT_SHADER = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uInstantTex;   // .a = masque du trou maintenant
  uniform sampler2D uPrevMaskTex;  // .r = masque accumulé de la frame précédente
  uniform float uDecay;
  void main() {
    float currentMask = texture2D(uInstantTex, vUv).a;
    float prevMask = texture2D(uPrevMaskTex, vUv).r;
    float newMask = max(currentMask, prevMask * uDecay);
    gl_FragColor = vec4(newMask, newMask, newMask, 1.0);
  }
`;

// ============================================================================
// PASSE 3 — image finale : vidéo nette + trou (courant + traînée)
// ============================================================================
const FINAL_FRAGMENT_SHADER = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uInstantTex; // .rgb = vidéo nette (siphon compris)
  uniform sampler2D uMaskTex;    // .r = masque du trou (courant + traînée)
  uniform vec3 uHoleColor;       // couleur du trou à pleine intensité (position actuelle)
  uniform vec3 uTrailColor;      // couleur vers laquelle le sillage dérive en s'estompant (bleu foncé)
  void main() {
    vec3 src = texture2D(uInstantTex, vUv).rgb;
    float mask = texture2D(uMaskTex, vUv).r;
    // Le trou à pleine intensité (mask proche de 1, position actuelle de la
    // souris) reste sombre (uHoleColor). En s'estompant (mask qui descend
    // vers 0, sillage de la traînée), la couleur dérive vers uTrailColor —
    // un bleu foncé qui se fond avec le reste du fond au lieu de rester
    // noir jusqu'au bout.
    vec3 digColor = mix(uTrailColor, uHoleColor, mask);
    vec3 finalColor = mix(src, digColor * 0.3, mask);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// ÉTAT PARTAGÉ
// ============================================================================
let renderer;
let sharedCamera;
let instantScene, instantMaterial;
let trailScene, trailMaterial;
let finalScene, finalMaterial;
let rtInstant, rtAccumA, rtAccumB;
let readAccum, writeAccum;
let firstFrame = true;

let videoEl = null;
let videoTexture = null;
let clock = new THREE.Clock();
let containerRef = null;

const mouseRaw = { x: 0.5, y: 0.5 };
const mouseSmooth = { x: 0.5, y: 0.5 };
let mouseInside = false;

// ============================================================================
// MODE SIMPLE — fond vidéo plein écran, sans aucune interactivité
// ============================================================================
// Pas de WebGL, pas de three.js : juste une <video> HTML classique, en
// boucle, redimensionnée en CSS. C'est le mode actif par défaut
// (CONFIG.ENABLE_CURSOR_EFFECT = false).
function initSimpleWaterEffect(container) {
  container.style.overflow = 'hidden';

  const video = document.createElement('video');
  video.src = CONFIG.videoSrc;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.style.position = 'absolute';
  video.style.inset = '0';
  video.style.width = '100%';
  video.style.height = '100%';
  // 'stretch' -> object-fit: fill (ré-échelonne pour remplir exactement
  // l'écran, comme le mode 'stretch' du système interactif). 'cover' ->
  // object-fit: cover (proportions gardées, léger recadrage sur les bords).
  video.style.objectFit = CONFIG.FIT_MODE === 'cover' ? 'cover' : 'fill';

  video.play().catch(() => {
    const resume = () => { video.play(); window.removeEventListener('pointerdown', resume); };
    window.addEventListener('pointerdown', resume);
  });

  container.appendChild(video);
}

// ============================================================================
// INITIALISATION
// ============================================================================
export function initWaterEffect(container) {
  if (!CONFIG.ENABLE_CURSOR_EFFECT) {
    initSimpleWaterEffect(container);
    return;
  }
  initInteractiveWaterEffect(container);
}

function initInteractiveWaterEffect(container) {
  containerRef = container;
  const width = container.clientWidth;
  const height = container.clientHeight;

  sharedCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  // On veut que la vidéo garde ses couleurs d'origine (c'est ton vrai rendu
  // TD, pas la peine de la retraiter) : on désactive donc les conversions
  // automatiques de Three.js pour éviter toute double conversion qui
  // fausserait les couleurs.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // --- Texture vidéo (ou une couleur neutre tant qu'elle n'est pas prête) ---
  if (CONFIG.useVideo && CONFIG.videoSrc) {
    videoEl = document.createElement('video');
    videoEl.src = CONFIG.videoSrc;
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.autoplay = true;
    videoEl.addEventListener('loadedmetadata', () => {
      updateFitUv();
    });
    videoEl.play().catch(() => {
      const resume = () => { videoEl.play(); window.removeEventListener('pointerdown', resume); };
      window.addEventListener('pointerdown', resume);
    });
    videoTexture = new THREE.VideoTexture(videoEl);
    videoTexture.colorSpace = THREE.NoColorSpace;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
  }

  // --- Passe 1 : scène "instantanée" (vidéo + siphon + masque du trou) ---
  instantScene = new THREE.Scene();
  instantMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: INSTANT_FRAGMENT_SHADER,
    uniforms: {
      uVideoTex: { value: videoTexture },
      uVideoReady: { value: false },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseInside: { value: false },
      uAspect: { value: width / height },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uUvOffset: { value: new THREE.Vector2(0, 0) },
      uWarpAmount: { value: CONFIG.WARP_AMOUNT },
      uWarpSpeed: { value: CONFIG.WARP_SPEED },
      uHoleRadius: { value: CONFIG.HOLE_RADIUS },
      uHoleSoftness: { value: CONFIG.HOLE_SOFTNESS },
      uPullStrength: { value: CONFIG.PULL_STRENGTH },
      uSwirlStrength: { value: CONFIG.SWIRL_STRENGTH },
      uSwirlSpeed: { value: CONFIG.SWIRL_SPEED },
      uPullSoftness: { value: CONFIG.PULL_SOFTNESS },
    },
  });
  instantScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), instantMaterial));

  // --- Passe 2 : accumulation du masque de traînée ---
  trailScene = new THREE.Scene();
  trailMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: TRAIL_FRAGMENT_SHADER,
    uniforms: {
      uInstantTex: { value: null },
      uPrevMaskTex: { value: null },
      uDecay: { value: CONFIG.TRAIL_AMOUNT },
    },
  });
  trailScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMaterial));

  // --- Passe 3 : image finale affichée à l'écran ---
  finalScene = new THREE.Scene();
  finalMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FINAL_FRAGMENT_SHADER,
    uniforms: {
      uInstantTex: { value: null },
      uMaskTex: { value: null },
      uHoleColor: { value: hexToVec3(CONFIG.HOLE_COLOR) },
      uTrailColor: { value: hexToVec3(CONFIG.TRAIL_COLOR) },
    },
  });
  finalScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finalMaterial));

  // --- Cibles de rendu hors-écran (une pour l'image instantanée, deux en
  // "ping-pong" pour se souvenir du masque de traînée d'une frame à l'autre) ---
  const rtOptions = { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const bufW = Math.round(width * pixelRatio);
  const bufH = Math.round(height * pixelRatio);
  rtInstant = new THREE.WebGLRenderTarget(bufW, bufH, rtOptions);
  rtAccumA = new THREE.WebGLRenderTarget(bufW, bufH, rtOptions);
  rtAccumB = new THREE.WebGLRenderTarget(bufW, bufH, rtOptions);
  readAccum = rtAccumA;
  writeAccum = rtAccumB;

  function updateFitUv() {
    if (CONFIG.FIT_MODE === 'stretch' || !videoEl || !videoEl.videoWidth) {
      // Pas de recadrage : la vidéo est ré-échelonnée pour remplir
      // exactement l'écran, d'un bord à l'autre.
      instantMaterial.uniforms.uUvScale.value.set(1, 1);
      instantMaterial.uniforms.uUvOffset.value.set(0, 0);
      return;
    }
    // Mode 'cover' : proportions gardées, léger recadrage sur les bords.
    const videoAspect = videoEl.videoWidth / videoEl.videoHeight;
    const screenAspect = container.clientWidth / container.clientHeight;
    let sx = 1, sy = 1;
    if (screenAspect > videoAspect) {
      sy = screenAspect / videoAspect;
    } else {
      sx = videoAspect / screenAspect;
    }
    instantMaterial.uniforms.uUvScale.value.set(sx, sy);
    instantMaterial.uniforms.uUvOffset.value.set(0, 0);
  }
  updateFitUv();

  // --- Panneau de réglages en direct (voir CONFIG.SHOW_DEBUG_PANEL) ---
  // Permet d'ajuster tous les paramètres ci-dessus sans toucher au code,
  // en temps réel, et de me renvoyer facilement tes réglages préférés.
  if (CONFIG.SHOW_DEBUG_PANEL) {
    const u = instantMaterial.uniforms;
    const gui = new GUI({ title: "Réglages — effet d'eau" });

    const holeFolder = gui.addFolder('Trou');
    holeFolder.add(CONFIG, 'HOLE_RADIUS', 0.01, 0.15, 0.001).name('taille').onChange(v => { u.uHoleRadius.value = v; });
    holeFolder.add(CONFIG, 'HOLE_SOFTNESS', 0.005, 0.08, 0.001).name('douceur du bord').onChange(v => { u.uHoleSoftness.value = v; });
    holeFolder.addColor(CONFIG, 'HOLE_COLOR').name('couleur').onChange(v => { finalMaterial.uniforms.uHoleColor.value.copy(hexToVec3(v)); });

    const siphonFolder = gui.addFolder('Siphon');
    siphonFolder.add(CONFIG, 'PULL_STRENGTH', 0, 0.15, 0.001).name('force').onChange(v => { u.uPullStrength.value = v; });
    siphonFolder.add(CONFIG, 'SWIRL_STRENGTH', 0, 4, 0.05).name('torsion (selon distance)').onChange(v => { u.uSwirlStrength.value = v; });
    siphonFolder.add(CONFIG, 'SWIRL_SPEED', 0, 8, 0.1).name('vitesse de rotation').onChange(v => { u.uSwirlSpeed.value = v; });
    siphonFolder.add(CONFIG, 'PULL_SOFTNESS', 0, 4, 0.05).name('flou local').onChange(v => { u.uPullSoftness.value = v; });

    const trailFolder = gui.addFolder('Traînée');
    trailFolder.add(CONFIG, 'TRAIL_AMOUNT', 0, 0.97, 0.005).name('intensité');
    trailFolder.addColor(CONFIG, 'TRAIL_COLOR').name('couleur (en s\'estompant)').onChange(v => { finalMaterial.uniforms.uTrailColor.value.copy(hexToVec3(v)); });

    const mouseFolder = gui.addFolder('Souris');
    mouseFolder.add(CONFIG, 'MOUSE_SMOOTHING', 0.02, 0.6, 0.01).name('lissage');

    const displayFolder = gui.addFolder('Fond');
    displayFolder.add(CONFIG, 'FIT_MODE', ['stretch', 'cover']).name('cadrage').onChange(() => { updateFitUv(); });

    const warpFolder = gui.addFolder('Mouvement additionnel');
    warpFolder.add(CONFIG, 'WARP_AMOUNT', 0, 0.05, 0.001).name('intensité').onChange(v => { u.uWarpAmount.value = v; });
    warpFolder.add(CONFIG, 'WARP_SPEED', 0, 3, 0.05).name('vitesse').onChange(v => { u.uWarpSpeed.value = v; });
    warpFolder.close();

    // --- Bouton pour me communiquer facilement tes réglages : copie un
    // bloc de texte avec toutes les valeurs actuelles dans le
    // presse-papier, prêt à coller directement dans le chat. ---
    const exportActions = {
      'Copier les réglages': () => {
        const toHex = (v) => typeof v === 'number' ? '#' + v.toString(16).padStart(6, '0') : v;
        const lines = [
          `HOLE_RADIUS: ${CONFIG.HOLE_RADIUS}`,
          `HOLE_SOFTNESS: ${CONFIG.HOLE_SOFTNESS}`,
          `HOLE_COLOR: '${toHex(CONFIG.HOLE_COLOR)}'`,
          `PULL_STRENGTH: ${CONFIG.PULL_STRENGTH}`,
          `SWIRL_STRENGTH: ${CONFIG.SWIRL_STRENGTH}`,
          `SWIRL_SPEED: ${CONFIG.SWIRL_SPEED}`,
          `PULL_SOFTNESS: ${CONFIG.PULL_SOFTNESS}`,
          `TRAIL_AMOUNT: ${CONFIG.TRAIL_AMOUNT}`,
          `TRAIL_COLOR: '${toHex(CONFIG.TRAIL_COLOR)}'`,
          `MOUSE_SMOOTHING: ${CONFIG.MOUSE_SMOOTHING}`,
          `FIT_MODE: '${CONFIG.FIT_MODE}'`,
          `WARP_AMOUNT: ${CONFIG.WARP_AMOUNT}`,
          `WARP_SPEED: ${CONFIG.WARP_SPEED}`,
        ];
        const text = 'Mes réglages effet d\'eau :\n' + lines.join('\n');
        const done = () => {
          exportBtn.name('✓ Copié — colle-le moi dans le chat');
          setTimeout(() => exportBtn.name('Copier les réglages'), 2200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => {
            window.prompt('Copie ce texte (Ctrl+C / Cmd+C) puis colle-le moi :', text);
          });
        } else {
          window.prompt('Copie ce texte (Ctrl+C / Cmd+C) puis colle-le moi :', text);
        }
      },
    };
    const exportBtn = gui.add(exportActions, 'Copier les réglages');
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerleave', () => { mouseInside = false; });
  window.addEventListener('resize', () => {
    onResize(container);
    updateFitUv();
  });

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (mouseInside) {
      mouseSmooth.x += (mouseRaw.x - mouseSmooth.x) * CONFIG.MOUSE_SMOOTHING;
      mouseSmooth.y += (mouseRaw.y - mouseSmooth.y) * CONFIG.MOUSE_SMOOTHING;
    }

    instantMaterial.uniforms.uTime.value = t;
    instantMaterial.uniforms.uMouse.value.set(mouseSmooth.x, mouseSmooth.y);
    instantMaterial.uniforms.uMouseInside.value = mouseInside;
    instantMaterial.uniforms.uVideoReady.value = !!(videoEl && videoEl.readyState >= 2);

    // Passe 1 : vidéo nette (siphon) + masque du trou maintenant.
    renderer.setRenderTarget(rtInstant);
    renderer.render(instantScene, sharedCamera);

    // Passe 2 : nouveau masque de traînée = max(trou maintenant, ancien
    // masque affaibli). Sur la toute première frame, pas d'historique.
    trailMaterial.uniforms.uInstantTex.value = rtInstant.texture;
    trailMaterial.uniforms.uPrevMaskTex.value = readAccum.texture;
    trailMaterial.uniforms.uDecay.value = firstFrame ? 0.0 : CONFIG.TRAIL_AMOUNT;
    firstFrame = false;

    renderer.setRenderTarget(writeAccum);
    renderer.render(trailScene, sharedCamera);

    // Passe 3 : image finale = vidéo nette + assombrissement selon le masque.
    finalMaterial.uniforms.uInstantTex.value = rtInstant.texture;
    finalMaterial.uniforms.uMaskTex.value = writeAccum.texture;
    renderer.setRenderTarget(null);
    renderer.render(finalScene, sharedCamera);

    // Ping-pong : le masque qu'on vient d'écrire devient la référence pour
    // la prochaine frame.
    const tmp = readAccum;
    readAccum = writeAccum;
    writeAccum = tmp;
  }
  animate();
}

function hexToVec3(hex) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

function onPointerMove(e) {
  mouseRaw.x = e.clientX / window.innerWidth;
  mouseRaw.y = 1 - e.clientY / window.innerHeight; // origine en bas comme les UV
  mouseInside = true;
}

function onResize(container) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const pixelRatio = renderer.getPixelRatio();
  renderer.setSize(width, height);
  instantMaterial.uniforms.uAspect.value = width / height;

  const bufW = Math.round(width * pixelRatio);
  const bufH = Math.round(height * pixelRatio);
  rtInstant.setSize(bufW, bufH);
  rtAccumA.setSize(bufW, bufH);
  rtAccumB.setSize(bufW, bufH);
  firstFrame = true; // évite un mélange avec une accumulation à la mauvaise taille
}
