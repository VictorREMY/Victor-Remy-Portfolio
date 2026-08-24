/* ==========================================================
   ROUTEUR SPA (Single Page Application)
   --------------------------------------------------------
   Objectif : naviguer entre les "pages" (hub, catégories,
   sous-catégories) SANS recharger le document — donc sans
   jamais recharger le fond vidéo ni recréer tout le contexte.

   Le fond (#water-bg), le bandeau et le conteneur de bulles
   restent en place en permanence. Seul le contenu des bulles
   (#syphon-field) est régénéré à chaque changement de vue.

   La "page courante" est encodée dans le hash de l'URL :
     #/hub                → arbre des branches principales
     #/musique            → sous-catégories de musique
     #/musique-son        → projets tagués musique-son
     #/projet/<id>        → ouvre la fiche projet (popup)
   Ainsi les liens restent partageables (copier l'URL).
   ========================================================== */

(function(){
  const FIELD_ID = "syphon-field";
  let _currentView = null;  // clé de la vue de bulles actuellement affichée

  // Joue l'onde de transition plein écran (retire puis remet la classe pour
  // pouvoir rejouer l'animation à chaque changement de vue).
  function triggerViewFlash(){
    const ov = document.getElementById("view-transition-overlay");
    if(!ov) return;
    ov.classList.remove("wave");
    // force le reflow pour redémarrer l'animation même en changement rapide
    void ov.offsetWidth;
    ov.classList.add("wave");
  }

  // Construit l'arbre/les items pour une vue donnée, puis rend les bulles.
  function renderView(route){
    const field = document.getElementById(FIELD_ID);
    if(!field) return;

    // Déclenche le voile de transition plein écran (couvre fond + bulles) pour
    // marquer le changement de vue comme un vrai changement de page.
    triggerViewFlash();

    // Transition de sortie : fondu doux des bulles actuelles avant de les
    // remplacer (la plus fluide, comme convenu par défaut).
    field.classList.add("view-leaving");

    setTimeout(() => {
      field.innerHTML = "";
      field.classList.remove("view-leaving");

      const parts = route.split("/").filter(Boolean); // ex: ["musique-son"]
      const key = parts[0] || "accueil";
      _currentView = key;  // mémorise la vue affichée

      // Met à jour le fil d'ariane
      updateBreadcrumb(key);

      if(key === "accueil"){
        // Écran d'accueil : une seule bulle "Victor Remy" qui mène au hub.
        renderSyphons(FIELD_ID, [{ label: "Victor Remy", href: "#/hub", key: "home" }]);
      }
      else if(key === "hub" || key === "home"){
        // Vue hub : arbre des branches principales
        const tree = getTopLevelBranches().map(bKey => ({
          label: BRANCHES[bKey].label,
          href: "#/" + bKey,
          key: bKey,
          children: getChildren(bKey).map(cKey => ({
            label: BRANCHES[cKey].label,
            href: "#/" + cKey,
            key: cKey,
            children: []
          }))
        }));
        renderSyphonTree(FIELD_ID, tree);
      }
      else if(BRANCHES[key] && getChildren(key).length){
        // Vue branche (musique/vfx/video) : ses sous-catégories
        const tree = getChildren(key).map(cKey => ({
          label: BRANCHES[cKey].label,
          href: "#/" + cKey,
          key: cKey,
          children: []
        }));
        renderSyphonTree(FIELD_ID, tree);
      }
      else if(BRANCHES[key]){
        // Vue sous-catégorie : liste des projets tagués
        const items = getProjectsByTag(key).map(p => ({
          label: p.title,
          href: "#/projet/" + p.id,
          key: p.id,
          popup: true,
          thumbnail: p.thumbnail || null,
          contextTag: key
        }));
        renderSyphons(FIELD_ID, items);
      }
      else {
        // Route inconnue → retour au hub
        location.hash = "#/hub";
        return;
      }

      if(typeof initEditMode === "function") initEditMode();

      // Effet d'entrée : les nouvelles bulles arrivent depuis un léger flou.
      field.classList.add("view-entering");
      setTimeout(() => field.classList.remove("view-entering"), 350);
    }, 420); // le changement de bulles se fait quand l'onde couvre l'écran
  }

  // Met à jour le texte du fil d'ariane (chemin) en haut.
  function updateBreadcrumb(key){
    const el = document.getElementById("path-text");
    if(!el) return;
    if(key === "accueil"){ el.innerHTML = ""; return; }

    // Construit un fil d'ariane cliquable : chaque segment navigue vers sa vue.
    const crumbs = [];
    crumbs.push({ label: "hub", target: "hub" });

    if(key !== "hub" && key !== "home"){
      const b = BRANCHES[key];
      if(b){
        if(b.parent){
          crumbs.push({ label: BRANCHES[b.parent] ? BRANCHES[b.parent].label.toLowerCase() : b.parent, target: b.parent });
        }
        crumbs.push({ label: b.label.toLowerCase(), target: key });
      }
    }

    el.innerHTML = crumbs.map((c, i) => {
      const sep = i > 0 ? '<span class="crumb-sep"> / </span>' : "";
      // Le dernier segment (vue actuelle) n'est pas cliquable.
      const isLast = i === crumbs.length - 1;
      if(isLast){
        return sep + '<span class="crumb-current">' + c.label + '</span>';
      }
      return sep + '<a class="crumb-link" href="#/' + c.target + '">' + c.label + '</a>';
    }).join("");
  }

  // Gère l'ouverture d'une fiche projet via l'URL (#/projet/<id>)
  function handleProjectRoute(id){
    // Si aucune vue de bulles n'est encore affichée (arrivée directe par lien
    // partagé), on rend d'abord la sous-catégorie du projet en fond, pour que
    // la fermeture de la popup revienne sur des bulles et pas sur du vide.
    const field = document.getElementById(FIELD_ID);
    const fieldEmpty = field && field.children.length === 0;
    if(fieldEmpty && typeof PROJECTS !== "undefined"){
      const project = PROJECTS.find(p => p.id === id);
      if(project){
        const tags = (typeof projectTags === "function") ? projectTags(project) : [];
        const ctx = (tags && tags.length) ? tags[0] : "hub";
        renderViewImmediate(ctx);
      }
    }
    if(typeof openProjectPopup === "function"){
      openProjectPopup(id, null);
    }
  }

  // Rend une vue SANS transition de sortie (utilisé pour peupler le fond
  // instantanément derrière une popup ouverte par lien direct).
  function renderViewImmediate(key){
    const field = document.getElementById(FIELD_ID);
    if(!field) return;
    field.innerHTML = "";
    _currentView = key;  // mémorise la vue affichée
    updateBreadcrumb(key);
    if(BRANCHES[key] && getChildren(key).length){
      const tree = getChildren(key).map(cKey => ({
        label: BRANCHES[cKey].label, href: "#/" + cKey, key: cKey, children: []
      }));
      renderSyphonTree(FIELD_ID, tree);
    } else if(BRANCHES[key]){
      const items = getProjectsByTag(key).map(p => ({
        label: p.title, href: "#/projet/" + p.id, key: p.id,
        popup: true, thumbnail: p.thumbnail || null, contextTag: key
      }));
      renderSyphons(FIELD_ID, items);
    } else {
      // fallback hub
      const tree = getTopLevelBranches().map(bKey => ({
        label: BRANCHES[bKey].label, href: "#/" + bKey, key: bKey,
        children: getChildren(bKey).map(cKey => ({
          label: BRANCHES[cKey].label, href: "#/" + cKey, key: cKey, children: []
        }))
      }));
      renderSyphonTree(FIELD_ID, tree);
    }
    if(typeof initEditMode === "function") initEditMode();
  }

  // Point d'entrée : lit le hash et affiche la bonne vue.
  function route(){
    let hash = location.hash.replace(/^#\/?/, ""); // enlève "#/" ou "#"
    if(!hash){ hash = "accueil"; }

    if(hash.startsWith("projet/")){
      // Fiche projet : on garde la vue de bulles derrière, on ouvre la popup.
      const id = hash.slice("projet/".length);
      handleProjectRoute(id);
      return;
    }

    // Cas fermeture de popup : on revient à une vue de bulles. Si cette vue
    // est DÉJÀ celle affichée derrière la popup (même contexte), inutile de
    // tout recréer (ça rechargeait les typhons pour rien). On saute le rendu.
    if(window._spaClosingPopup){
      window._spaClosingPopup = false;
      if(hash === _currentView){
        return; // la vue est déjà là, on ne touche pas aux typhons
      }
    }

    renderView(hash);
  }

  // Expose une fonction de navigation pour les clics internes.
  window.spaNavigate = function(hashTarget){
    // hashTarget ex: "#/musique" ou "musique"
    const clean = hashTarget.replace(/^#\/?/, "");
    if(location.hash === "#/" + clean){
      // Déjà sur cette vue : forcer le re-rendu
      route();
    } else {
      location.hash = "#/" + clean;
    }
  };

  // Réagit aux changements d'URL (boutons précédent/suivant, liens).
  window.addEventListener("hashchange", route);

  // Premier rendu au chargement.
  window.spaInit = function(){
    route();
  };
})();
