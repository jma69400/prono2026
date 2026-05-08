/**
 * United Pronos — Gestion de la langue cross-page + Google Analytics
 *
 * Ce script est chargé sur chaque page SEO statique.
 * Il assure que la langue choisie par l'utilisateur (dans l'app React
 * ou dans le sélecteur d'une page SEO) est appliquée partout.
 * Il charge aussi Google Analytics 4 si configuré côté backend.
 *
 * Logique :
 * 1. Au chargement, lit localStorage.prono26_lang
 * 2. Si la langue stockée diffère de celle de la page actuelle, redirige
 *    automatiquement vers la version équivalente dans la bonne langue
 * 3. Quand l'utilisateur clique sur un drapeau du lang-switcher,
 *    met à jour localStorage AVANT la navigation
 * 4. Récupère /api/config pour charger Google Analytics 4 si configuré
 */
(function () {
  'use strict';

  // ============================
  // GOOGLE ANALYTICS 4
  // ============================
  function loadGoogleAnalytics(measurementId) {
    if (!measurementId) return;
    // Eviter le double chargement
    if (window._gaLoaded) return;
    window._gaLoaded = true;

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { anonymize_ip: true });
  }

  // Fetch la config (best-effort, on continue même si KO)
  try {
    fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
      if (cfg && cfg.analytics && cfg.analytics.enabled && cfg.analytics.ga_measurement_id) {
        loadGoogleAnalytics(cfg.analytics.ga_measurement_id);
      }
    }).catch(function () { /* silent */ });
  } catch (e) { /* fetch indispo */ }


  // ============================
  // GESTION DE LA LANGUE
  // ============================
  // Déterminer la langue de la page actuelle depuis l'attribut <html lang="...">
  var pageLang = document.documentElement.lang || 'fr';
  if (pageLang.length > 2) pageLang = pageLang.substring(0, 2);

  // Lire la langue stockée
  var storedLang = null;
  try {
    storedLang = localStorage.getItem('prono26_lang');
  } catch (e) { /* localStorage inaccessible (mode privé Safari) */ }

  // Auto-redirect : si l'utilisateur a déjà choisi une langue différente
  // dans l'app, on redirige vers la version équivalente
  if (storedLang && storedLang !== pageLang && ['fr', 'en', 'es'].indexOf(storedLang) !== -1) {
    // Chercher le lien hreflang correspondant
    var altLink = document.querySelector('link[rel="alternate"][hreflang="' + storedLang + '"]');
    if (altLink) {
      // On évite la boucle si on est déjà arrivé via redirect (paramètre ?nolangredirect)
      if (window.location.search.indexOf('nolangredirect') === -1) {
        window.location.replace(altLink.href);
        return;
      }
    }
  }

  // Si pas de langue stockée OU si elle correspond à la page : on enregistre la langue de la page
  if (!storedLang || storedLang !== pageLang) {
    try { localStorage.setItem('prono26_lang', pageLang); } catch (e) {}
  }

  // Intercepter les clics sur le sélecteur de langue pour stocker la nouvelle langue
  document.addEventListener('DOMContentLoaded', function () {
    var switcher = document.querySelector('.lang-switcher');
    if (!switcher) return;
    switcher.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link || !link.href) return;
      // Détecter la langue cible depuis l'URL ou le texte du lien
      var href = link.getAttribute('href') || '';
      var newLang = 'fr';
      if (href.indexOf('/en/') !== -1) newLang = 'en';
      else if (href.indexOf('/es/') !== -1) newLang = 'es';
      try { localStorage.setItem('prono26_lang', newLang); } catch (e2) {}
      // On laisse la navigation native se poursuivre (pas de preventDefault)
    });
  });
})();
