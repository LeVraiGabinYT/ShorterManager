# ShorterManager

App de bureau (Electron + React + TypeScript) pour gérer le contenu d'une chaîne YouTube :
idées de vidéos, objets achetés, et (à venir) connexion à la chaîne via l'API YouTube.

Cross-platform par nature (Electron) : fonctionne à l'identique sur macOS, Windows et Linux — ce
n'est pas une app native macOS.

Voir `CLAUDE.md` pour l'architecture et `PROGRESS.md` pour l'état d'avancement et la suite prévue.

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

## Build

```bash
npm run build:mac      # macOS
npm run build:win      # Windows
npm run build:linux    # Linux
```

## Développer sur Windows

Le projet se clone et se lance sur Windows exactement comme sur macOS :

1. Installer [Node.js LTS](https://nodejs.org/) (inclut npm).
2. Installer [Git](https://git-scm.com/) si ce n'est pas déjà fait.
3. `git clone https://github.com/LeVraiGabinYT/ShorterManager.git`
4. `cd ShorterManager && npm install`
5. `npm run dev` pour lancer l'app, ou `npm run build:win` pour générer un installeur `.exe`.

Point d'attention : `better-sqlite3` (la base de données locale) est un module natif compilé pour
l'OS/l'architecture courante. `npm install` télécharge normalement un binaire précompilé pour
Windows automatiquement. Si ça échoue (rare), il faut les outils de compilation C++ de Windows
(`npm install --global windows-build-tools` ou Visual Studio Build Tools avec le workload "Desktop
development with C++") pour que `node-gyp` puisse compiler le module localement.

## Autres commandes

```bash
npm run typecheck   # vérification TypeScript
npm run lint         # ESLint
npm run format       # Prettier
```
