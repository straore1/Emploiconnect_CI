# EmploiConnect CI

Plateforme d'offres d'emploi connectée à Supabase. Les offres, comptes, profils,
candidatures et messages de contact sont conservés dans une base partagée ;
les CV sont stockés dans un bucket privé. Le thème et les favoris restent des
préférences locales au navigateur.

L'URL Supabase et la clé publishable sont configurées dans `js/config.js`. Cette
clé est destinée aux applications publiques ; elle ne remplace pas les règles
RLS et ne doit jamais être remplacée par une clé `service_role`.

Le projet Supabase doit encore recevoir le schéma SQL avant que les comptes,
offres, candidatures et messages soient disponibles. Sans schéma, les pages
publiques ne peuvent pas charger les offres et le site signale les erreurs de
connexion au backend.

## Configuration Supabase

1. Créez un projet sur [Supabase](https://supabase.com/).
2. Dans **SQL Editor**, exécutez le contenu de [`supabase/schema.sql`](supabase/schema.sql).
   Ce script crée les tables, les règles RLS, le bucket privé des CV et le profil
   associé à chaque nouveau compte.
3. Dans **Project Settings > API**, copiez l'URL du projet et la clé
   **publishable** (ou **anon/public** pour les anciens projets) dans
   `js/config.js` :

   ```js
   window.EMPLOICONNECT_CONFIG = {
       supabaseUrl: 'https://VOTRE-PROJET.supabase.co',
       supabaseAnonKey: 'VOTRE-CLE-ANON-PUBLIQUE'
   };
   ```

   Les clés publishable/anon sont destinées au navigateur et les règles RLS
   protègent les données. **Ne mettez jamais la clé `service_role` dans le site.**
4. Dans **Authentication > URL Configuration**, indiquez l'URL publique du site
   comme URL principale et ajoutez les URL locales utilisées pour le développement.
   Laissez la confirmation par e-mail activée en production ; après confirmation,
   l'utilisateur pourra se connecter avec son adresse et son mot de passe.
5. Activez GitHub Pages dans **Settings > Pages**, avec **GitHub Actions** comme
   source. Le workflow `.github/workflows/deploy-pages.yml` publie le site à
   chaque mise à jour de `main`. L'ouverture directe des fichiers en `file://`
   n'est pas un mode de déploiement.
   Si un déploiement a échoué avant l'activation de Pages, relancez-le depuis
   **Actions > Deploy static site to GitHub Pages > Re-run jobs**.

## Parcours disponibles

- Les visiteurs consultent et filtrent les offres publiées.
- Les candidats créent un compte, renseignent leur profil et déposent un CV privé,
  puis postulent. Le CV n'est accessible qu'au candidat et aux recruteurs auxquels
  il a envoyé une candidature.
- Les recruteurs créent un compte, publient et ferment leurs offres et consultent
  les candidatures reçues pour ces offres.
- Le formulaire de contact enregistre les messages dans Supabase.

Les règles de sécurité sont appliquées côté base (Row Level Security) ; la clé
publique du navigateur ne donne pas de privilèges administrateur.

Les messages de contact sont enregistrés dans la table `contact_messages` et
doivent être consultés depuis le tableau de bord Supabase. Pour envoyer les
e-mails de confirmation de manière fiable en production, configurez un SMTP
personnalisé dans Supabase Auth. Les coordonnées légales de l'éditeur et les
conditions d'utilisation doivent être ajoutées avant une mise en production.
