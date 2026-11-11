# PLUTO RESTAU-JOMO

Site de présentation et de commande pour un restaurant de cuisine ivoirienne à Abidjan. L’interface est en HTML, CSS et JavaScript sans dépendance de compilation.

## Utiliser le site

- Ouvrir `index.html` ou `accueil.html` pour parcourir la carte.
- Rechercher et filtrer les plats, enregistrer ses favoris, remplir son panier et choisir la livraison ou le retrait.
- Les règlements « Espèces » et « Mobile Money » sont à effectuer à la réception. Le site ne traite aucun paiement en ligne.
- L’administration se trouve dans `connexion.html` ou `boutique-admin.html`. L’ancienne adresse `admin.html` redirige vers le nouvel espace.

## Déploiement GitHub Pages

GitHub Pages publie automatiquement le contenu statique depuis la branche `main` et le dossier `/`. Le site est accessible à l’adresse :

https://mosasuperboy.github.io/Web-de-gestion-de-restaurant/

GitHub Pages ne prend pas en charge PHP. L’API de maintenance n’est donc pas disponible sur cet hébergement et, par sécurité, la boutique suspend la prise de commandes tant qu’elle ne peut pas vérifier l’état de maintenance. La carte reste consultable. Pour activer les commandes et le mode maintenance global, utilisez un hébergeur compatible avec PHP et MySQL et suivez les étapes ci-dessous.

## Administration

Le compte initial est :

- Identifiant : `Administrateur`
- Mot de passe provisoire : `Administrateur@2026`
- Question de récupération initiale : « Quel est le nom de notre restaurant ? »
- Réponse de récupération initiale : `PLUTO RESTAU-JOMO`

Changez le mot de passe provisoire dès la première connexion, dans la section **Sécurité du compte administrateur**, puis définissez une question et une réponse de récupération personnelles. Les mots de passe doivent contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un symbole. L’accès est bloqué une minute après cinq essais infructueux.

L’espace de gestion permet de modifier la carte et les stocks, suivre ou annuler les commandes, ajuster les frais de livraison et le numéro WhatsApp, télécharger le catalogue et les commandes, et exporter ou restaurer une sauvegarde JSON. Il est également possible de modifier le délai de déconnexion automatique.

### Mode maintenance global

Le bouton **Mode maintenance global** de l’administration suspend les commandes pour tous les visiteurs. Il requiert PHP avec PDO MySQL, une base MySQL et le mot de passe serveur dédié défini dans `api/maintenance-config.php` ; ce mot de passe est distinct du compte d’administration local.

1. Servez le site par WAMP/Apache (et non par `file://` ou le serveur d’aperçu Node).
2. Exécutez `maintenance.sql` dans MySQL pour créer la base et les tables.
3. Créez un utilisateur MySQL dédié et limité aux tables de maintenance :
   `CREATE USER 'pluto_maintenance'@'127.0.0.1' IDENTIFIED BY 'MOT_DE_PASSE_MYSQL';`
   `GRANT SELECT, INSERT, UPDATE ON pluto_restau.shop_maintenance TO 'pluto_maintenance'@'127.0.0.1';`
   `GRANT SELECT, INSERT, UPDATE ON pluto_restau.shop_maintenance_auth_attempts TO 'pluto_maintenance'@'127.0.0.1';`
4. Copiez `api/maintenance-config.example.php` vers `api/maintenance-config.php`, puis renseignez cet utilisateur et son mot de passe MySQL.
5. Générez un hash pour un mot de passe serveur robuste avec `php -r "echo password_hash('VOTRE_MOT_DE_PASSE', PASSWORD_DEFAULT), PHP_EOL;"` et placez le résultat dans `admin_password_hash`. Ne partagez pas ce mot de passe et ne publiez pas le fichier de configuration.
6. Utilisez HTTPS sur un site public. Le mot de passe serveur est demandé à chaque changement ; cinq erreurs consécutives depuis la même adresse bloquent les tentatives pendant une minute.

Si l’API ou MySQL est indisponible, la boutique suspend les commandes par précaution et affiche un message. Cette API ne centralise pas le catalogue ni les commandes : ceux-ci restent stockés dans le navigateur de chaque appareil.

### Limites importantes

Les données de la carte, les commandes, les comptes et les préférences sont enregistrés dans le stockage local du navigateur. Les commandes passées sur d’autres téléphones ou ordinateurs ne sont donc pas visibles dans l’administration de cet appareil. Les données locales ne remplacent pas une sauvegarde : téléchargez régulièrement une copie depuis l’administration.

Pour recevoir les commandes de tous les clients sur un espace commun, il faut également ajouter un serveur et une base de données dédiés à celles-ci. Le numéro WhatsApp configuré permet seulement d’ouvrir un message de confirmation.

## Personnalisation

- Modifiez le nom, le numéro WhatsApp et les frais de livraison dans `config.js`.
- L’administrateur peut personnaliser les sept couleurs avec les sélecteurs du menu **Choisissez une ambiance**. La police se choisit depuis le menu de la page. Ces préférences restent locales à l’appareil utilisé pour les modifier.
- Les articles et leurs tarifs initiaux sont dans `boutique-data.js`.
- L’administration accepte les photos locales ou les images JPG, PNG et WebP importées depuis l’appareil. Les images importées sont optimisées et enregistrées dans le navigateur, avec une limite de stockage cumulée de 3 Mo.
- Dans **Photo du grand cadre d’accueil**, importez ou rétablissez l’image principale. Les images et couleurs personnalisées restent locales à cet appareil et ne sont pas synchronisées avec les visiteurs sur d’autres appareils.
- Les photos initiales et leurs crédits sont intégrés aux fiches produit. Vous pouvez ajouter des photos dans `assets/menu/` ou utiliser un lien HTTPS depuis l’administration.

## Crédits des photos

Ces photographies proviennent de Wikimedia Commons. Elles sont utilisées sous la licence [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/). Les liens de source et les crédits correspondants sont également affichés dans la carte du site.

| Fichier | Photo | Auteur | Source |
|---|---|---|---|
| `attieke-thon.jpg` | Attiéké au thon | Mognissan | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Atti%C3%A9k%C3%A9_poisson_thon_01.jpg) |
| `poulet-braise.jpg` | Poulet braisé et attiéké | Jacquitoz | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Poulet_brais%C3%A9_attiek%C3%A9.JPG) |
| `kedjenou.jpg` | Kédjénou de poulet | African Hope | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Kedjenou_poulet_sauce_claire.JPG) |
| `poisson-braise.jpg` | Poisson braisé et attiéké | Papischou | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Atti%C3%A9k%C3%A9_au_poisson_grill%C3%A9e.JPG) |
| `alloco-poisson.jpg` | Alloco et poisson | Jacquitoz | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Alloco_poisson_sosso.JPG) |
| `alloco-poulet.jpg` | Alloco et poulet | Isabelle Christiane | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Alloco_au_poulet.jpg) |
| `jus-bissap.jpg` | Jus de bissap | Kalamuh 045 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Jus_de_bouye,_gingembre_et_bissap_01.jpg) |
| `jus-gingembre.jpg` | Jus de gingembre | Cheikh cherif | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Jus_de_gingembre-2025.jpg) |
