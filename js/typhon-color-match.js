/* ============================================================================
   MATCHING COULEUR DES BULLES TYPHON — teinte calée en direct sur le fond
   ============================================================================
   Problème résolu : les bulles typhon (.syphon-typhon) sont désynchronisées
   entre elles (chacune démarre sa lecture à un instant aléatoire, voir
   addTyphonBubble dans main.js) pour ne pas avoir l'air d'un copier-coller.
   Ça rend impossible un matching couleur "figé à l'export" : la couleur du
   fond change dans le temps, mais chaque bulle est à une phase différente de
   sa propre boucle, donc une teinte baked au montage dérive vite.

   Solution : on échantillonne la couleur MOYENNE du fond, EN DIRECT, toutes
   les 600ms environ (pas besoin de plus souvent, la teinte évolue lentement),
   et on la traduit en un filtre CSS (hue-rotate + saturate + brightness)
   appliqué à TOUTES les bulles typhon d'un coup via une variable CSS
   partagée (--typhon-filter). Comme l'échantillon est pris sur la frame du
   fond réellement affichée à l'instant T, ça reste cohérent quel que soit le
   déphasage de lecture entre les bulles.

   Ne touche PAS à addTyphonBubble ni à la désynchronisation existante :
   100% additif. Réutilise la vidéo de fond déjà chargée par water-effect.js
   (via getBackgroundVideoElement) plutôt que d'en décoder une deuxième copie
   — important pour les perfs vu le nombre de vidéos déjà lues sur le site.
   ========================================================================= */

// Trouve la vidéo de fond directement dans la page (élément #water-bg),
// sans dépendre d'un import depuis water-effect.js (plus robuste : si ce
// module change ou se charge dans un ordre différent, on ne plante pas).
function getBackgroundVideoElement() {
  const bg = document.getElementById('water-bg');
  if (!bg) return null;
  return bg.querySelector('video') || document.querySelector('#water-bg video');
}

const CONFIG = {
  sampleIntervalMs: 600,   // fréquence d'échantillonnage de la couleur du fond
  sampleSize: 8,           // résolution du mini-canvas d'échantillonnage (8x8 suffit largement pour une moyenne)

  // Teinte de référence du typhon actuel (mesurée une fois sur l'export
  // final) — c'est le point de départ que le filtre fait pivoter/ajuster
  // pour matcher la couleur du fond. À remesurer si tu réexportes le
  // typhon avec une colorimétrie de base différente.
  baseHue: 184,     // degrés (0-360)
  baseSat: 0.90,     // 0-1
  baseLight: 0.88,   // 0-1

  // Garde-fous pour éviter un filtre trop extrême/moche si le fond passe
  // par une couleur inhabituelle (ex. transition, flash) :
  maxSaturateFactor: 1.6,
  minSaturateFactor: 0.85,
  maxBrightnessFactor: 1.4,
  minBrightnessFactor: 1.0,    // JAMAIS assombrir (le typhon doit rester visible)

  // Le typhon exporté est très sombre (~50/255) et manque de contraste
  // propre, donc il se noie aussi bien sur fond clair que sombre. On mise
  // surtout sur le CONTRASTE (ressort quel que soit le fond) + un léger
  // boost de luminosité, complétés par une ombre portée en CSS.
  typhonBrightnessBoost: 1.35,  // multiplie la luminosité (1 = inchangé)
  typhonContrast: 1.6,          // renforce le contraste (1 = inchangé)

  transitionSeconds: 0.8,  // douceur du changement de filtre (évite les à-coups)
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

export function initTyphonColorMatch() {
  console.log('[typhon-color-match] démarré');
  // Règle CSS injectée une seule fois : lit la variable --typhon-filter
  // (mise à jour périodiquement plus bas) avec une transition douce.
  const style = document.createElement('style');
  style.textContent = `
    .syphon-typhon {
      filter: var(--typhon-filter, none);
      transition: filter ${CONFIG.transitionSeconds}s ease;
    }
  `;
  document.head.appendChild(style);

  const canvas = document.createElement('canvas');
  canvas.width = CONFIG.sampleSize;
  canvas.height = CONFIG.sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  function sampleAndApply() {
    const bgVideo = getBackgroundVideoElement();
    if (!bgVideo || bgVideo.readyState < 2) return; // pas encore de frame dispo

    try {
      ctx.drawImage(bgVideo, 0, 0, CONFIG.sampleSize, CONFIG.sampleSize);
      const { data } = ctx.getImageData(0, 0, CONFIG.sampleSize, CONFIG.sampleSize);

      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      r /= n; g /= n; b /= n;

      const { h, s, l } = rgbToHsl(r, g, b);

      let hueRotate = h - CONFIG.baseHue;
      if (hueRotate > 180) hueRotate -= 360;
      if (hueRotate < -180) hueRotate += 360;

      let saturateFactor = CONFIG.baseSat > 0.01 ? s / CONFIG.baseSat : 1;
      saturateFactor = Math.min(CONFIG.maxSaturateFactor, Math.max(CONFIG.minSaturateFactor, saturateFactor));

      let brightnessFactor = CONFIG.baseLight > 0.01 ? l / CONFIG.baseLight : 1;
      brightnessFactor = Math.min(CONFIG.maxBrightnessFactor, Math.max(CONFIG.minBrightnessFactor, brightnessFactor));
      // Boost de base : le typhon exporté est très sombre (~50/255), il se
      // noie dans le fond sombre. On l'éclaircit et le contraste pour qu'il
      // ressorte, en plus de l'ajustement de teinte.
      brightnessFactor *= CONFIG.typhonBrightnessBoost;

      const filterValue = `hue-rotate(${hueRotate.toFixed(1)}deg) saturate(${saturateFactor.toFixed(2)}) brightness(${brightnessFactor.toFixed(2)}) contrast(${CONFIG.typhonContrast}) drop-shadow(0 0 6px rgba(0,0,0,0.55))`;
      document.documentElement.style.setProperty('--typhon-filter', filterValue);

      // Couleur sombre du fond pour le disque central des bulles : on reprend
      // la couleur moyenne échantillonnée et on l'assombrit nettement (un
      // chouïa plus sombre que le fond) pour qu'elle ressorte tout en restant
      // dans la même famille de teinte. Évite le "rond noir posé".
      const darkFactor = 0.45;  // 0 = noir, 1 = couleur moyenne du fond
      const cr = Math.round(r * darkFactor);
      const cg = Math.round(g * darkFactor);
      const cb = Math.round(b * darkFactor);
      document.documentElement.style.setProperty('--typhon-core', `rgb(${cr}, ${cg}, ${cb})`);
    } catch (e) {
      // Silencieux : un échec ponctuel (ex. frame pas encore prête) n'est
      // pas grave, on retente au prochain intervalle.
    }
  }

  // Pas besoin d'échantillonner quand l'onglet n'est pas visible (perf).
  let intervalId = setInterval(sampleAndApply, CONFIG.sampleIntervalMs);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(intervalId);
    } else {
      intervalId = setInterval(sampleAndApply, CONFIG.sampleIntervalMs);
      sampleAndApply();
    }
  });

  sampleAndApply();
}
