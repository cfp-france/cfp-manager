-- =============================================================
-- Migration 0020 — BTS SAM + rappel BTS NDRC E4/E6
-- - Ajoute le BTS SAM (Support à l'Action Managériale) avec ses blocs (E4, E5, E61, E62, CEJM)
-- - Ré-insert idempotent de BTS NDRC E4 (Négociation Vente), E6 (Animation Réseau), CEJM
--   (au cas où ils auraient été supprimés manuellement — l'ON CONFLICT laisse les existants intacts)
-- =============================================================

-- ============================================================
-- BTS SAM — Support à l'Action Managériale
-- Blocs : E4 Optimisation processus, E5 Gestion projet, E61 Collab RH, E62 Pilotage, CEJM
-- ============================================================
insert into public.formations(id, code, name, description) values
  ('a5000000-0000-0000-0000-000000000001', 'BTS_SAM', 'BTS SAM — Support à l''Action Managériale',
   'BTS niveau 5 — Blocs : E4 Optimisation processus, E5 Gestion de projet, E61 Collaboration RH, E62 Organisation et suivi, CEJM')
on conflict (code) do nothing;

-- E4 : Optimisation des processus administratifs
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001',1,
   'E4 — Optimisation des processus administratifs')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b5000000-0000-0000-0000-000000000001', 1, 'Analyser les processus de l''organisation', 'Identifier et formaliser les processus administratifs en vigueur.'),
  ('b5000000-0000-0000-0000-000000000001', 2, 'Rationaliser l''usage des ressources', 'Proposer des optimisations en coût / temps / qualité.'),
  ('b5000000-0000-0000-0000-000000000001', 3, 'Améliorer la circulation de l''information', 'Fluidifier les flux documentaires et digitaux.'),
  ('b5000000-0000-0000-0000-000000000001', 4, 'Participer à la sécurisation des données', 'Gérer la confidentialité et la protection des données RGPD.')
on conflict (block_id, number) do nothing;

-- E5 : Gestion de projet
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b5000000-0000-0000-0000-000000000002','a5000000-0000-0000-0000-000000000001',2,
   'E5 — Gestion de projet')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b5000000-0000-0000-0000-000000000002', 1, 'Formaliser le cadre du projet', 'Définir les objectifs, périmètre, livrables et contraintes.'),
  ('b5000000-0000-0000-0000-000000000002', 2, 'Conduire une veille et préparer la décision', 'Collecter et synthétiser des informations pour éclairer les choix.'),
  ('b5000000-0000-0000-0000-000000000002', 3, 'Suivre et évaluer le projet', 'Mettre en place un reporting et des indicateurs de pilotage.'),
  ('b5000000-0000-0000-0000-000000000002', 4, 'Évaluer les résultats et proposer des améliorations', 'Analyser les écarts et formaliser un retour d''expérience.')
on conflict (block_id, number) do nothing;

-- E61 : Collaboration à la gestion des ressources humaines
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b5000000-0000-0000-0000-000000000003','a5000000-0000-0000-0000-000000000001',3,
   'E61 — Collaboration à la gestion des ressources humaines')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b5000000-0000-0000-0000-000000000003', 1, 'Participer au processus de recrutement', 'Aider à la rédaction des offres, à la sélection et à l''intégration.'),
  ('b5000000-0000-0000-0000-000000000003', 2, 'Préparer et suivre les éléments administratifs du personnel', 'Contrats, visites médicales, formation, carrière.'),
  ('b5000000-0000-0000-0000-000000000003', 3, 'Contribuer à la cohésion d''équipe', 'Faciliter la communication interne et la circulation des informations RH.'),
  ('b5000000-0000-0000-0000-000000000003', 4, 'Contribuer à la gestion des conflits et au dialogue social', 'Participer à la préparation des réunions avec les représentants du personnel.')
on conflict (block_id, number) do nothing;

-- E62 : Organisation et suivi de l'activité
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b5000000-0000-0000-0000-000000000004','a5000000-0000-0000-0000-000000000001',4,
   'E62 — Organisation et suivi de l''activité (pilotage)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b5000000-0000-0000-0000-000000000004', 1, 'Seconder les responsables sur le plan opérationnel', 'Préparer les rendez-vous, documents, déplacements et évènements.'),
  ('b5000000-0000-0000-0000-000000000004', 2, 'Organiser et suivre une activité', 'Planifier, répartir et suivre les tâches de l''équipe.'),
  ('b5000000-0000-0000-0000-000000000004', 3, 'Produire des documents de synthèse', 'Rédiger comptes-rendus, notes, tableaux de bord.'),
  ('b5000000-0000-0000-0000-000000000004', 4, 'Contribuer à la qualité des échanges professionnels', 'Pratiques collaboratives, outils numériques, communication multilingue.')
on conflict (block_id, number) do nothing;

-- CEJM pour BTS SAM
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b5000000-0000-0000-0000-000000000005','a5000000-0000-0000-0000-000000000001',5,
   'CEJM — Culture Économique, Juridique et Managériale (E3)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b5000000-0000-0000-0000-000000000005', 1, 'Analyser des situations économiques', 'Mobiliser des concepts et raisonnements économiques sur des cas concrets.'),
  ('b5000000-0000-0000-0000-000000000005', 2, 'Mobiliser un raisonnement juridique', 'Identifier les règles applicables et argumenter une solution juridique.'),
  ('b5000000-0000-0000-0000-000000000005', 3, 'Analyser une problématique managériale', 'Diagnostiquer une situation d''entreprise sous l''angle du management.'),
  ('b5000000-0000-0000-0000-000000000005', 4, 'Élaborer une argumentation croisée E-J-M', 'Construire un raisonnement intégrant les trois dimensions.')
on conflict (block_id, number) do nothing;

-- ============================================================
-- RAPPEL BTS NDRC — E4 Négociation Vente + E6 Animation de Réseau + CEJM
-- (Idempotent : si déjà présents dans migration 0003, ne fait rien)
-- ============================================================
insert into public.formations(id, code, name, description) values
  ('a4000000-0000-0000-0000-000000000001', 'BTS_NDRC', 'BTS NDRC — Négociation et Digitalisation de la Relation Client',
   'BTS niveau 5 — Blocs : E4 Négociation vente, E6 Animation de réseau, CEJM')
on conflict (code) do nothing;

insert into public.competence_blocks(id, formation_id, number, title) values
  ('b4000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001',1,
   'E4 — Relation client et Négociation Vente'),
  ('b4000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000001',2,
   'E6 — Relation client et Animation de Réseau'),
  ('b4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000001',3,
   'CEJM — Culture Économique, Juridique et Managériale (E3)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  -- E4
  ('b4000000-0000-0000-0000-000000000001', 1, 'Négocier et vendre une solution adaptée au client', 'Diagnostic client, argumentation, closing, suivi.'),
  ('b4000000-0000-0000-0000-000000000001', 2, 'Gérer la relation client', 'Fidéliser, traiter les réclamations, développer le portefeuille.'),
  ('b4000000-0000-0000-0000-000000000001', 3, 'Organiser et piloter l''activité commerciale', 'Prospection, suivi des indicateurs de performance.'),
  -- E6
  ('b4000000-0000-0000-0000-000000000002', 1, 'Implanter et promouvoir l''offre chez des distributeurs', 'Négocier le référencement et animer les points de vente.'),
  ('b4000000-0000-0000-0000-000000000002', 2, 'Développer et piloter un réseau de partenaires', 'Recruter, animer et fidéliser des partenaires commerciaux.'),
  ('b4000000-0000-0000-0000-000000000002', 3, 'Créer et animer un réseau de vente directe', 'Structurer un réseau de vente à domicile ou de VDI.'),
  -- CEJM NDRC
  ('b4000000-0000-0000-0000-000000000003', 1, 'Analyser des situations économiques', 'Mobiliser des concepts et raisonnements économiques sur des cas concrets.'),
  ('b4000000-0000-0000-0000-000000000003', 2, 'Mobiliser un raisonnement juridique', 'Identifier les règles applicables et argumenter une solution juridique.'),
  ('b4000000-0000-0000-0000-000000000003', 3, 'Analyser une problématique managériale', 'Diagnostiquer une situation d''entreprise sous l''angle du management.'),
  ('b4000000-0000-0000-0000-000000000003', 4, 'Élaborer une argumentation croisée E-J-M', 'Construire un raisonnement intégrant les trois dimensions.')
on conflict (block_id, number) do nothing;
