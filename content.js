/* Source unique des contenus administrables.
   Phase C : ce fichier sera remplacé par les données Supabase.
   Les prix ne sont définis qu'ici. */
window.SULTAN = {
  contact: {
    whatsapp: '221781482035',
    whatsappLabel: '+221 78 148 20 35',
    email: 'papaahmedsonko5@gmail.com',
    instagram: 'https://www.instagram.com/sultan.experiences',
    snapchat: 'https://www.snapchat.com/add/sultanthebest29'
  },
  pricing: [
    { id: 'landing', name: 'Landing page', price: 100000, priceLabel: null, badge: '', active: true, order: 1,
      description: 'Une page unique pour présenter une offre, un événement ou une activité.' },
    { id: 'vitrine', name: 'Site vitrine', price: 200000, priceLabel: null, badge: '', active: true, order: 2,
      description: 'Plusieurs pages pour présenter votre activité, vos services et vos contacts.' },
    { id: 'professionnel', name: 'Site professionnel', price: 350000, priceLabel: null, badge: 'Populaire', active: true, order: 3,
      description: 'Site complet, contenu structuré, référencement de base et formulaire de contact.' },
    { id: 'ecommerce', name: 'E-commerce', price: 500000, priceLabel: null, badge: '', active: true, order: 4,
      description: 'Boutique en ligne avec catalogue de produits et prise de commande.' },
    { id: 'premium', name: 'Site premium', price: 650000, priceLabel: null, badge: '', active: true, order: 5,
      description: 'Design sur mesure poussé et fonctionnalités avancées selon votre besoin.' },
    { id: 'ia', name: 'Site avec IA', price: 750000, priceLabel: null, badge: '', active: true, order: 6,
      description: 'Site avec une fonction d\'intelligence artificielle intégrée, par exemple un assistant.' }
  ],
  projects: [
    { id: 'keur-yaye-rokhaya', title: 'Keur Yaye Rokhaya', category: 'E-commerce', status: 'Terminé',
      description: 'Boutique en ligne de produits Apple.', url: null, image: null, published: true, order: 1 },
    { id: 'talla-graphique', title: 'Talla Graphique', category: 'Site professionnel', status: 'Terminé',
      description: 'Création d\'un site web professionnel et portfolio.', url: null, image: null, published: true, order: 2 },
    { id: 'sultan-agency', title: 'Sultan Agency', category: 'Site vitrine', status: 'Terminé',
      description: 'Création du site de l\'agence.', url: null, image: null, published: true, order: 3 }
  ]
};
