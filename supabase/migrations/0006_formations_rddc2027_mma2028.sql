-- ─────────────────────────────────────────────────────────────────────────
-- Référentiel : Responsable du Développement Commercial (RDDC 2027)
-- RNCP 38505 - version 2026/2027 - 429,5h sur 4 blocs + 1 bloc transversal
-- ─────────────────────────────────────────────────────────────────────────

insert into public.formations (code, name, description) values
  ('RDDC_2027', 'Titre Professionnel RDDC — Responsable du Développement Commercial (RNCP 38505, 2027)', 'Promotion 2026/2027 - 429,5h')
on conflict (code) do update set name = excluded.name, description = excluded.description;

do $$
declare
  f_id uuid;
  b1 uuid; b2 uuid; b3 uuid; b4 uuid; bt uuid;
begin
  select id into f_id from public.formations where code = 'RDDC_2027';

  -- Nettoyage éventuel pour re-exécution
  delete from public.skills where block_id in (select id from public.competence_blocks where formation_id = f_id);
  delete from public.competence_blocks where formation_id = f_id;

  insert into public.competence_blocks (formation_id, number, title) values (f_id, 1, 'Définir la stratégie opérationnelle de développement commercial (73,5h)') returning id into b1;
  insert into public.competence_blocks (formation_id, number, title) values (f_id, 2, 'Déployer le plan de développement commercial (114h)') returning id into b2;
  insert into public.competence_blocks (formation_id, number, title) values (f_id, 3, 'Manager les équipes commerciales et fonctionnelles (86h)') returning id into b3;
  insert into public.competence_blocks (formation_id, number, title) values (f_id, 4, 'Contribuer à l''innovation en mode agile (87h)') returning id into b4;
  insert into public.competence_blocks (formation_id, number, title) values (f_id, 5, 'Bloc transversal (69h)') returning id into bt;

  -- Bloc 1 : 8 compétences
  insert into public.skills (block_id, number, label) values
    (b1, 1, 'Réaliser une analyse de son marché (diagnostic + veille stratégique)'),
    (b1, 2, 'Identifier les parties prenantes internes et externes'),
    (b1, 3, 'Hiérarchiser les cibles (volumes et rentabilité)'),
    (b1, 4, 'Définir les objectifs du plan de développement commercial'),
    (b1, 5, 'Planifier les actions (contraintes financières, techniques et humaines)'),
    (b1, 6, 'Présenter le plan de stratégie commerciale et marketing'),
    (b1, 7, 'Réaliser une veille concurrentielle, commerciale, technique et technologique'),
    (b1, 8, 'Proposer les ajustements du plan de stratégie commerciale');

  -- Bloc 2 : 11 compétences
  insert into public.skills (block_id, number, label) values
    (b2, 1, 'S''approprier le discours commercial et les supports de vente'),
    (b2, 2, 'Concevoir un plan de prospection commerciale ciblé'),
    (b2, 3, 'Réaliser un plan d''action commercial'),
    (b2, 4, 'Organiser le développement ciblé d''un portefeuille commercial'),
    (b2, 5, 'Réaliser un entretien commercial adapté au contexte'),
    (b2, 6, 'Formaliser une proposition commerciale chiffrée et complète'),
    (b2, 7, 'Mener les négociations de vente'),
    (b2, 8, 'Optimiser la gestion de la relation client'),
    (b2, 9, 'Gérer les réclamations et litiges'),
    (b2, 10, 'Concevoir un budget commercial'),
    (b2, 11, 'Piloter le budget commercial (KPI, tableaux de bord)');

  -- Bloc 3 : 9 compétences
  insert into public.skills (block_id, number, label) values
    (b3, 1, 'Participer aux activités de recrutement (collaboration RH)'),
    (b3, 2, 'Coordonner la répartition des tâches d''une équipe commerciale'),
    (b3, 3, 'Développer les compétences et le niveau de formation de son équipe'),
    (b3, 4, 'Accompagner individuellement les membres de l''équipe'),
    (b3, 5, 'Animer une équipe en réseau (nouvelles technologies)'),
    (b3, 6, 'Communiquer sur les réseaux professionnels et d''affaires'),
    (b3, 7, 'Piloter au quotidien les objectifs individuels et collectifs'),
    (b3, 8, 'Contrôler la performance de l''équipe (indicateurs)'),
    (b3, 9, 'Gérer les équipes en tenant compte de la diversité et du handicap');

  -- Bloc 4 : 7 compétences
  insert into public.skills (block_id, number, label) values
    (b4, 1, 'Impulser des évolutions et innovations commerciales et marketing'),
    (b4, 2, 'Mettre en œuvre une méthode de gestion de projet d''affaires agile'),
    (b4, 3, 'Coopérer avec les fonctions transverses / support'),
    (b4, 4, 'Présenter les projets de développement d''affaires innovants'),
    (b4, 5, 'Intégrer la stratégie RSE dans les actions de communication'),
    (b4, 6, 'Mettre en œuvre la stratégie marketing digital (IA / DATA)'),
    (b4, 7, 'Mesurer l''efficacité de communication de l''innovation');

  -- Bloc transversal : généralités
  insert into public.skills (block_id, number, label) values
    (bt, 1, 'Projet professionnel et développement de carrière'),
    (bt, 2, 'Anglais professionnel appliqué au commerce'),
    (bt, 3, 'Communication professionnelle et prise de parole'),
    (bt, 4, 'Accompagnement épreuves et soutenances');
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- Référentiel : Mastère Manager d'Affaires (MMA 2028)
-- RNCP 40257 - version 2028 - 910h sur 4 blocs
-- ─────────────────────────────────────────────────────────────────────────

insert into public.formations (code, name, description) values
  ('MMA_2028', 'Mastère Manager d''Affaires (RNCP 40257, 2028)', 'Promotion 2028 - 910h totales')
on conflict (code) do update set name = excluded.name, description = excluded.description;

do $$
declare
  f_id uuid;
  b1 uuid; b2 uuid; b3 uuid; b4 uuid;
begin
  select id into f_id from public.formations where code = 'MMA_2028';

  delete from public.skills where block_id in (select id from public.competence_blocks where formation_id = f_id);
  delete from public.competence_blocks where formation_id = f_id;

  insert into public.competence_blocks (formation_id, number, title) values (f_id, 1, 'Définir et mettre en œuvre une stratégie commerciale durable (234,5h)') returning id into b1;
  insert into public.competence_blocks (formation_id, number, title) values (f_id, 2, 'Développer l''activité commerciale (conquête + fidélisation + digital) (269,5h)') returning id into b2;
  insert into public.competence_blocks (formation_id, number, title) values (f_id, 3, 'Manager une équipe de collaborateurs et un réseau de partenaires (210h)') returning id into b3;
  insert into public.competence_blocks (formation_id, number, title) values (f_id, 4, 'Piloter l''activité d''un centre de profit (196h)') returning id into b4;

  insert into public.skills (block_id, number, label) values
    (b1, 1, 'C1.1 Réaliser une étude de marché avec démarche de veille (FCS, opportunités)'),
    (b1, 2, 'C1.2 Déterminer les avantages concurrentiels (analyse interne, mapping concurrentiel)'),
    (b1, 3, 'C1.3 Définir le public-cible inclusif (ICP)'),
    (b1, 4, 'C1.4 Fixer les objectifs quantitatifs et qualitatifs durables (SWOT)'),
    (b1, 5, 'C1.5 Décliner la stratégie en plan d''action commercial omnicanal inclusif'),
    (b1, 6, 'C1.6 Élaborer le budget du plan d''action commercial'),
    (b1, 7, 'C1.7 Argumenter le budget et les ratios de rentabilité auprès de la direction');

  insert into public.skills (block_id, number, label) values
    (b2, 1, 'C2.1 Construire un plan de prospection commerciale multicanal'),
    (b2, 2, 'C2.2 Mesurer la performance de la stratégie de prospection (KPI, CAC)'),
    (b2, 3, 'C2.3 Chiffrer et répondre aux appels d''offres'),
    (b2, 4, 'C2.4 Valoriser le portefeuille clients (cartographie CRM, fidélisation)'),
    (b2, 5, 'C2.5 Communiquer de façon individualisée avec les clients (omnicanal)'),
    (b2, 6, 'C2.6 Comprendre les besoins B2B/B2C (écoute active, inclusivité)'),
    (b2, 7, 'C2.7 Négocier en français et/ou anglais avec les parties concernées'),
    (b2, 8, 'C2.8 Conclure la négociation par une transaction équitable');

  insert into public.skills (block_id, number, label) values
    (b3, 1, 'C3.1 Informer les équipes internes et externes sur les enjeux'),
    (b3, 2, 'C3.2 Animer les équipes (présentiel, distanciel, hybride) de façon inclusive'),
    (b3, 3, 'C3.3 Suivre le travail des équipes et partenaires (outils collaboratifs)'),
    (b3, 4, 'C3.4 Solutionner les conflits (médiation, arbitrage)'),
    (b3, 5, 'C3.5 Participer à la démarche GEPP (gestion des emplois et parcours)'),
    (b3, 6, 'C3.6 Rédiger une fiche de poste inclusive, recruter ou chercher un partenaire');

  insert into public.skills (block_id, number, label) values
    (b4, 1, 'C4.1 Organiser la coordination des intervenants (Lean Management)'),
    (b4, 2, 'C4.2 Superviser la rédaction et la conformité des documents administratifs'),
    (b4, 3, 'C4.3 Élaborer un processus de gestion des litiges'),
    (b4, 4, 'C4.4 Concevoir les outils de pilotage (tableaux de bord QCD + RSE)'),
    (b4, 5, 'C4.5 Synthétiser les données et rédiger les rapports d''activité'),
    (b4, 6, 'C4.6 Gérer les crises et planifier les risques');
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- Enrichissement de la fiche formateur : NDA, SIRET, statut juridique
-- ─────────────────────────────────────────────────────────────────────────

alter table public.trainers
  add column if not exists siret text,
  add column if not exists nda text,
  add column if not exists legal_status text,
  add column if not exists company_name text,
  add column if not exists vat_number text,
  add column if not exists billing_address text,
  add column if not exists iban text,
  add column if not exists bic text;

comment on column public.trainers.siret is 'Numéro SIRET (14 chiffres) de l''entreprise du formateur';
comment on column public.trainers.nda is 'Numéro de déclaration d''activité auprès de la DIRECCTE';
comment on column public.trainers.legal_status is 'ex : Auto-entrepreneur, EURL, SASU, Portage salarial…';
comment on column public.trainers.company_name is 'Dénomination sociale de l''entreprise du formateur';
comment on column public.trainers.vat_number is 'Numéro de TVA intracommunautaire (vide si franchise de TVA)';
