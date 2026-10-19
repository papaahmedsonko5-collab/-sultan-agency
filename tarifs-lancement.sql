-- Tarifs de lancement Sultan Digital (octobre 2026)
-- À exécuter dans Supabase > SQL Editor (projet « Papa ahmed »), ou à reporter à la main dans admin.html > Tarifs.
-- Met à jour uniquement les 6 formules de sites (category = 'site'). Aucun changement de structure, de RLS ni de clé.
update public.pricing set price = 50000, price_label = null,
  audience = 'Lancement d''offre, événement, activité indépendante.',
  features = E'1 page unique, adaptée au téléphone\nBouton WhatsApp et appel direct\nRéférencement de base (titre et description)',
  limits = 'Une seule page. Textes et photos fournis par le client.'
where slug = 'landing';

update public.pricing set price = 120000, price_label = null,
  features = E'Jusqu''à 5 pages, adaptées au téléphone\nFormulaire de contact et bouton WhatsApp\nLiens vers vos réseaux sociaux\nRéférencement de base',
  limits = 'Pas de boutique ni d''espace client. Textes et photos fournis par le client.'
where slug = 'vitrine';

update public.pricing set price = 200000, price_label = null, badge = 'Populaire',
  features = E'Contenu structuré\nRéférencement de base\nFormulaire de contact\nJusqu''à 8 pages, adaptées au téléphone\nGalerie ou portfolio de vos réalisations',
  limits = 'Pas de vente en ligne. Fonctionnalités sur mesure : sur devis.'
where slug = 'professionnel';

update public.pricing set price = 300000, price_label = null, name = 'Boutique e-commerce',
  features = E'Catalogue de produits\nPrise de commande\nMise en ligne de vos 30 premiers produits\nCommande par WhatsApp ou formulaire',
  limits = 'Paiement en ligne (Wave, Orange Money, carte) : en option, frais du prestataire de paiement en plus.',
  options = E'Paiement en ligne, sur devis\nMaintenance après la mise en ligne, à la demande, facturée à part'
where slug = 'ecommerce';

update public.pricing set price = 450000, price_label = null,
  audience = 'Marques et entreprises qui veulent un site haut de gamme.',
  features = E'Design entièrement sur mesure\nJusqu''à 12 pages\nFonctionnalités avancées définies au devis (réservation, espace client, plusieurs langues…)',
  limits = 'Le détail des fonctionnalités avancées est fixé dans le devis.'
where slug = 'premium';

update public.pricing set price = 500000, price_label = null, name = 'Site avec intelligence artificielle',
  features = E'Assistant IA intégré à votre site, adapté à votre besoin\nRéponses basées sur les informations de votre activité',
  limits = 'Coût d''utilisation du service d''IA facturé à part, selon la consommation.'
where slug = 'ia';
