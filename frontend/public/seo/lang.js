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
  // DÉTECTION AUTOMATIQUE DE LANGUE
  // ============================
  /**
   * Détecte la langue préférée de l'utilisateur via navigator.languages.
   * Renvoie 'fr', 'en' ou 'es' ou null si aucune préférence claire.
   */
  function detectBrowserLang() {
    var langs = [];
    if (navigator.languages && navigator.languages.length) {
      for (var i = 0; i < navigator.languages.length; i++) {
        langs.push(navigator.languages[i]);
      }
    }
    if (navigator.language) langs.push(navigator.language);

    for (var j = 0; j < langs.length; j++) {
      var code = langs[j].toLowerCase().substring(0, 2);
      if (code === 'fr' || code === 'en' || code === 'es') return code;
    }
    return null;
  }


  // ============================
  // GESTION DE LA LANGUE
  // ============================
  // Déterminer la langue de la page actuelle depuis l'attribut <html lang="...">
  var pageLang = document.documentElement.lang || 'fr';
  if (pageLang.length > 2) pageLang = pageLang.substring(0, 2);

  // Lire les préférences stockées
  var storedLang = null;
  var manualLang = null;
  try {
    storedLang = localStorage.getItem('prono26_lang');
    manualLang = localStorage.getItem('prono26_lang_manual');
  } catch (e) { /* localStorage inaccessible (mode privé Safari) */ }

  // Déterminer la langue cible :
  // 1. Choix manuel (priorité absolue) si présent
  // 2. Sinon langue détectée par le navigateur
  // 3. Sinon langue stockée
  // 4. Sinon pageLang (français par défaut)
  var targetLang = manualLang;
  var langSource = 'manual';

  if (!targetLang) {
    var browserLang = detectBrowserLang();
    if (browserLang) {
      targetLang = browserLang;
      langSource = 'auto';
    } else if (storedLang) {
      targetLang = storedLang;
      langSource = 'stored';
    } else {
      targetLang = pageLang;
      langSource = 'default';
    }
  }

  // Auto-redirect : si on est sur une page d'une autre langue que la langue cible
  // Évite la boucle infinie via le paramètre ?nolangredirect ou si déjà sur la bonne langue
  if (targetLang !== pageLang && ['fr', 'en', 'es'].indexOf(targetLang) !== -1) {
    var altLink = document.querySelector('link[rel="alternate"][hreflang="' + targetLang + '"]');
    if (altLink && window.location.search.indexOf('nolangredirect') === -1) {
      // Sauve la langue détectée AVANT de rediriger pour que la page suivante la voie
      try {
        localStorage.setItem('prono26_lang', targetLang);
        if (langSource === 'auto') {
          localStorage.setItem('prono26_lang_auto', '1');
        }
      } catch (e) {}
      window.location.replace(altLink.href);
      return;
    }
  }

  // On est sur la bonne page : on s'assure que localStorage est à jour
  try {
    localStorage.setItem('prono26_lang', targetLang);
    if (langSource === 'auto') {
      localStorage.setItem('prono26_lang_auto', '1');
    }
  } catch (e) {}

  // Intercepter les clics sur le sélecteur de langue pour stocker la nouvelle langue
  // ET la marquer comme CHOIX MANUEL (priorité sur la détection auto)
  document.addEventListener('DOMContentLoaded', function () {
    var switcher = document.querySelector('.lang-switcher');
    if (!switcher) return;
    switcher.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link || !link.href) return;
      var href = link.getAttribute('href') || '';
      var newLang = 'fr';
      if (href.indexOf('/en/') !== -1) newLang = 'en';
      else if (href.indexOf('/es/') !== -1) newLang = 'es';
      try {
        localStorage.setItem('prono26_lang', newLang);
        localStorage.setItem('prono26_lang_manual', newLang);
        localStorage.removeItem('prono26_lang_auto');
      } catch (e2) {}
    });
  });
})();
