-- Flux iCal personnel (abonnement Google Agenda / Apple / Outlook) servi par la fonction Edge `calendar-feed`.
-- Chaque membre génère un jeton aléatoire depuis Paramètres ; le jeton dans l'URL sert d'authentification
-- (Google lit le flux sans session). Régénérer le jeton révoque l'ancien lien.
alter table public.user_preferences
  add column if not exists calendar_token text unique check (calendar_token is null or char_length(calendar_token) between 32 and 128);
