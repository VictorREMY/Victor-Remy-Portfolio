/* ==========================================================
   CONFIGURATION DES BRANCHES
   Ceci est la structure fixe du site (Musique / Vidéo / VFX
   et leurs sous-catégories). Contrairement aux projets, ça ne
   change pas souvent — donc ça reste dans le code plutôt que
   dans le CMS. Si un jour tu ajoutes une branche entière, on
   modifiera ce fichier ensemble.
   ========================================================== */

const BRANCHES = {
  musique: { label: "Musique", parent: null, page: "musique.html" },
  "video-montage": { label: "Montage", parent: "video", page: "video.html" },
  "video-realisation": { label: "Réalisation", parent: "video", page: "video.html" },
  "vfx-generatif": { label: "Génératif", parent: "vfx", page: "vfx.html" },
  "vfx-interactif": { label: "Interactif", parent: "vfx", page: "vfx.html" },
  "vfx-video": { label: "Basé sur vidéo", parent: "vfx", page: "vfx.html" }
};
