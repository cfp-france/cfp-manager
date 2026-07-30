# CFP Manager — MVP fonctionnel

Application web SaaS pour la gestion des formateurs indépendants, missions, heures et suivi pédagogique.

**Stack** : Next.js 14 (App Router, TypeScript, Server Components + Server Actions), Tailwind CSS, Supabase (PostgreSQL + Auth + RLS), déploiement Vercel.

**Périmètre livré (V1)** :
- Authentification (email + mot de passe) avec deux rôles : administrateur et formateur
- Référentiels : CFA, formateurs, formations, blocs de compétences, compétences
- Missions multi-dates avec assistant de création + règle de récurrence (génération automatique des séances, exclusions de dates)
- Saisie d'heures par le formateur avec ajustement des heures réelles + motif d'écart obligatoire si > 15 min
- Bloc de suivi pédagogique aligné sur le format CFP : Bloc, Compétence(s) visée(s), Contenu abordé, Supports pédagogiques utilisés, Travail effectué / Avancement, Commentaire / Points à revoir, % de complétion
- Validation admin (validation, refus avec motif)
- Déclaration d'absence par le formateur → identification automatique des séances impactées → traitement admin → passage en « remplacement à pourvoir »
- Gestion des remplacements
- Suivi pédagogique agrégé avec filtres (formation, CFA, formateur, bloc, période) + export CSV au format CFP exact
- Row-Level Security PostgreSQL : chaque formateur ne voit que ses propres données

**Base de démonstration pré-remplie** : référentiel NTC complet (2 blocs, 17 compétences), 1 CFA Herblay, 3 formateurs (Siham, Sadia, Reddy), 1 mission NTC Promo 1 avec 10 séances déjà générées.

---

## Guide de déploiement — 15 minutes

### Étape 1 — Créer un compte Supabase (2 min)

1. Aller sur https://supabase.com — cliquer sur « Start your project », se connecter avec GitHub ou email.
2. Cliquer sur « New project ». Choisir :
   - **Name** : `cfp-manager`
   - **Database password** : générez un mot de passe fort et notez-le
   - **Region** : `West Europe (Ireland)` ou `Central EU (Frankfurt)`
   - **Plan** : Free
3. Attendre 1-2 minutes que le projet soit provisionné.

### Étape 2 — Exécuter la migration SQL (3 min)

1. Dans le tableau de bord Supabase, cliquer sur **SQL Editor** (icône dans la barre latérale).
2. Cliquer sur **+ New query**.
3. Ouvrir le fichier `supabase/migrations/0001_initial_schema.sql` de ce projet, copier tout son contenu, le coller dans l'éditeur SQL Supabase.
4. Cliquer sur **Run** (ou Ctrl+Enter). Vous devriez voir « Success ».

### Étape 3 — Récupérer les clés API Supabase (1 min)

1. Dans le tableau de bord Supabase, aller dans **Project Settings → API**.
2. Notez ces deux valeurs :
   - **Project URL** (ex : `https://xxxxxxxx.supabase.co`)
   - **anon public** key (une longue chaîne commençant par `eyJ...`)

### Étape 4 — Déployer sur Vercel (5 min)

**Option 4a — Via GitHub (recommandé)**

1. Créer un repo Git : `git init && git add . && git commit -m "Initial commit"`.
2. Créer un repo GitHub, y pousser le code.
3. Aller sur https://vercel.com, se connecter avec GitHub.
4. Cliquer sur « Add New… → Project », sélectionner votre repo `cfp-manager`.
5. Dans **Environment Variables**, ajouter :
   - `NEXT_PUBLIC_SUPABASE_URL` = URL récupérée à l'étape 3
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = clé anon récupérée à l'étape 3
6. Cliquer sur **Deploy**. Attendre ~2 min.
7. Votre app est en ligne sur `https://cfp-manager-xxxx.vercel.app`.

**Option 4b — Test en local**

```bash
cp .env.example .env.local
# Éditer .env.local avec vos vraies clés Supabase
npm install
npm run dev
```
Ouvrir http://localhost:3000.

### Étape 5 — Créer le premier compte administrateur (2 min)

1. Ouvrir l'URL de votre app (Vercel ou localhost).
2. Sur l'écran de login, cliquer sur « **Créer un compte** ».
3. Entrer votre email + mot de passe (min. 8 caractères) et créer le compte.
4. **Important** : par défaut vous êtes créé avec le rôle *formateur*. Pour devenir admin :
   - Retour dans Supabase → SQL Editor → New query
   - Exécuter : `update public.profiles set role = 'admin' where email = 'votre@email.com';`
5. Vous reconnecter sur l'app → vous êtes redirigé vers le dashboard admin.

### Étape 6 — Lier les formateurs seed à des comptes de connexion (optionnel)

Le seed contient 3 formateurs (Siham, Sadia, Reddy) sans compte de connexion. Pour tester la vue formateur :
1. Créer un compte formateur via l'écran de connexion (ex : `siham@example.fr` — même email que dans le seed).
2. En tant qu'admin, aller dans **Formateurs**, sélectionner l'email dans la liste déroulante à côté du formateur correspondant, cliquer sur « Lier ».
3. Se déconnecter, se connecter avec le compte formateur → vous voyez l'espace formateur avec les séances déjà pré-affectées.

---

## Structure du projet

```
cfp-manager/
├── supabase/migrations/0001_initial_schema.sql   Schéma + RLS + seed NTC
├── src/
│   ├── app/                                       Routes Next.js (App Router)
│   │   ├── login/                                 Écran de connexion
│   │   ├── auth/callback/                         Callback OAuth
│   │   ├── (admin)/                               Groupe de routes admin
│   │   │   ├── layout.tsx                         Sidebar admin
│   │   │   ├── dashboard/, cfa/, trainers/,
│   │   │   ├── missions/, missions/new/,
│   │   │   ├── validation/, pedagogy/,
│   │   │   ├── absences/, substitutions/
│   │   ├── (trainer)/                             Groupe de routes formateur
│   │   │   ├── layout.tsx                         Sidebar formateur
│   │   │   ├── home/, sessions/, sessions/[id]/,
│   │   │   ├── absence/, earnings/
│   │   └── api/export/pedagogy/                   Export CSV format CFP
│   ├── actions/                                   Server Actions (mutations)
│   │   ├── auth.ts, entries.ts, absences.ts,
│   │   ├── substitutions.ts, missions.ts, referentials.ts
│   ├── components/                                Composants partagés
│   ├── lib/
│   │   ├── supabase/{client,server,middleware}.ts Clients Supabase
│   │   └── utils.ts                               Helpers (auth guards, format)
│   └── middleware.ts                              Auth check global
├── package.json, tsconfig.json, next.config.js
├── tailwind.config.ts, postcss.config.js
├── .env.example
└── README.md
```

---

## Ce qui n'est PAS encore inclus (à ajouter en V1.5 / V2)

- Génération PDF (factures, bilans) — pour l'instant CSV uniquement
- Messagerie interne (chat)
- Notifications email (rappels de saisie, alertes doc expirant) — la structure DB est prête, il faut brancher Resend
- Application mobile native
- Signature électronique

Le code est structuré pour recevoir ces modules sans refonte : les tables existent déjà en base.

---

## Notes techniques

- **Sécurité** : Row-Level Security est activée sur toutes les tables. Un formateur ne peut jamais lire les données d'un autre formateur (garanti par la base, pas seulement par l'UI).
- **Types** : le projet n'inclut pas de types TypeScript générés automatiquement depuis Supabase. Vous pouvez en générer via `npx supabase gen types typescript --project-id XXX > src/lib/database.types.ts` si souhaité.
- **Recalcul des heures** : les colonnes `hours_planned` et `hours_actual` sont calculées automatiquement par PostgreSQL (colonnes générées).
- **Génération des séances** : la mission créée génère les séances via une boucle server-side. Pour de gros volumes, envisager une fonction Postgres.

## Support

Pour toute question, ouvrir un ticket ou contacter le développeur.

## Licence

Propriétaire — CFP.
