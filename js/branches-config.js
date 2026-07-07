/* ==========================================================
   CONFIGURATION DES BRANCHES — hiérarchie complète
   Niveau 1 : branches (parent: null)
   Niveau 2 : sous-catégories (parent: clé de la branche)
   "page" = fichier HTML de cette catégorie
   ========================================================== */

const BRANCHES = {
  musique: { label: "Musique", parent: null, page: "musique.html" },
  "musique-son": { label: "Chansons produites", parent: "musique", page: "musique-son.html" },
  "musique-projet": { label: "Projets produits", parent: "musique", page: "musique-projet.html" },

  video: { label: "Vidéo", parent: null, page: "video.html" },
  "video-montage": { label: "Montage", parent: "video", page: "video-montage.html" },
  "video-realisation": { label: "Réalisation", parent: "video", page: "video-realisation.html" },

  vfx: { label: "VFX", parent: null, page: "vfx.html" },
  "vfx-generatif": { label: "Génératif", parent: "vfx", page: "vfx-generatif.html" },
  "vfx-interactif": { label: "Interactif", parent: "vfx", page: "vfx-interactif.html" },
  "vfx-video": { label: "Basé sur vidéo", parent: "vfx", page: "vfx-video.html" }
};

/* Retourne les sous-catégories (enfants) d'une branche */
function getChildren(branchKey){
  return Object.keys(BRANCHES).filter(k => BRANCHES[k].parent === branchKey);
}

/* Retourne les branches de premier niveau (pour le Hub) */
function getTopLevelBranches(){
  return Object.keys(BRANCHES).filter(k => BRANCHES[k].parent === null);
}

