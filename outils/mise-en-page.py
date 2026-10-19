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
    ('artist-management.html', 'Sultan Artist Management', "Management d'artistes et musique"),
    ('media.html', 'Sultan Media', 'Communication, contenus et vidéo'),
    ('digital.html', 'Sultan Digital', 'Sites web, plateformes et automatisation'),
    ('evenements.html', 'Sultan Events', 'Concerts, soirées, lancements et expériences'),
]

WHATSAPP = 'https://wa.me/221781482035'
LOGO = ('<a class="logo" href="{p}index.html" aria-label="Sultan Agency, accueil">'
        '<span class="logo-mark" aria-hidden="true">SA</span>'
        '<span class="logo-word">Sultan Agency<small>Agence créative &amp; entrepreneuriale</small></span></a>')


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
        <li><a class="btn btn-primary btn-small nav-cta" href="{p}contact.html">Présenter mon projet</a></li>
      </ul>
    </nav>
    <a class="btn btn-primary btn-small header-cta" href="{p}contact.html">Mon projet</a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
  </div>
</header>'''


def pied(page, p):
    poles = '\n'.join(f'          <li><a href="{p}{f}">{n}</a></li>' for f, n, _ in POLES)
    return f'''<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        {LOGO.format(p=p)}
        <p class="footer-sign">De l'idée à l'impact.</p>
        <p>Agence créative et entrepreneuriale basée à Dakar, Sénégal. Ouverte aux collaborations au Sénégal et à l'international.</p>
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
</footer>
<a class="wa-float" href="{WHATSAPP}" target="_blank" rel="noopener" aria-label="Écrire à Sultan Agency sur WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.2-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z"/></svg><span>WhatsApp</span></a>'''


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
