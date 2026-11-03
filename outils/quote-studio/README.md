# Quote Studio — mode d'emploi

Outil interne de Sultan Agency pour créer des **devis** et des **factures** en PDF.

- **Adresse** (une fois publié) : `…/-sultan-agency/outils/quote-studio/`. La page n'est pas indexée par les moteurs de recherche et n'est liée nulle part sur le site.
- **En local** : ouvrez le dossier du site avec un petit serveur, par exemple `python3 -m http.server`, puis allez sur `http://localhost:8000/outils/quote-studio/`.

## Avant le premier devis : Réglages

1. **Taux USD → FCFA** : saisissez le taux du jour pour convertir les forfaits en dollars (Vercel 40 USD, Supabase 50 USD). Sans taux, les montants en USD restent affichés en USD et ne sont jamais additionnés aux FCFA. Le taux utilisé est imprimé sur le document.
2. **Coordonnées de l'agence** : vérifiez-les. Ajoutez votre NINEA, votre RCCM et vos **moyens de paiement réellement acceptés** (Wave, Orange Money, virement…). Ces champs sont vides tant que vous ne les remplissez pas.
3. **Conditions par défaut** : ce sont les conditions officielles 2026-2027. Le bouton « Rétablir » les restaure.

## Créer un devis

1. **Nouveau devis** : le numéro (`DEV-2026-001`, `DEV-2026-002`…) est attribué automatiquement.
2. **Client** : seul le nom est utile, tous les autres champs sont facultatifs.
3. **Prestations** :
   - **choisir dans le catalogue**, qui applique les prix officiels. Vous pouvez modifier le prix pour un projet précis.
   - **prestation sur devis** (identité visuelle, réseaux sociaux…) : elle arrive à 0 FCFA avec un cadre rouge, saisissez son prix.
   - **« + Prestation personnalisée »** pour une ligne libre, **« + Frais annexe »** pour un déplacement, une licence…
   - **Périodicité** : *Ponctuel*, *Mensuel* ou *Annuel*. Les abonnements apparaissent dans un bloc séparé et ne sont jamais ajoutés au total ponctuel.
4. **Remise** : en % ou en FCFA. Elle porte sur les prestations ponctuelles ; les frais annexes s'ajoutent après.
5. **Paiement** :
   - **standard** : 60 % à la commande, 40 % avant livraison ;
   - **personnalisé** (applications complexes) : autant d'échéances que nécessaire, avec dates. Une alerte s'affiche si le total ne fait pas 100 %.
6. **Interne** :
   - **notes privées** et **coût interne** par ligne permettent de suivre votre marge ;
   - **jamais** visibles dans l'aperçu ni dans le PDF.
7. **Télécharger le PDF**. L'outil vous prévient s'il manque un prix, un taux de change ou si l'échéancier est incomplet. **Imprimer** imprime uniquement le document.
8. Passez le statut à **Envoyé** une fois le devis transmis.

Un devis envoyé dont la date de validité (15 jours par défaut) est dépassée s'affiche automatiquement **Expiré**.

## Suivi et factures

- **Tableau de bord** : recherche par client, numéro ou objet ; filtres par type et par statut.
- **Dupliquer** crée une copie en brouillon avec un nouveau numéro.
- **Facturer** : sur un devis **Accepté**, crée une **facture distincte** (`FAC-2026-001`) qui rappelle le numéro du devis. Renseignez « Montant déjà réglé » (par exemple l'acompte) pour afficher le reste à payer.
- Supprimer une facture crée un trou dans la numérotation : préférez la conserver et la corriger.

## Sauvegarde : important

Les données sont enregistrées **uniquement dans le navigateur de l'appareil utilisé**. Rien n'est envoyé sur Internet.

- **Réglages › Exporter une sauvegarde** télécharge un fichier `.json`. Faites-le régulièrement et rangez-le en lieu sûr : il contient les coordonnées de vos clients.
- **Importer une sauvegarde** remplace les données de l'appareil. C'est aussi la façon de passer d'un ordinateur à un téléphone.
- Vider les données du navigateur, ou utiliser la navigation privée, efface les devis non sauvegardés. Un bandeau rouge s'affiche si le stockage est indisponible.

## Pour la maintenance

| Fichier | Rôle |
|---|---|
| `catalogue.js` | **Source unique des tarifs**, utilisée par l'outil et par le catalogue PDF (`outils/catalogue/catalogue.html`). |
| `calc.js` | Calculs : totaux, remise, conversions, échéancier, numérotation, dates. |
| `document.js` | Modèle de document et « vue client ». Celle-ci exclut coûts internes et notes privées. |
| `pdf.js` | Mise en page du PDF (jsPDF et jsPDF-AutoTable, licence MIT, fichiers dans `vendor/`). |
| `app.js`, `studio.css`, `index.html` | Interface. |

Tests :

```bash
node --test outils/quote-studio/tests/*.test.js
```

Le catalogue PDF se régénère en ouvrant `outils/catalogue/catalogue.html` dans Chrome : **Imprimer › Enregistrer au format PDF**, marges *Aucune*, *Graphiques d'arrière-plan* cochés.
