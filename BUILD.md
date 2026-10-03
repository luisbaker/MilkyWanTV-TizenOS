# Construire, signer et installer MilkyWan TV

MilkyWan TV est une application **Tizen Web** (HTML, CSS, JavaScript) : il n'y a rien à compiler. « Construire » l'application, c'est l'**empaqueter** dans un fichier `.wgt`, le **signer** avec un certificat Samsung, puis l'**installer** sur la TV.

## 1. Prérequis (une seule fois)

1. **Java 17** : par exemple `brew install openjdk@17` sur macOS.
2. **Tizen Studio** en version CLI ([téléchargement](https://developer.tizen.org/development/tizen-studio/download)). Dans le *Package Manager*, installez :
   - *Samsung TV Extensions* (Web app development, Extension Tools)
   - *Samsung Certificate Extension* et *Certificate Manager*
3. Ajoutez les outils au `PATH` :

```bash
export PATH="$HOME/tizen-studio/tools/ide/bin:$HOME/tizen-studio/tools:$PATH"
```

## 2. Mode développeur sur la TV (une seule fois)

1. Sur la TV, ouvrez **Apps**, puis tapez **1 2 3 4 5** avec la télécommande (le pavé numérique virtuel s'affiche).
2. Activez **Developer mode** et saisissez l'**adresse IP de l'ordinateur**.
3. Redémarrez complètement la TV (débranchez-la 30 s).
4. Vérifiez la connexion :

```bash
sdb connect <IP-de-la-TV>
sdb devices
```

## 3. Certificats de signature (une seule fois par TV)

Les TV Samsung n'acceptent que les applications signées avec un **certificat Samsung**. Un profil de type *Tizen* est refusé avec l'erreur `Invalid certificate chain`.

1. Gardez la TV connectée (`sdb devices` doit l'afficher) et ouvrez **Certificate Manager**.
2. Cliquez sur **+**, puis choisissez **Samsung** et **TV**.
3. Donnez un nom au profil, par exemple `MilkywanSamsung`.
4. **Author certificate** : créez-en un nouveau, avec un nom et un mot de passe.
5. Connectez-vous avec votre **compte Samsung**.
6. **Distributor certificate** : laissez *Public*. Le **DUID** de la TV connectée est ajouté automatiquement.

| Certificat | Fichier | Rôle |
|---|---|---|
| Author | `~/SamsungCertificate/<profil>/author.p12` | Vous identifie comme auteur. Il doit rester **le même** pour toutes les mises à jour. |
| Distributor | `~/SamsungCertificate/<profil>/distributor.p12` | Autorise l'installation sur les TV dont le DUID y figure |

> **Sauvegardez le dossier `~/SamsungCertificate/`.** Sans le même certificat author, la TV refuse les mises à jour : il faut alors désinstaller l'application (favoris et réglages perdus) avant de la réinstaller.
>
> **Ne publiez pas de `.wgt` signé.** Il contient l'e-mail de votre compte Samsung et l'identifiant (DUID) de votre TV, et il ne s'installe de toute façon que sur vos TV.

- **Autre TV** : refaites un profil (ou un certificat distributor) avec cette TV connectée, pour ajouter son DUID.
- **Expiration** : ces certificats expirent (environ 1 an). Quand l'installation échoue pour cause de certificat, recréez le profil.

## 4. Construire et installer

### Avec le script

```bash
./build.sh
```

Crée `dist/MilkyWanTV.wgt`, signé avec le profil `MilkywanSamsung`. Pour un autre profil : `TIZEN_PROFILE=MonProfil ./build.sh`.

```bash
TV_IP=192.168.1.20 ./build.sh install
```

Construit, installe puis lance l'application sur la TV.

### À la main

```bash
tizen package -t wgt -s MilkywanSamsung -o /tmp -- .
sdb connect <IP-de-la-TV>
sdb devices                                   # 3e colonne : nom de la TV
tizen install -n "MilkyWan TV.wgt" -t <nom-de-la-TV> -- /tmp
tizen run -p MilkywanTV.Main -t <nom-de-la-TV>
```

Le script `build.sh` exclut du paquet ce qui ne sert pas sur la TV : documentation, captures, version PC et `.git`. Empaqueter le dossier entier fonctionne aussi, mais le paquet est plus lourd.

## 5. Mettre à jour

1. Augmentez la version dans `config.xml` (`version="1.8.1"`).
2. Relancez `TV_IP=… ./build.sh install`. L'application est remplacée, les favoris et les réglages sont conservés.

## Erreurs fréquentes

| Message | Cause | Solution |
|---|---|---|
| `Invalid certificate chain` | Profil de type *Tizen* | Créer un profil **Samsung → TV** |
| `There is no connected target` | Connexion `sdb` perdue | `sdb connect <IP>`. Vérifier que la TV est allumée et que le mode développeur pointe vers l'IP de l'ordinateur. |
| `Check certificate error` lors d'une mise à jour | Certificat author différent | Utiliser le profil d'origine, ou désinstaller l'app puis réinstaller |
| `failed to connect` alors que le port répond | IP de l'ordinateur incorrecte dans le mode développeur | La corriger sur la TV puis redémarrer la TV |

## Déboguer sur la TV

```bash
sdb shell 0 debug MilkywanTV.Main            # affiche "port: NNNNN"
sdb forward tcp:9222 tcp:NNNNN
```

Ouvrez ensuite `http://127.0.0.1:9222` dans Chrome pour accéder aux DevTools de l'application qui tourne sur la TV. `window.MilkyDebug` donne le lecteur actif et l'état du pré-chargement.
