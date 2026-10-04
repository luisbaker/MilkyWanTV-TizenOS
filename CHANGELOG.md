# Journal des versions

## 2.2.0 — 4 octobre 2026

- **Listes de chaînes supplémentaires** : des listes M3U personnelles (`local/*.m3u`, non publiées) s'ajoutent à la liste MilkyWan, chacune dans sa propre section de la liste.
- Chaque liste peut déclarer son guide (`#EXTM3U url-tvg="…"`) ; les guides sont fusionnés avec celui de MilkyWan.
- Les guides compressés (`.xml.gz`) sont décompressés dans le Web Worker.
- Flux HLS : les statistiques l'indiquent et l'analyse MPEG-TS, réservée aux flux TS, est désactivée.

## 2.1.0 — 4 octobre 2026

- **Démarrage automatique** : à l'ouverture de l'app, la dernière chaîne regardée démarre dans la fenêtre, à côté de la liste. Même chose au retour dans l'app. Avec le lancement anticipé de la TV, rien n'est lu tant que l'app n'est pas à l'écran.
- La dernière chaîne est mémorisée avec l'adresse de son flux : la lecture démarre sans attendre le téléchargement de la liste (image en environ 5,8 s après l'ouverture, au lieu d'environ 7,1 s).
- Le rafraîchissement du guide (24 Mo) attend que l'image soit affichée ; le guide en cache est utilisé entre-temps.
- La liste des chaînes ne se ferme plus seule après 8 s : l'image reste visible dans sa fenêtre. Retour passe en plein écran.

## 2.0.0 — 4 octobre 2026

Nouvelle interface aux couleurs MilkyWan (bleu nuit, menthe, violet).

- Liste des chaînes avec les sections **Favoris** et **Toutes les chaînes**, une étoile par chaîne et un indicateur sur la chaîne en cours.
- Pendant la lecture, **l'image continue dans une fenêtre** à côté de la liste (`setDisplayRect`). Dessous : programme en cours, progression, résumé et trois programmes suivants. L'heure est affichée.
- **Bandeau** en carte translucide : grand titre, progression, résumé, « Ensuite… » et **boutons en pilule** (Infos, langue audio, Sous-titres, Stats, Options). Les pistes audio et de sous-titres s'affichent sous les boutons.
- **Statistiques avancées** sur deux colonnes : Vidéo, Audio et Réception à gauche ; **flux MPEG-TS** à droite (programme, table PMT, un PID par ligne avec codec, langue et débit).
- Pistes audio : « Version originale » (qaa) et « Audiodescription » (qad) reconnues ; les pistes de même langue sont numérotées.
- Le fond étoilé est remplacé par le dégradé de la charte.

## 1.9.0 — 4 octobre 2026

- Analyse du flux MPEG-TS dans les statistiques pour nerds : discontinuités (compteurs de continuité), paquets corrompus (TEI) et pertes de synchro, avec le total et le nombre sur les 60 dernières secondes.
- Graphe des 60 dernières secondes : débit mesuré et secondes avec erreurs.
- Débits vidéo et audio mesurés à partir des paquets. Les débits « annoncés » vides (« Non fourni », 0) sont masqués.
- Panneau nerds plus compact : deux colonnes, environ 450 px de haut au lieu de tout l'écran.
- `build.sh` : correction d'une apostrophe qui cassait `./build.sh install`.

## 1.8.0 — 3 octobre 2026

Première version publique.

### Lecture
- Zapping rapide par pré-chargement prédictif : CH+, CH− et la chaîne surlignée dans la liste sont préparées dans des lecteurs AVPlay supplémentaires. Le changement de chaîne passe d'environ 4 s à environ 0,8 s.
- Si une chaîne est encore en préparation au moment du zapping, sa préparation est reprise au lieu de repartir de zéro.
- Tampon de démarrage AVPlay réduit de 10 s à 1 s : première image en environ 4 s au lieu d'environ 10,5 s.
- La chaîne précédente est fermée après l'affichage du bandeau, ce qui supprime un blocage de 200 ms.
- User-Agent `MilkyWan-TizenOS non officiel` sur les flux.

### Interface
- Toute l'application se pilote avec les flèches et OK (Samsung Smart Remote) : nouvel onglet **Options** dans le bandeau et favoris dans le menu Options.
- Onglet **Nerds** dans le bandeau, avec des statistiques détaillées par-dessus la vidéo (OK pour ouvrir, Retour pour fermer).
- Bandeau translucide, fond étoilé et nom **MilkyWan TV**.

### Performances
- Guide XMLTV analysé dans un Web Worker, environ 6 fois plus vite, et mis en cache.
- Liste mise à jour sur place au lieu d'être reconstruite toutes les 30 s.
- Animations sur couches GPU et transitions coûteuses supprimées : un déplacement dans la liste prend environ 25 ms au lieu de 52 ms.
- Le lecteur PC (mpegts.js, 270 Ko) n'est plus chargé sur la TV.
- Lancement anticipé (*prelaunch*) activé.

### Version PC
- mpegts.js corrigé pour les flux DVB : audio E-AC-3 par descripteur, keyframes sans IDR, entrelacé PAFF.
