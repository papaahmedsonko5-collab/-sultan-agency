/* Contenus de secours, utilisés si la base Supabase ne répond pas.
   La source principale est la base (modifiable depuis admin.html).
   Garder ces valeurs identiques à la base pour éviter des prix contradictoires.
   Clé publique (publishable) uniquement : jamais de clé secrète ici. */
window.SULTAN = {
  api: {
    url: 'https://vfobcgsabgkteixywsxw.supabase.co',
    key: 'sb_publishable_pJrpnAe7bWEb5BOfQHXbmA__YUNWfYR'
  },
  contact: {
    whatsapp: '221781482035',
    whatsappLabel: '+221 78 148 20 35',
    email: 'papaahmedsonko5@gmail.com',
    instagram: 'https://www.instagram.com/sultan.experiences',
    snapchat: 'https://www.snapchat.com/add/sultanthebest29'
  },
  /* Frais non compris dans les prix de départ (affichés pour chaque formule) */
  exclusions: [
    'Nom de domaine : facturé à part',
    'Hébergement et services tiers : précisés et chiffrés dans le devis',
    'Maintenance : facultative, facturée à part'
  ],
  pricing: [
    { id: 'landing', name: 'Landing page', price: 80000, priceLabel: null, badge: '', active: true, order: 1, category: 'site',
      description: 'Une page unique pour présenter une offre, un événement ou une activité.',
      options: 'Maintenance après la mise en ligne, à la demande, facturée à part' },
    { id: 'vitrine', name: 'Site vitrine', price: 200000, priceLabel: null, badge: '', active: true, order: 2, category: 'site',
      description: 'Plusieurs pages pour présenter votre activité, vos services et vos contacts.',
      audience: 'Restaurants, hôtels, associations.',
      options: 'Maintenance après la mise en ligne, à la demande, facturée à part' },
    { id: 'professionnel', name: 'Site professionnel', price: 350000, priceLabel: null, badge: 'Populaire', active: true, order: 3, category: 'site',
      description: 'Site complet, contenu structuré, référencement de base et formulaire de contact.',
      audience: 'PME, professionnels, entrepreneurs.',
      features: 'Contenu structuré\nRéférencement de base\nFormulaire de contact',
      options: 'Maintenance après la mise en ligne, à la demande, facturée à part' },
    { id: 'ecommerce', name: 'E-commerce', price: 500000, priceLabel: null, badge: '', active: true, order: 4, category: 'site',
      description: 'Boutique en ligne avec catalogue de produits et prise de commande.',
      audience: 'Boutiques, vendeurs en ligne.',
      features: 'Catalogue de produits\nPrise de commande',
      options: 'Maintenance après la mise en ligne, à la demande, facturée à part' },
    { id: 'premium', name: 'Site premium', price: 650000, priceLabel: null, badge: '', active: true, order: 5, category: 'site',
      description: 'Design sur mesure poussé et fonctionnalités avancées selon votre besoin.',
      options: 'Maintenance après la mise en ligne, à la demande, facturée à part' },
    { id: 'ia', name: 'Site avec IA', price: 750000, priceLabel: null, badge: '', active: true, order: 6, category: 'site',
      description: 'Site avec une fonction d\'intelligence artificielle intégrée, par exemple un assistant.',
      audience: 'Entreprises qui veulent automatiser une partie de leur relation client.',
      features: 'Assistant IA intégré à votre site, adapté à votre besoin',
      options: 'Maintenance après la mise en ligne, à la demande, facturée à part' }
  ],
  /* Captures d'écran locales (dossier images/projets), utilisées si la base n'a pas d'image */
  shots: {
    'keur yaye rokhaya': 'images/projets/keur-yaye-rokhaya.jpg',
    'talla graphique': 'images/projets/talla-graphique.jpg',
    'sultan agency': 'images/projets/sultan-agency.jpg'
  },
  projects: [
    { id: 'keur-yaye-rokhaya', title: 'Keur Yaye Rokhaya', category: 'E-commerce', status: 'Terminé',
      description: 'Boutique de produits Apple et smartphones à Dakar, avec commande sur WhatsApp.', url: 'https://keuryayerokhaya.com/', image: null, published: true, order: 1 },
    { id: 'talla-graphique', title: 'Talla Graphique', category: 'Site professionnel', status: 'Terminé',
      description: 'Site professionnel et portfolio d\'un photographe et film maker, avec réservation.', url: 'https://tallaniang.com/', image: null, published: true, order: 2 },
    { id: 'sultan-agency', title: 'Sultan Agency', category: 'Site vitrine', status: 'Terminé',
      description: 'Le site de l\'agence, avec demandes de devis enregistrées et tableau de bord privé.', url: null, image: null, published: true, order: 3 }
  ],
  gallery: []
};
