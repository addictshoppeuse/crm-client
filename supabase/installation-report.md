# Installation Supabase Dovozo clients

Statut : projet créé, schéma installé, compte administrateur actif et fonctions Edge publiées.

- Référence du projet : `rqgsyrmpqhxcqhukorkk`.
- Région : West EU (Ireland), `eu-west-1`.
- Projet réservé : `Dovozo clients`.
- Data API activée ; exposition automatique des nouvelles tables désactivée ; activation automatique de RLS activée.
- Migrations installées : `202609190001_team_schema.sql`, `202609190002_rls_and_audit.sql`, `202609190003_connected_fixes.sql`, `202609190004_admin_invariant.sql`.
- Fonctions publiées : `invite-member`, `manage-member`.
- Vérification en ligne : huit tables présentes, RLS activé sur les huit tables et politiques présentes sur chaque table.
- Administratrice : compte confirmé, connexion réussie, appartenance active avec le rôle `admin`.
- Données métier : aucune donnée réelle incluse ou envoyée pendant l’installation.
- Secrets : aucun mot de passe, jeton privé ou clé `service_role` n’est conservé dans les fichiers du site.
- Contrôles locaux : 13 contrats de sécurité et d’intégration, validation syntaxique et 24 parcours fonctionnels réussis.

Les essais réels d’invitation et de changement de rôle seront effectués lors de l’ajout du premier collaborateur, afin de ne créer aucun compte de test inutile.
