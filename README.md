# Dovozo clients

Le CRM actuel est contenu dans `index.html`. Il démarre vide : aucune entreprise ni aucun contact réel n'est livré avec l'application.

Les données locales existantes sont conservées sur le même navigateur et la même adresse. Dans Paramètres, utiliser Export JSON pour sauvegarder, et Import JSON pour restaurer après validation et confirmation. Les données locales ne sont pas partagées entre appareils.

Fonctions : tableau de bord et KPI cliquables, Aujourd'hui, prospects, pipeline personnalisable, relances, agenda, fiches clients, historique, priorités, recherche et filtres avancés, apparence et statuts personnalisables.

Les liens Google Agenda ouvrent un formulaire à enregistrer dans Google ; ils ne synchronisent pas automatiquement le calendrier.

Le dépôt reste privé. GitHub Pages est désactivé avec la configuration actuelle du compte. Aucun historique Git n'a été réécrit : les anciennes versions nécessitent une purge séparée et explicitement autorisée.

`app.js`, `styles.css` et `domain.mjs` sont des fichiers hérités ; le nouveau `index.html` utilise son propre code intégré.

## Connexion d’équipe Supabase

Le dossier `supabase/` contient le schéma, les règles RLS, le journal d’audit et les fonctions d’invitation. Les inscriptions libres sont désactivées dans l’interface : un administrateur invite les collaborateurs depuis Paramètres.

Copier `config.example.js` vers `config.js` et renseigner uniquement l’URL publique du projet et sa clé `sb_publishable_`. Ne jamais placer de mot de passe de base de données, de clé `sb_secret_` ou de clé `service_role` dans les fichiers du site.

Les collaborateurs peuvent consulter et modifier les prospects, ajouter des activités et exporter une sauvegarde. Ils ne peuvent ni supprimer, ni restaurer, ni modifier les paramètres partagés, ni gérer les membres. Ces limites sont appliquées par PostgreSQL, même si une personne contourne l’interface.
