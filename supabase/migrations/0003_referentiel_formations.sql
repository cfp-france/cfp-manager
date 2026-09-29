-- =============================================================
-- Migration 0003 — Enrichissement du référentiel de formations
-- Ajoute : Mastère Manager d'Affaires (Bloc 2), BTS MCO (DRCV/ADOC/MEC + CEJM),
-- BTS NDRC (E4/E6 + CEJM), BTS GTLA (CEJM), TP RDDC (tous blocs).
-- Convention : les matières transverses (CEJM) sont répliquées comme blocs
-- dans chaque BTS concerné pour permettre un rattachement direct.
-- =============================================================

-- ============================================================
-- MASTÈRE MANAGER D'AFFAIRES — Bloc 2 uniquement
-- ============================================================
insert into public.formations(id, code, name, description) values
  ('a2000000-0000-0000-0000-000000000001', 'MMA', 'Mastère Manager d''Affaires',
   'Formation niveau 7 — Bloc 2 : piloter et développer une stratégie commerciale')
on conflict (code) do nothing;

insert into public.competence_blocks(id, formation_id, number, title) values
  ('b2000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001',2,
   'Piloter et développer une stratégie commerciale complexe')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b2000000-0000-0000-0000-000000000002', 1, 'Élaborer une stratégie commerciale multi-canal', 'Définir la stratégie de développement commercial en cohérence avec les objectifs de l''entreprise.'),
  ('b2000000-0000-0000-0000-000000000002', 2, 'Piloter des négociations complexes B2B', 'Mener des négociations avec des grands comptes et à l''international.'),
  ('b2000000-0000-0000-0000-000000000002', 3, 'Manager et développer une équipe commerciale', 'Recruter, animer, motiver et développer les compétences d''une équipe commerciale.'),
  ('b2000000-0000-0000-0000-000000000002', 4, 'Développer un portefeuille grands comptes', 'Identifier, prospecter et fidéliser les grands comptes stratégiques.'),
  ('b2000000-0000-0000-0000-000000000002', 5, 'Analyser et piloter la performance commerciale', 'Mettre en place des KPI, tableaux de bord et actions correctives.'),
  ('b2000000-0000-0000-0000-000000000002', 6, 'Conduire un projet commercial stratégique', 'Piloter un projet de développement commercial d''envergure de bout en bout.')
on conflict (block_id, number) do nothing;

-- ============================================================
-- BTS MCO — Management Commercial Opérationnel
-- Blocs = matières : DRCV (E4), ADOC (E5), MEC (E6), CEJM (E3 transverse)
-- ============================================================
insert into public.formations(id, code, name, description) values
  ('a3000000-0000-0000-0000-000000000001', 'BTS_MCO', 'BTS MCO — Management Commercial Opérationnel',
   'BTS niveau 5 — Matières : DRCV, ADOC, MEC, CEJM')
on conflict (code) do nothing;

-- Bloc 1 : DRCV (E4) — Développer la Relation Client et Vente
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001',1,
   'DRCV — Développer la Relation Client et Vente (E4)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b3000000-0000-0000-0000-000000000001', 1, 'Assurer la veille informationnelle', 'Collecter, organiser et exploiter les informations utiles à la relation client.'),
  ('b3000000-0000-0000-0000-000000000001', 2, 'Réaliser et exploiter des études commerciales', 'Concevoir des études, analyser les résultats et en déduire des recommandations.'),
  ('b3000000-0000-0000-0000-000000000001', 3, 'Vendre dans un contexte omnicanal', 'Conduire une vente en tenant compte des canaux physiques et digitaux.'),
  ('b3000000-0000-0000-0000-000000000001', 4, 'Entretenir la relation client', 'Fidéliser, gérer les réclamations et développer la valeur client.')
on conflict (block_id, number) do nothing;

-- Bloc 2 : ADOC (E5) — Animer et Dynamiser l'Offre Commerciale
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b3000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000001',2,
   'ADOC — Animer et Dynamiser l''Offre Commerciale (E5)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b3000000-0000-0000-0000-000000000002', 1, 'Élaborer et adapter en continu l''offre de produits et services', 'Gérer l''assortiment et l''adapter aux évolutions de la demande.'),
  ('b3000000-0000-0000-0000-000000000002', 2, 'Organiser l''espace commercial', 'Optimiser l''implantation, le merchandising et l''expérience client en magasin.'),
  ('b3000000-0000-0000-0000-000000000002', 3, 'Développer les performances de l''espace commercial', 'Analyser les KPI et proposer des actions correctives.'),
  ('b3000000-0000-0000-0000-000000000002', 4, 'Concevoir et mettre en place la communication commerciale', 'Élaborer et déployer les actions de communication multi-canal.'),
  ('b3000000-0000-0000-0000-000000000002', 5, 'Évaluer l''action commerciale', 'Mesurer les résultats et proposer des ajustements.')
on conflict (block_id, number) do nothing;

-- Bloc 3 : MEC (E6) — Manager l'Équipe Commerciale
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b3000000-0000-0000-0000-000000000003','a3000000-0000-0000-0000-000000000001',3,
   'MEC — Manager l''Équipe Commerciale (E6)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b3000000-0000-0000-0000-000000000003', 1, 'Organiser le travail de l''équipe commerciale', 'Planifier, répartir et coordonner les tâches.'),
  ('b3000000-0000-0000-0000-000000000003', 2, 'Recruter des collaborateurs', 'Définir un besoin, sélectionner et intégrer un nouveau collaborateur.'),
  ('b3000000-0000-0000-0000-000000000003', 3, 'Animer l''équipe commerciale', 'Motiver, former et développer les compétences.'),
  ('b3000000-0000-0000-0000-000000000003', 4, 'Évaluer les performances de l''équipe commerciale', 'Fixer des objectifs, mesurer et accompagner la performance.')
on conflict (block_id, number) do nothing;

-- Bloc 4 : CEJM (E3) — Culture Économique, Juridique et Managériale
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b3000000-0000-0000-0000-000000000004','a3000000-0000-0000-0000-000000000001',4,
   'CEJM — Culture Économique, Juridique et Managériale (E3)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b3000000-0000-0000-0000-000000000004', 1, 'Analyser des situations économiques', 'Mobiliser des concepts et raisonnements économiques sur des cas concrets.'),
  ('b3000000-0000-0000-0000-000000000004', 2, 'Mobiliser un raisonnement juridique', 'Identifier les règles applicables et argumenter une solution juridique.'),
  ('b3000000-0000-0000-0000-000000000004', 3, 'Analyser une problématique managériale', 'Diagnostiquer une situation d''entreprise sous l''angle du management.'),
  ('b3000000-0000-0000-0000-000000000004', 4, 'Élaborer une argumentation croisée E-J-M', 'Construire un raisonnement intégrant les trois dimensions.')
on conflict (block_id, number) do nothing;

-- ============================================================
-- BTS NDRC — Négociation et Digitalisation de la Relation Client
-- Blocs : E4 (Négociation Vente), E6 (Animation Réseau), CEJM
-- ============================================================
insert into public.formations(id, code, name, description) values
  ('a4000000-0000-0000-0000-000000000001', 'BTS_NDRC', 'BTS NDRC — Négociation et Digitalisation de la Relation Client',
   'BTS niveau 5 — Blocs : E4 Négociation vente, E6 Animation de réseau, CEJM')
on conflict (code) do nothing;

-- E4 : Négociation Vente
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b4000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001',1,
   'E4 — Relation client et Négociation Vente')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b4000000-0000-0000-0000-000000000001', 1, 'Cibler et prospecter la clientèle', 'Analyser un marché, segmenter et déployer des actions de prospection.'),
  ('b4000000-0000-0000-0000-000000000001', 2, 'Négocier et accompagner la relation client', 'Mener un entretien de vente et suivre la relation dans la durée.'),
  ('b4000000-0000-0000-0000-000000000001', 3, 'Organiser et animer un événement commercial', 'Concevoir, planifier et évaluer un événement.'),
  ('b4000000-0000-0000-0000-000000000001', 4, 'Exploiter et mutualiser l''information commerciale', 'Structurer l''information commerciale via un CRM.')
on conflict (block_id, number) do nothing;

-- E6 : Animation de Réseau
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b4000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000001',2,
   'E6 — Relation client et Animation de Réseau')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b4000000-0000-0000-0000-000000000002', 1, 'Implanter et promouvoir l''offre chez des distributeurs', 'Négocier le référencement et animer les points de vente.'),
  ('b4000000-0000-0000-0000-000000000002', 2, 'Développer et piloter un réseau de partenaires', 'Recruter, animer et fidéliser des partenaires commerciaux.'),
  ('b4000000-0000-0000-0000-000000000002', 3, 'Créer et animer un réseau de vente directe', 'Structurer un réseau de vente à domicile ou de VDI.')
on conflict (block_id, number) do nothing;

-- CEJM pour BTS NDRC
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000001',3,
   'CEJM — Culture Économique, Juridique et Managériale (E3)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b4000000-0000-0000-0000-000000000003', 1, 'Analyser des situations économiques', 'Mobiliser des concepts et raisonnements économiques sur des cas concrets.'),
  ('b4000000-0000-0000-0000-000000000003', 2, 'Mobiliser un raisonnement juridique', 'Identifier les règles applicables et argumenter une solution juridique.'),
  ('b4000000-0000-0000-0000-000000000003', 3, 'Analyser une problématique managériale', 'Diagnostiquer une situation d''entreprise sous l''angle du management.'),
  ('b4000000-0000-0000-0000-000000000003', 4, 'Élaborer une argumentation croisée E-J-M', 'Construire un raisonnement intégrant les trois dimensions.')
on conflict (block_id, number) do nothing;

-- ============================================================
-- BTS GTLA — Gestion des Transports et Logistique Associée
-- CEJM uniquement pour l'instant (à enrichir avec les blocs métier plus tard)
-- ============================================================
insert into public.formations(id, code, name, description) values
  ('a5000000-0000-0000-0000-000000000001', 'BTS_GTLA', 'BTS GTLA — Gestion des Transports et Logistique Associée',
   'BTS niveau 5 — CEJM disponible. Ajouter les blocs métier depuis les paramètres.')
on conflict (code) do nothing;

insert into public.competence_blocks(id, formation_id, number, title) values
  ('b5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001',1,
   'CEJM — Culture Économique, Juridique et Managériale (E3)')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b5000000-0000-0000-0000-000000000001', 1, 'Analyser des situations économiques', 'Mobiliser des concepts et raisonnements économiques sur des cas concrets.'),
  ('b5000000-0000-0000-0000-000000000001', 2, 'Mobiliser un raisonnement juridique', 'Identifier les règles applicables et argumenter une solution juridique.'),
  ('b5000000-0000-0000-0000-000000000001', 3, 'Analyser une problématique managériale', 'Diagnostiquer une situation d''entreprise sous l''angle du management.'),
  ('b5000000-0000-0000-0000-000000000001', 4, 'Élaborer une argumentation croisée E-J-M', 'Construire un raisonnement intégrant les trois dimensions.')
on conflict (block_id, number) do nothing;

-- ============================================================
-- TP RDDC — Responsable du Développement Commercial (tous blocs)
-- ============================================================
insert into public.formations(id, code, name, description) values
  ('a6000000-0000-0000-0000-000000000001', 'TP_RDDC', 'TP RDDC — Responsable du Développement Commercial',
   'Titre pro niveau 6 — 3 blocs : stratégie omnicanale, management, pilotage performance')
on conflict (code) do nothing;

-- Bloc 1 : Élaborer et mettre en œuvre une stratégie commerciale omnicanale
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b6000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000001',1,
   'Élaborer et mettre en œuvre une stratégie commerciale omnicanale')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b6000000-0000-0000-0000-000000000001', 1, 'Réaliser un diagnostic stratégique', 'Analyser l''environnement interne et externe (SWOT, PESTEL).'),
  ('b6000000-0000-0000-0000-000000000001', 2, 'Définir un plan d''action commercial', 'Fixer des objectifs, cibler et prioriser les actions.'),
  ('b6000000-0000-0000-0000-000000000001', 3, 'Mettre en œuvre une politique tarifaire', 'Définir le prix, les remises et les conditions commerciales.'),
  ('b6000000-0000-0000-0000-000000000001', 4, 'Déployer une stratégie omnicanale', 'Coordonner les canaux physiques et digitaux.'),
  ('b6000000-0000-0000-0000-000000000001', 5, 'Élaborer un budget commercial', 'Construire et suivre le budget des actions.')
on conflict (block_id, number) do nothing;

-- Bloc 2 : Développer et manager une équipe commerciale
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b6000000-0000-0000-0000-000000000002','a6000000-0000-0000-0000-000000000001',2,
   'Développer et manager une équipe commerciale')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b6000000-0000-0000-0000-000000000002', 1, 'Recruter et intégrer les commerciaux', 'Définir les profils, sélectionner et onboarder.'),
  ('b6000000-0000-0000-0000-000000000002', 2, 'Animer et fédérer l''équipe commerciale', 'Motiver, communiquer et faire adhérer à la stratégie.'),
  ('b6000000-0000-0000-0000-000000000002', 3, 'Développer les compétences des commerciaux', 'Identifier les besoins de formation et accompagner la montée en compétences.'),
  ('b6000000-0000-0000-0000-000000000002', 4, 'Piloter l''activité de l''équipe', 'Suivre les objectifs individuels et collectifs.'),
  ('b6000000-0000-0000-0000-000000000002', 5, 'Gérer les conflits et la relation sociale', 'Prévenir et résoudre les tensions.')
on conflict (block_id, number) do nothing;

-- Bloc 3 : Piloter la performance commerciale
insert into public.competence_blocks(id, formation_id, number, title) values
  ('b6000000-0000-0000-0000-000000000003','a6000000-0000-0000-0000-000000000001',3,
   'Piloter la performance commerciale')
on conflict (formation_id, number) do nothing;

insert into public.skills(block_id, number, label, description) values
  ('b6000000-0000-0000-0000-000000000003', 1, 'Analyser les indicateurs de performance', 'Interpréter les KPI et identifier les leviers d''action.'),
  ('b6000000-0000-0000-0000-000000000003', 2, 'Mettre en place des outils de pilotage', 'Concevoir des tableaux de bord et systèmes de reporting.'),
  ('b6000000-0000-0000-0000-000000000003', 3, 'Ajuster la stratégie commerciale', 'Prendre des décisions correctives à partir des données.'),
  ('b6000000-0000-0000-0000-000000000003', 4, 'Reporter à la direction générale', 'Présenter les résultats et les recommandations.'),
  ('b6000000-0000-0000-0000-000000000003', 5, 'Assurer la veille concurrentielle et sectorielle', 'Anticiper les évolutions du marché.')
on conflict (block_id, number) do nothing;

-- ============================================================
-- Vérification finale
-- ============================================================
select
  f.code as formation,
  count(distinct b.id) as nb_blocs,
  count(sk.id) as nb_competences
from public.formations f
left join public.competence_blocks b on b.formation_id = f.id
left join public.skills sk on sk.block_id = b.id
group by f.code
order by f.code;
