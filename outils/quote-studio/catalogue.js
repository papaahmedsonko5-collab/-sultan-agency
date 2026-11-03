/* Catalogue officiel Sultan Agency 2026-2027 — source unique des tarifs du Quote Studio et du catalogue PDF.
   unitPrice = 0 et onQuote = true : prestation « sur devis », le prix est saisi pour chaque projet. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SACatalogue = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var groups = [
    { id: 'sites', label: 'Création de sites web' },
    { id: 'infra', label: 'Hébergement, domaine et services techniques' },
    { id: 'services', label: 'Autres domaines de services' },
    { id: 'frais', label: 'Frais annexes' }
  ];
  var items = [
    { id: 'site-landing', group: 'sites', kind: 'service', label: 'Landing page', unitPrice: 175000, currency: 'XOF', recurrence: 'once',
      desc: 'Une page unique pour présenter une offre, un événement ou une activité. Adaptée au téléphone, bouton WhatsApp et appel direct, référencement de base.' },
    { id: 'site-vitrine', group: 'sites', kind: 'service', label: 'Site vitrine', unitPrice: 250000, currency: 'XOF', recurrence: 'once',
      desc: 'Jusqu\'à 5 pages pour présenter l\'activité, les services et les contacts. Formulaire de contact, bouton WhatsApp, liens vers les réseaux sociaux, référencement de base.' },
    { id: 'site-pro', group: 'sites', kind: 'service', label: 'Site professionnel', unitPrice: 400000, currency: 'XOF', recurrence: 'once', popular: true,
      desc: 'Site complet jusqu\'à 8 pages : contenu structuré, galerie ou portfolio des réalisations, formulaire de contact, référencement de base.' },
    { id: 'site-ecommerce', group: 'sites', kind: 'service', label: 'Boutique e-commerce', unitPrice: 500000, currency: 'XOF', recurrence: 'once',
      desc: 'Boutique en ligne avec catalogue de produits et prise de commande par WhatsApp ou formulaire. Paiement en ligne en option, sur devis.' },
    { id: 'site-premium', group: 'sites', kind: 'service', label: 'Site premium', unitPrice: 650000, currency: 'XOF', recurrence: 'once',
      desc: 'Design entièrement sur mesure, jusqu\'à 12 pages, fonctionnalités avancées définies au devis (réservation, espace client, plusieurs langues…).' },
    { id: 'site-ia', group: 'sites', kind: 'service', label: 'Site avec intelligence artificielle', unitPrice: 1000000, currency: 'XOF', recurrence: 'once',
      desc: 'Site intégrant une fonction d\'intelligence artificielle adaptée au besoin, par exemple un assistant répondant à partir des informations de l\'activité. Coût d\'utilisation du service d\'IA facturé selon la consommation.' },

    { id: 'infra-vercel', group: 'infra', kind: 'service', label: 'Hébergement Vercel Pro + gestion technique', unitPrice: 40, currency: 'USD', recurrence: 'month',
      desc: 'Hébergement du site sur Vercel (offre Pro), géré par Sultan Agency : configuration, mises en ligne et suivi technique.' },
    { id: 'infra-supabase', group: 'infra', kind: 'service', label: 'Supabase Pro + abonnement et gestion technique', unitPrice: 50, currency: 'USD', recurrence: 'month',
      desc: 'Abonnement Supabase Pro et gestion technique par Sultan Agency. Le client reste propriétaire de son compte Supabase, de son projet et de ses données.' },
    { id: 'infra-domaine', group: 'infra', kind: 'service', label: 'Nom de domaine + gestion', unitPrice: 20000, currency: 'XOF', recurrence: 'year',
      desc: 'Enregistrement et renouvellement du nom de domaine, au nom du client, qui peut en demander le transfert.' },
    { id: 'infra-maintenance', group: 'infra', kind: 'service', label: 'Maintenance et assistance technique', unitPrice: 0, currency: 'XOF', recurrence: 'month', onQuote: true,
      desc: 'Corrections, mises à jour et assistance après la mise en ligne, selon le niveau convenu.' },
    { id: 'infra-externe', group: 'infra', kind: 'service', label: 'Autre service externe', unitPrice: 0, currency: 'XOF', recurrence: 'month', onQuote: true,
      desc: 'Service tiers nécessaire au projet (licence, API, outil professionnel…), facturé selon le besoin.' },

    { id: 'svc-identite', group: 'services', kind: 'service', label: 'Identité visuelle et design graphique', unitPrice: 0, currency: 'XOF', recurrence: 'once', onQuote: true,
      desc: 'Logo, charte graphique, déclinaisons pour les supports imprimés et numériques.' },
    { id: 'svc-marketing', group: 'services', kind: 'service', label: 'Marketing digital et communication', unitPrice: 0, currency: 'XOF', recurrence: 'once', onQuote: true,
      desc: 'Stratégie de communication, campagnes de visibilité et accompagnement de l\'image de marque.' },
    { id: 'svc-reseaux', group: 'services', kind: 'service', label: 'Gestion des réseaux sociaux', unitPrice: 0, currency: 'XOF', recurrence: 'month', onQuote: true,
      desc: 'Gestion des pages Instagram, TikTok et autres réseaux : calendrier éditorial, publications, animation de la communauté.' },
    { id: 'svc-contenus', group: 'services', kind: 'service', label: 'Création de contenus photo et vidéo', unitPrice: 0, currency: 'XOF', recurrence: 'once', onQuote: true,
      desc: 'Vidéos promotionnelles, recaps et aftermovies d\'événements, contenus pour les réseaux sociaux.' },
    { id: 'svc-saas', group: 'services', kind: 'service', label: 'Application web / plateforme SaaS', unitPrice: 0, currency: 'XOF', recurrence: 'once', onQuote: true,
      desc: 'Application ou plateforme sur mesure : espace client, réservation, tableau de bord, outils internes. Paiement par étapes selon le calendrier convenu.' },
    { id: 'svc-entreprise', group: 'services', kind: 'service', label: 'Solution digitale pour entreprise', unitPrice: 0, currency: 'XOF', recurrence: 'once', onQuote: true,
      desc: 'Automatisation de processus, intégration d\'outils et, lorsque c\'est pertinent, de l\'intelligence artificielle.' },

    { id: 'frais-deplacement', group: 'frais', kind: 'fee', label: 'Frais de déplacement', unitPrice: 0, currency: 'XOF', recurrence: 'once', onQuote: true, desc: '' },
    { id: 'frais-licence', group: 'frais', kind: 'fee', label: 'Licence ou achat tiers', unitPrice: 0, currency: 'XOF', recurrence: 'once', onQuote: true, desc: '' }
  ];
  return { groups: groups, items: items };
});
