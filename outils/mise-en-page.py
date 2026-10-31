#!/usr/bin/env python3
"""Met à jour l'en-tête, le pied de page et le bouton WhatsApp de toutes les pages publiques.

Le site n'a pas d'étape de compilation : chaque page HTML contient sa propre copie
de l'en-tête et du pied de page. Ce script réécrit ces blocs à partir d'un modèle
unique pour qu'ils restent identiques partout.

Usage (depuis la racine du dépôt) :  python3 outils/mise-en-page.py
"""
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parent.parent

# Page -> préfixe des liens (la page 404 est servie depuis n'importe quel chemin)
PAGES = {
    'index.html': '', 'a-propos.html': '', 'artist-management.html': '', 'media.html': '',
    'digital.html': '', 'evenements.html': '', 'realisations.html': '', 'contact.html': '',
    'creation-site-web.html': '', 'demande.html': '', 'confidentialite.html': '', 'cgu.html': '',
    'cookies.html': '', 'remboursement.html': '', '404.html': '/-sultan-agency/',
}

POLES = [
    ('evenements.html', 'Sultan Events', 'Concerts, soirées, lancements et expériences'),
    ('artist-management.html', 'Sultan Artist Management', "Management d'artistes et musique"),
    ('media.html', 'Sultan Media', 'Communication, contenus et vidéo'),
    ('digital.html', 'Sultan Digital', 'Sites web, plateformes et automatisation'),
]

WHATSAPP = 'https://wa.me/221781482035'
LOGO = ('<a class="logo" href="{p}index.html" aria-label="Sultan Agency, accueil">'
        '<span class="logo-mark" aria-hidden="true">SA</span>'
        '<span class="logo-word">Sultan Agency<small>Événements · Création · Dakar</small></span></a>')


def cur(page, cible):
    return ' aria-current="page"' if page == cible else ''


def entete(page, p):
    poles = '\n'.join(
        f'            <li><a href="{p}{f}"{cur(page, f)}><strong>{n}</strong><span>{d}</span></a></li>'
        for f, n, d in POLES)
    return f'''<header class="site-header">
  <div class="wrap">
    {LOGO.format(p=p)}
    <nav class="nav" id="nav" aria-label="Navigation principale">
      <ul class="nav-list">
        <li class="has-sub">
          <button class="nav-sub-btn" type="button" aria-expanded="false" aria-controls="nav-sub">Expertises</button>
          <ul class="nav-sub" id="nav-sub">
{poles}
          </ul>
        </li>
        <li><a href="{p}realisations.html"{cur(page, 'realisations.html')}>Réalisations</a></li>
        <li><a href="{p}a-propos.html"{cur(page, 'a-propos.html')}>À propos</a></li>
        <li><a href="{p}contact.html"{cur(page, 'contact.html')}>Contact</a></li>
        <li><a class="nav-wa" href="{WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a></li>
        <li><a class="btn btn-primary btn-small nav-cta" href="{p}contact.html">Votre projet</a></li>
      </ul>
    </nav>
    <a class="btn btn-primary btn-small header-cta" href="{p}contact.html">Votre projet</a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
  </div>
</header>'''


def pied(page, p):
    poles = '\n'.join(f'          <li><a href="{p}{f}">{n}</a></li>' for f, n, _ in POLES)
    return f'''<footer class="site-footer">
  <div class="wrap">
    <p class="footer-sign"><span>Vivre,</span> <span>partager,</span> <span class="it">vibrer.</span></p>
    <div class="footer-grid">
      <div class="footer-brand">
        {LOGO.format(p=p)}
        <p>Agence événementielle et créative basée à Dakar. Concerts, soirées, lancements, artistes, image et digital, au Sénégal et au-delà.</p>
      </div>
      <div class="footer-col">
        <h2>Expertises</h2>
        <ul>
{poles}
          <li><a href="{p}creation-site-web.html">Tarifs des sites web</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2>L'agence</h2>
        <ul>
          <li><a href="{p}a-propos.html">À propos</a></li>
          <li><a href="{p}a-propos.html#fondateur">Le fondateur</a></li>
          <li><a href="{p}realisations.html">Réalisations</a></li>
          <li><a href="{p}contact.html">Présenter un projet</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2>Contact</h2>
        <ul>
          <li><a href="{WHATSAPP}" target="_blank" rel="noopener">WhatsApp&nbsp;: +221 78 148 20 35</a></li>
          <li><a href="mailto:papaahmedsonko5@gmail.com">papaahmedsonko5@gmail.com</a></li>
          <li><a href="https://www.instagram.com/sultan.experiences" target="_blank" rel="noopener">Instagram&nbsp;: @sultan.experiences</a></li>
          <li><a href="https://www.snapchat.com/add/sultanthebest29" target="_blank" rel="noopener">Snapchat&nbsp;: sultanthebest29</a></li>
          <li>Dakar, Sénégal</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; <span id="year">2026</span> Sultan Agency, Dakar, Sénégal.</p>
      <nav class="footer-links" aria-label="Informations légales">
        <a href="{p}confidentialite.html">Confidentialité</a>
        <a href="{p}cgu.html">Conditions d'utilisation</a>
        <a href="{p}cookies.html">Cookies</a>
        <a href="{p}remboursement.html">Paiement et remboursement</a>
        <button type="button" data-consent-open>Gérer les cookies</button>
      </nav>
    </div>
  </div>
</footer>'''


def main():
    for nom, p in PAGES.items():
        chemin = RACINE / nom
        if not chemin.exists():
            print('absente :', nom)
            continue
        html = chemin.read_text(encoding='utf-8')
        html = re.sub(r'<header class="site-header">.*?</header>', lambda m: entete(nom, p), html, count=1, flags=re.S)
        html = re.sub(r'<footer class="site-footer[^"]*">.*?</footer>(\s*<a class="wa-float".*?</a>)?',
                      lambda m: pied(nom, p), html, count=1, flags=re.S)
        chemin.write_text(html, encoding='utf-8')
        print('à jour :', nom)


if __name__ == '__main__':
    main()
