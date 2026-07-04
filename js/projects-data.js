/* ==========================================================
   BASE DE PROJETS
   Chaque projet est un objet avec ses "tags" (les branches
   et sous-catégories auxquelles il appartient).
   Pour AJOUTER un projet : copie un bloc { ... }, change les
   valeurs, ajoute-le dans le tableau ci-dessous.
   Un projet peut avoir PLUSIEURS tags (ex: musique + video).
   ========================================================== */

const PROJECTS = [
  {
    id: "surfeur-dargent",
    title: "Surfeur d'argent",
    year: 2025,
    tags: ["musique"],
    role: "Producteur",
    credits: "Artiste : Ové",
    description: "Ambiance planante liant plusieurs courants du rap pour développer une sonorité hybride, alliant l'énergie de la new jazz (notamment dans les accords) avec des sonorités plug dans la sound selection et les drums.",
    media: { type: "spotify", url: "https://open.spotify.com/intl-fr/track/7r84jFWfJeTtIhvDPUdxdn" }
  },
  {
    id: "plusquenetrap",
    title: "PlusQuneTrap",
    year: 2025,
    tags: ["musique"],
    role: "Producteur (6 titres sur 8)",
    credits: "Projet de : Mailow",
    description: "Pousser les productions vers un niveau de créativité élevé via l'expérimentation, tout en recadrant pour garder un résultat écoutable — équilibre entre prise de risque et accessibilité.",
    media: { type: "spotify", url: "https://open.spotify.com/intl-fr/album/74JsfVzC7NMeE5PweCQhoR" }
  },
  {
    id: "oneturnkill-visuel",
    title: "OneTurnKill — Visuel audioréactif",
    year: 2025,
    tags: ["vfx-generatif"],
    role: "Design VFX génératif",
    credits: "Pour : Mailow & Vtext, prod. Nxsada",
    description: "Rendu volontairement simple pour rester exploitable en arrière-plan de concert sur différents formats. L'enjeu : un contraste fort entre l'état de repos et l'état actif, où des particules apparaissent pour créer de l'intensité.",
    media: { type: "pending", note: "visuel à envoyer" }
  },
  {
    id: "ove-clip-feedback",
    title: "Feedback — VFX sur extrait clip",
    year: 2025,
    tags: ["vfx-video"],
    role: "Design VFX",
    credits: "Extraits du clip de : Ové",
    description: "Exploration du concept de feedback visuel, poussé jusqu'à faire apparaître la matière comme des particules, via un displace piloté par du bruit (noise) en input.",
    media: { type: "pending", note: "visuel à envoyer" }
  },
  {
    id: "boucle-mesh-piano",
    title: "Boucle mesh 3D + piano",
    year: 2025,
    tags: ["video-montage", "musique"],
    role: "Design 3D (TouchDesigner) + composition piano + montage",
    credits: null,
    description: "Design TouchDesigner à partir d'un mesh 3D, dont plusieurs plans ont été montés pour obtenir une boucle visuelle accordée avec une boucle de piano composée pour l'occasion.",
    media: { type: "pending", note: "visuel à envoyer" }
  },
  {
    id: "chaquejours",
    title: "ChaqueJours",
    year: 2025,
    tags: ["musique", "video-montage", "video-realisation"],
    role: "Production musicale, réalisation, tournage, montage",
    credits: "Artiste : Mailow",
    description: "Clip pensé pour un résultat dynamique et coloré, en contraste avec des plans plus classiques. Chanson également produite par mes soins.",
    media: { type: "youtube", url: "https://youtu.be/Ya8XBiCIqKw" }
  }
];

/* Liste des branches/sous-catégories utilisées pour les filtres.
   "page" = le fichier HTML vers lequel renvoie ce tag (utile pour
   le fil d'Ariane cliquable sur les fiches projets). */
const BRANCHES = {
  musique: { label: "Musique", parent: null, page: "musique.html" },
  "video-montage": { label: "Montage", parent: "video", page: "video.html" },
  "video-realisation": { label: "Réalisation", parent: "video", page: "video.html" },
  "vfx-generatif": { label: "Génératif", parent: "vfx", page: "vfx.html" },
  "vfx-interactif": { label: "Interactif", parent: "vfx", page: "vfx.html" },
  "vfx-video": { label: "Basé sur vidéo", parent: "vfx", page: "vfx.html" }
};
