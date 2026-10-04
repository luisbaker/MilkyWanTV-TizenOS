# Journal des versions

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
