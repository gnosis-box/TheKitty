# PotCommun — Mini-app Circles

> **Cagnottes & dépenses partagées on-chain pour des groupes humains.**
> Mini-app embarquée dans Gnosis App, fonctionnant sur Circles V2 (Gnosis Chain).

---

## Contexte projet

PotCommun est une mini-app Circles permettant à un groupe humain (colocs, asso, équipe, voyage) de :

1. Créer un **pot commun** matérialisé par un **Group avatar Circles V2**
2. Chaque membre y **dépose ses CRC perso** qui sont collatéralisés en **PotToken** (token de groupe fongible)
3. **Voter collectivement** les dépenses via un smart contract `PotGovernance` custom
4. **Dépenser** le PotToken chez les marchands acceptant CRC dans Gnosis App
5. **Retirer** ses CRC perso à tout moment en redeem du PotToken

Le **démurrage de 7%/an** de Circles devient une *feature* : la cagnotte t'incite à l'utiliser au lieu de la laisser dormir (contrairement à Lydia / Leetchi).

**Contexte de livraison** : hackathon court, démo-friendly. Démo cible = 90 secondes (3 colocs → loyer + frigo).

---

## Stack technique — décisions arrêtées

| Couche | Choix | Raison |
|---|---|---|
| Bundler | **Vite 6** | SPA client-only, HMR rapide, pas de SSR inutile |
| Runtime / PM | **Bun** | Préférence dev, install rapide |
| Framework UI | **React 19 + TypeScript** | Stack maîtrisée |
| Styling | **Tailwind v4 + shadcn/ui** | Productivité, cohérence visuelle |
| Routing | **react-router-dom v7** | Simple, suffisant pour SPA |
| Wallet bridge | **`@aboutcircles/miniapp-sdk`** | Imposé par le host iframe |
| Circles data | **`@aboutcircles/sdk`** | Read profils, balances, trust, history |
| EVM calldata | **viem** | Encodage tx pour Hub V2 + PotGovernance |
| Smart contract | **Foundry + Solidity 0.8.24** | Standards, tests |
| Deploy frontend | **Vercel** | Preview URLs pour itérer dans le playground |
| Deploy contract | **Gnosis Chain sandbox puis mainnet** | Sandbox pendant le dev |

### Stack à NE PAS utiliser

- ❌ Next.js (overhead SSR/RSC inutile pour iframe SPA)
- ❌ wagmi / RainbowKit / Web3Modal (le host EST le wallet)
- ❌ Backend custom pour MVP (tout en lecture directe via SDK + events on-chain)
- ❌ Indexeur tiers (The Graph etc.) — overkill pour la démo

---

## Architecture Circles V2 — comprendre AVANT de coder

### Les acteurs on-chain

```
┌──────────────────────────────────────────────────────────────────┐
│ Circles V2 Hub (0x3D61f0A272eC69d65F5CFF097212079aaFDe8267)      │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Human Avatar │    │ Group Avatar │    │ Organization │       │
│  │ (mint CRC/h) │    │  (= un Pot)  │    │   Avatar     │       │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘       │
│         │                   │                                    │
│         │ trust             │ owns                               │
│         ▼                   ▼                                    │
│         Group ◄────────► MintPolicy + Vault                      │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ governance overlay
                              ▼
                  ┌──────────────────────┐
                  │  PotGovernance.sol   │  ← notre seul contrat custom
                  │  (propose/vote/exec) │
                  └──────────────────────┘
```

### Le flow PotCommun en termes Circles V2

1. **Créer un pot** :
   - Register un **Group avatar** dans le V2 Hub (via `nameRegistry.registerShortNameWithNonce` + `hub.registerGroup`)
   - Attacher une **MintPolicy** (utiliser la `baseGroupMintPolicy` standard : `0x79Cbc9C7077dF161b92a745345A6Ade3fC626A60`)
   - Deploy `PotGovernance` lié à ce group avatar

2. **Inviter / rejoindre** :
   - Un membre rejoint le pot en faisant `hub.trust(groupAvatar, expiry)`
   - Le créateur du pot doit aussi appeler `groupAvatar.trust(memberAvatar)` côté policy

3. **Déposer CRC perso → mint PotToken** :
   - L'utilisateur appelle `hub.groupMint(groupAvatar, collateralAvatars[], amounts[], data)`
   - Ses CRC perso vont dans le **Vault** du group
   - Il reçoit en échange du **PotToken** (token ERC-1155 du group avatar)

4. **Dépense votée** :
   - Membre A appelle `potGovernance.propose(recipient, amount, memo)`
   - Membres B, C appellent `potGovernance.approve(proposalId)`
   - Quand quorum atteint → `potGovernance.execute(proposalId)`
   - L'execute appelle `hub.safeTransferFrom(group, recipient, potTokenId, amount, "")`

5. **Redeem (sortir du pot)** :
   - L'utilisateur appelle la policy pour burn ses PotTokens et récupérer ses CRC perso depuis le Vault

### Adresses sandbox Gnosis Chain (dev)

```ts
export const SANDBOX_CONFIG = {
  circlesRpcUrl: 'https://static.94.138.251.148.clients.your-server.de/rpc/',
  pathfinderUrl: 'https://pathfinder.aboutcircles.com',
  profileServiceUrl: 'https://static.94.138.251.148.clients.your-server.de/profiles/',
  v1HubAddress: '0x29b9a7fbb8995b2423a71cc17cf9810798f6c543',
  v2HubAddress: '0x3D61f0A272eC69d65F5CFF097212079aaFDe8267',
  migrationAddress: '0x28141b6743c8569Ad8B20Ac09046Ba26F9Fb1c90',
  nameRegistryAddress: '0x8D1BEBbf5b8DFCef0F7E2039e4106A76Cb66f968',
  baseGroupMintPolicy: '0x79Cbc9C7077dF161b92a745345A6Ade3fC626A60',
  standardTreasury: '0x3545955Bc3900bda704261e4991f239BBd99ecE5',
};
```

⚠️ **Vérifier ces adresses contre la doc officielle** à `https://docs.aboutcircles.com/developer-docs/getting-started-with-the-sdk` avant tout deploy. Elles changent rarement mais cas sandbox = possible variation.

---

## Modèle host iframe — règles absolues

### 1. Le host est le wallet, point final.

```ts
// ✅ CORRECT
import { onWalletChange } from '@aboutcircles/miniapp-sdk';
useEffect(() => {
  const unsub = onWalletChange((address) => setAddress(address));
  return unsub;
}, []);

// ❌ INTERDIT — n'écris JAMAIS ça
import { useConnect } from 'wagmi';  // NON
<ConnectButton />                     // NON
<WalletConnectModal />                // NON
```

Pas de bouton "Connect", pas de Web3Modal, pas de wagmi providers. L'address arrive via postMessage du host. Si l'app tourne hors host (dev standalone), `isMiniappHost === false` et on reste en mode "Not connected" — c'est le comportement attendu.

### 2. Toutes les écritures passent par `sendTransactions`

```ts
import { sendTransactions } from '@aboutcircles/miniapp-sdk';
import { encodeFunctionData } from 'viem';

const txHashes = await sendTransactions([
  {
    to: V2_HUB_ADDRESS,
    data: encodeFunctionData({
      abi: hubAbi,
      functionName: 'groupMint',
      args: [groupAvatar, [userAvatar], [amount], '0x'],
    }),
    value: '0',
  },
]);
```

Le host bat les txs en bundle et les signe via le Safe de l'utilisateur. Tu construis le calldata — c'est tout.

### 3. CSP frame-ancestors obligatoire

Sans ça, le host refuse de charger l'iframe. Dans `vercel.json` à la racine :

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://*.gnosis.io https://*.vercel.app https://*.aboutcircles.com"
        }
      ]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 4. Tester dans le playground

```
https://circles.gnosis.io/playground?url=<https://ton-preview.vercel.app>
```

Pas de manifest, pas de PR avant la fin du hackathon. Push → preview → playground.

---

## Workflow Claude Code

### Règles d'or

1. **Vérifie la doc Circles AVANT de coder** chaque interaction Hub V2. Les signatures ABI peuvent évoluer. Source de vérité : `https://docs.aboutcircles.com/` + `https://github.com/aboutcircles/circles-contracts-v2`.

2. **Phase 0 = sanity check du host**. Ne commence aucune autre phase avant d'avoir vu une `sendTransactions` simple traverser le playground avec succès. Si ça casse là, tout le reste casse.

3. **Sandbox d'abord**. Toute interaction blockchain démarre sur sandbox. Mainnet seulement pour la démo finale (et juste pour la captation vidéo si tout marche en sandbox).

4. **Pas de over-engineering**. Pas de Redux, pas de state machine, pas de query layer custom. React Context + `useState` + SDK calls direct. Hackathon timeline.

5. **Commits propres et fréquents**. Conventional commits. Un commit = une phase ou une feature.

6. **Tests sur le contrat, pas sur le front**. Foundry tests obligatoires pour `PotGovernance.sol`. Front = pas de test unitaire pour le hackathon (gain de temps marginal).

### Structure de repo cible

```
potcommun/
├── apps/
│   └── web/                          # mini-app Vite + React
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── routes/
│       │   │   ├── home.tsx                  # liste des pots
│       │   │   ├── pot-new.tsx               # créer un pot
│       │   │   ├── pot-detail.tsx            # détail pot
│       │   │   ├── pot-deposit.tsx           # déposer CRC
│       │   │   ├── pot-propose.tsx           # proposer une dépense
│       │   │   └── pot-spend.tsx             # paiement direct < seuil
│       │   ├── components/
│       │   │   ├── wallet/
│       │   │   │   ├── WalletProvider.tsx    # onWalletChange + Context
│       │   │   │   └── WalletStatus.tsx      # badge connected/not
│       │   │   ├── pot/
│       │   │   │   ├── PotCard.tsx
│       │   │   │   ├── MemberList.tsx
│       │   │   │   ├── ProposalCard.tsx
│       │   │   │   └── DemurrageStat.tsx     # "CRC sauvés du démurrage"
│       │   │   └── ui/                       # shadcn primitives
│       │   ├── hooks/
│       │   │   ├── use-wallet.ts
│       │   │   ├── use-circles-sdk.ts
│       │   │   ├── use-user-pots.ts
│       │   │   ├── use-pot-detail.ts
│       │   │   └── use-proposals.ts
│       │   ├── lib/
│       │   │   ├── circles-config.ts         # sandbox + mainnet configs
│       │   │   ├── abi/
│       │   │   │   ├── hub-v2.ts
│       │   │   │   ├── name-registry.ts
│       │   │   │   └── pot-governance.ts
│       │   │   ├── tx-builders.ts            # encodeFunctionData helpers
│       │   │   └── utils.ts
│       │   └── types/
│       │       └── pot.ts
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── contracts/                        # Foundry workspace
│   ├── src/
│   │   └── PotGovernance.sol
│   ├── test/
│   │   └── PotGovernance.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   ├── foundry.toml
│   └── remappings.txt
├── vercel.json                       # CSP + rewrites
├── bunfig.toml
├── package.json                      # workspace root
├── README.md
└── CLAUDE.md                         # ce fichier
```

### Commandes attendues (workspace root, via Bun)

```bash
bun install              # install all workspaces
bun dev                  # vite dev sur apps/web
bun build                # build prod apps/web
bun typecheck            # tsc --noEmit
bun lint                 # eslint
cd contracts && forge test    # tests contract
cd contracts && forge script script/Deploy.s.sol --rpc-url $GNOSIS_RPC --broadcast
```

### Variables d'environnement

```bash
# apps/web/.env.local (Vite expose VITE_*)
VITE_CIRCLES_ENV=sandbox                       # sandbox | mainnet
VITE_POT_GOVERNANCE_FACTORY=0x...              # rempli après deploy

# contracts/.env
PRIVATE_KEY=0x...
GNOSIS_RPC=https://rpc.gnosischain.com
GNOSISSCAN_API_KEY=...
```

---

## Garde-fous de design

### Le pitch doit transparaître dans l'UI

Le pitch est : *"l'argent qui dort coûte de l'argent ; PotCommun le fait travailler."* Ça doit se voir.

- Dashboard d'un pot → toujours afficher **"X CRC sauvés du démurrage ce mois-ci"** (calcul : `balance_moyenne * 0.07 / 12 * mois_actif - démurrage_réel_subi`)
- Animation subtile quand une dépense est exécutée : la barre "pot qui circule" monte
- Vide d'un pot inactif → message gentil "Ce pot dort depuis 3 semaines. Il perd ~0.4 CRC/mois en démurrage."

### Onboarding zéro friction

Comme l'utilisateur est *déjà* un humain Circles vérifié (il vient du host), on n'a aucun KYC, aucun signup, aucune validation à faire. Première interaction utile = en 2 clics : "Créer pot" → "Ajouter Bob et Charlie" → c'est créé.

### Le trust graph filtre naturellement

Pour qu'un membre dépose dans un pot, il faut que pot et membre se trust mutuellement. C'est le garde-fou sybil-resistant intégré. **Ne pas l'écraser** avec une couche d'invitations custom. Utiliser l'UI Circles native autant que possible.

---

## Critères de done pour la démo

- [ ] Mini-app charge dans `https://circles.gnosis.io/playground?url=...`
- [ ] Wallet Safe injectée par le host, badge address visible
- [ ] Création d'un pot avec 3 membres réelle on-chain (sandbox)
- [ ] Dépôt CRC → PotToken visible dans la balance du pot
- [ ] Proposition + vote + exécution d'une dépense réelle
- [ ] Dépense < seuil exécutée direct sans vote
- [ ] Stat "démurrage évité" affichée et calculée
- [ ] Vidéo démo 90s tournée et montée
- [ ] Entry préparée pour PR sur `aboutcircles/CirclesMiniapps/static/miniapps.json`
- [ ] README.md grand public à la racine

---

## Références

- **Doc Circles** : https://docs.aboutcircles.com/
- **Boilerplate officiel (Next, pour référence)** : https://github.com/aboutcircles/embedded-miniapp-boilerplate
- **Host repo** : https://github.com/aboutcircles/CirclesMiniapps
- **Contracts V2** : https://github.com/aboutcircles/circles-contracts-v2
- **Playground** : https://circles.gnosis.io/playground
- **`@aboutcircles/miniapp-sdk`** : https://www.npmjs.com/package/@aboutcircles/miniapp-sdk
- **`@aboutcircles/sdk`** : https://www.npmjs.com/package/@aboutcircles/sdk

---

## Ce qui n'est PAS dans le scope MVP hackathon

- Récurrences (loyer mensuel auto) → V2
- Catégorisation des dépenses + stats → V2
- Délégation ("Bob peut auto-approuver jusqu'à 20 POT/sem") → V2
- Multi-pots dashboard cross-pot → V2
- Notifications push → V2
- Mobile native → V2 (web mobile suffit pour démo)
- i18n (FR/EN switch) → V2 si temps
- Dark mode → V2

Toute idée non listée plus haut dans le doc va dans `BACKLOG.md`, pas dans le code.
