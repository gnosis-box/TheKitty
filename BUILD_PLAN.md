# PotCommun — Plan de build

> Plan opérationnel pour Claude Code. Chaque phase a un **livrable testable** et un **critère de done** non négociable.
> Suivre l'ordre. Ne pas commencer une phase sans avoir validé la précédente.

---

## Phase 0 — Sanity check du host (2-3h) ⚠️ BLOQUANT

**But** : valider que la chaîne `Vite + Bun + Circles SDK + Vercel + playground` fonctionne avant d'écrire la moindre logique métier.

### Tâches

1. **Scaffold Vite + React + TS**
   ```bash
   bun create vite potcommun --template react-ts
   cd potcommun
   bun install
   ```

2. **Installer Tailwind v4**
   ```bash
   bun add -D tailwindcss @tailwindcss/vite
   ```
   Configurer `vite.config.ts` avec le plugin Tailwind v4.

3. **Installer shadcn/ui** (CLI compatible Vite) avec components : `button`, `card`, `input`, `dialog`, `badge`, `separator`, `sonner` (toasts).

4. **Installer les SDKs Circles**
   ```bash
   bun add @aboutcircles/miniapp-sdk @aboutcircles/sdk viem react-router-dom
   ```

5. **Créer `src/components/wallet/WalletProvider.tsx`**
   - Context React qui appelle `onWalletChange` dans un `useEffect`
   - Expose `{ address, isConnected, isMiniappHost }`
   - Gère le cas standalone (hors host) sans crasher

6. **Créer `src/hooks/use-wallet.ts`** qui consomme le context

7. **Créer une page de test** `src/routes/home.tsx` qui affiche :
   - Badge "Connected: 0xabc...123" ou "Not connected"
   - Bouton "Test sign message" → appelle `signMessage('Hello from PotCommun')`
   - Bouton "Test tx" → envoie une tx minimale (ex: `hub.trust(self, expiry)` ou un noop)
   - Toast de succès/échec

8. **Créer `vercel.json`** à la racine avec CSP `frame-ancestors` et rewrites SPA.

9. **Déployer sur Vercel** : `vercel --prod` ou push GitHub avec intégration.

10. **Tester dans le playground** :
    - Ouvrir `https://circles.gnosis.io/playground?url=<preview-url>`
    - Vérifier que l'address apparaît
    - Vérifier que `signMessage` retourne une signature
    - Vérifier qu'une tx test passe

### Critère de done

✅ Une vidéo screen-record où on voit :
1. Le playground charger l'iframe
2. L'address Safe apparaître dans le badge
3. Un sign message réussir
4. Une tx test réussir avec hash

**Si l'un de ces 4 points casse, NE PAS PASSER À LA PHASE 1.** Debug ici jusqu'à ce que ça marche. Tout le reste en dépend.

---

## Phase 1 — Smart contract `PotGovernance` (4-6h)

**But** : avoir le contrat gouvernance déployé sur sandbox, testé, vérifié.

### Tâches

1. **Init Foundry**
   ```bash
   mkdir contracts && cd contracts
   forge init --no-commit
   forge install OpenZeppelin/openzeppelin-contracts --no-commit
   ```

2. **Écrire `src/PotGovernance.sol`** :

```solidity
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

interface IHub {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function toTokenId(address avatar) external pure returns (uint256);
}

contract PotGovernance {
    address public immutable hub;
    address public immutable groupAvatar;
    uint256 public immutable potTokenId;

    uint8 public quorumPercent;        // ex: 51
    uint128 public smallTxThreshold;   // ex: 5e18 (5 CRC)
    uint32 public votingPeriod;        // ex: 86400 (24h)

    address[] public members;
    mapping(address => bool) public isMember;

    struct Proposal {
        address proposer;
        address recipient;
        uint128 amount;
        uint32 deadline;
        uint32 approvals;
        bool executed;
        string memo;
    }

    Proposal[] public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event PotInitialized(address indexed group, address[] members);
    event Proposed(uint256 indexed id, address indexed proposer, address recipient, uint128 amount, string memo);
    event Approved(uint256 indexed id, address indexed voter);
    event Executed(uint256 indexed id);
    event SmallTxExecuted(address indexed by, address recipient, uint128 amount, string memo);

    modifier onlyMember() {
        require(isMember[msg.sender], "not member");
        _;
    }

    constructor(
        address _hub,
        address _groupAvatar,
        address[] memory _members,
        uint8 _quorumPercent,
        uint128 _smallTxThreshold,
        uint32 _votingPeriod
    ) {
        require(_quorumPercent > 0 && _quorumPercent <= 100, "bad quorum");
        require(_members.length >= 2, "need >= 2 members");
        hub = _hub;
        groupAvatar = _groupAvatar;
        potTokenId = IHub(_hub).toTokenId(_groupAvatar);
        quorumPercent = _quorumPercent;
        smallTxThreshold = _smallTxThreshold;
        votingPeriod = _votingPeriod;
        for (uint256 i = 0; i < _members.length; i++) {
            require(!isMember[_members[i]], "dup member");
            isMember[_members[i]] = true;
            members.push(_members[i]);
        }
        emit PotInitialized(_groupAvatar, _members);
    }

    function smallSpend(address recipient, uint128 amount, string calldata memo) external onlyMember {
        require(amount <= smallTxThreshold, "use propose");
        IHub(hub).safeTransferFrom(groupAvatar, recipient, potTokenId, amount, "");
        emit SmallTxExecuted(msg.sender, recipient, amount, memo);
    }

    function propose(address recipient, uint128 amount, string calldata memo) external onlyMember returns (uint256 id) {
        id = proposals.length;
        proposals.push(Proposal({
            proposer: msg.sender,
            recipient: recipient,
            amount: amount,
            deadline: uint32(block.timestamp) + votingPeriod,
            approvals: 1,
            executed: false,
            memo: memo
        }));
        hasVoted[id][msg.sender] = true;
        emit Proposed(id, msg.sender, recipient, amount, memo);
        emit Approved(id, msg.sender);
    }

    function approve(uint256 id) external onlyMember {
        Proposal storage p = proposals[id];
        require(!p.executed, "executed");
        require(block.timestamp <= p.deadline, "expired");
        require(!hasVoted[id][msg.sender], "voted");
        hasVoted[id][msg.sender] = true;
        p.approvals += 1;
        emit Approved(id, msg.sender);
        if (_quorumReached(p.approvals)) {
            _execute(id);
        }
    }

    function execute(uint256 id) external onlyMember {
        Proposal storage p = proposals[id];
        require(!p.executed, "executed");
        require(_quorumReached(p.approvals), "no quorum");
        _execute(id);
    }

    function _execute(uint256 id) internal {
        Proposal storage p = proposals[id];
        p.executed = true;
        IHub(hub).safeTransferFrom(groupAvatar, p.recipient, potTokenId, p.amount, "");
        emit Executed(id);
    }

    function _quorumReached(uint32 approvals) internal view returns (bool) {
        return uint256(approvals) * 100 >= members.length * quorumPercent;
    }

    function memberCount() external view returns (uint256) { return members.length; }
    function proposalCount() external view returns (uint256) { return proposals.length; }
    function getMembers() external view returns (address[] memory) { return members; }
}
```

3. **Tests Foundry** dans `test/PotGovernance.t.sol` couvrant :
   - Création avec membres valides
   - `smallSpend` sous le seuil
   - `smallSpend` au-dessus du seuil → revert
   - `propose` + `approve` jusqu'à quorum → exec auto
   - `approve` après deadline → revert
   - Double vote → revert
   - Non-membre vote → revert
   - `execute` manuel après quorum

4. **Script de déploiement** `script/Deploy.s.sol` qui :
   - Lit `HUB_ADDRESS`, `GROUP_AVATAR`, `MEMBERS` du `.env`
   - Deploy le contrat
   - Log l'address

5. **Déployer sur sandbox** et noter l'address dans `apps/web/.env.local`.

### Critère de done

✅ `forge test` passe à 100%, contrat déployé sur sandbox, address vérifiable sur GnosisScan.

---

## Phase 2 — UI : création de pot (4-6h)

**But** : un utilisateur peut créer un pot end-to-end depuis l'UI.

### Tâches

1. **Setup routing** dans `apps/web/src/App.tsx` avec react-router-dom :
   - `/` → home (liste pots)
   - `/pot/new` → création
   - `/pot/:id` → détail
   - `/pot/:id/deposit` → dépôt
   - `/pot/:id/propose` → propose
   - `/pot/:id/spend` → small spend

2. **ABI files** dans `src/lib/abi/` :
   - `hub-v2.ts` : extrait du V2 Hub avec `registerGroup`, `groupMint`, `safeTransferFrom`, `trust`
   - `name-registry.ts` : `registerShortNameWithNonce`
   - `pot-governance.ts` : ABI du contrat custom
   
   👉 **Avant d'écrire ces ABI**, fetch `https://raw.githubusercontent.com/aboutcircles/circles-contracts-v2/master/abi/Hub.json` (ou équivalent) pour avoir les signatures exactes.

3. **`src/lib/tx-builders.ts`** : functions qui retournent un `Transaction` ready-to-send :
   - `buildRegisterGroupTx(name, symbol, mintPolicy)`
   - `buildDeployPotGovernanceTx(group, members, quorum, threshold, period)` (utilise CREATE2 ou simple deploy)
   - `buildTrustGroupTx(group, expiry)`
   - `buildGroupMintTx(group, collateral, amount)`
   - `buildProposeTx(potGov, recipient, amount, memo)`
   - `buildApproveTx(potGov, id)`
   - `buildExecuteTx(potGov, id)`
   - `buildSmallSpendTx(potGov, recipient, amount, memo)`

4. **`src/routes/pot-new.tsx`** :
   - Form : nom du pot, symbole (3-4 lettres), liste d'addresses Safe membres (au moins 2)
   - Sliders/inputs : quorum % (default 51), seuil small-tx (default 5 CRC), période vote (default 24h)
   - Validation : chaque address est un avatar Circles via `sdk.rpc.profile.getProfileView`
   - Submit → `sendTransactions([registerGroup, deployPotGovernance, ...trustCalls])`
   - Sur succès → redirect `/pot/:newGroupAddress`

5. **`src/routes/home.tsx`** :
   - Liste les Group avatars où l'address connectée est membre
   - Pour le MVP : lire les events `PotInitialized` du factory (ou stocker les pots créés en localStorage côté front pour la démo)
   - Bouton "Nouveau pot"

### Critère de done

✅ Un nouveau pot apparaît dans la liste de l'utilisateur après création, l'address du Group avatar est visible sur GnosisScan, le contrat `PotGovernance` est déployé.

---

## Phase 3 — Dépôt + dépense (6-8h)

**But** : le flow de fonds complet — déposer, proposer, voter, exécuter, paiement direct sous seuil.

### Tâches

1. **`src/routes/pot-detail.tsx`** : page hub d'un pot
   - Header : nom, balance totale du pot, nombre de membres
   - Card "Mes contributions" : combien j'ai déposé, ma part %
   - Card "Démurrage évité" : calcul + animation
   - Liste membres avec profils via `@aboutcircles/sdk`
   - Liste propositions actives + historique
   - CTAs : Déposer / Dépenser / Proposer

2. **`src/routes/pot-deposit.tsx`** :
   - Input montant CRC à déposer
   - Affiche solde CRC perso de l'utilisateur (via SDK)
   - Submit → `sendTransactions([buildGroupMintTx(...)])`
   - Après confirmation : refresh balance pot

3. **`src/routes/pot-propose.tsx`** :
   - Input recipient (address Safe ou QR scan)
   - Input montant
   - Textarea memo
   - Si montant ≤ smallTxThreshold → propose le bouton "Payer direct (small tx)" au lieu de "Proposer"
   - Submit → `sendTransactions([buildProposeTx(...)])` ou `buildSmallSpendTx`

4. **`src/routes/pot-spend.tsx`** :
   - QR scanner (lib : `@yudiel/react-qr-scanner` ou équivalent) → décode address marchand
   - Input montant
   - Submit → flow propose ou small spend selon le montant

5. **Components `ProposalCard.tsx`** :
   - Affiche memo, recipient, montant, approvals X/N, deadline countdown
   - Bouton "Approuver" si utilisateur n'a pas voté et n'est pas le proposeur
   - Bouton "Exécuter" si quorum atteint et pas encore exécuté
   - État "Exécutée" avec hash de tx

6. **`src/components/pot/DemurrageStat.tsx`** :
   - Calcul : `balance_moyenne_sur_periode * 0.07 / 365 * jours_actif - démurrage_réel`
   - Le démurrage réel se déduit de la balance qui décroît passivement (lire historique via SDK)
   - Animation chiffre qui s'incrémente
   - Phrase contextuelle : "Vous avez sauvé X CRC du démurrage ce mois-ci en faisant circuler la cagnotte."

### Critère de done

✅ Démo de bout en bout reproductible :
1. Alice crée le pot
2. 3 membres déposent chacun 30 CRC
3. Charlie fait un small-spend de 12 CRC
4. Alice propose 600 CRC pour le loyer
5. Bob approuve, Charlie approuve → execute auto
6. La stat démurrage est visible et calculée

---

## Phase 4 — Polish & démo (4-6h)

**But** : le projet est *montrable* à un jury.

### Tâches

1. **Profils enrichis**
   - Chaque membre affiche son avatar Circles (image IPFS) et nom via `getProfileByCid`
   - Loading states gracieux (skeletons)

2. **Toasts contextuels** via `sonner`
   - "Tx envoyée…" pendant pending
   - "Pot créé ✓ Voir sur GnosisScan ↗" sur succès
   - "Dépense exécutée — 12 POT envoyés à Carrefour Marseille"

3. **Empty states** soignés
   - "Aucun pot pour l'instant. Crée ton premier pot commun."
   - "Aucune proposition en cours. C'est le moment de planifier la prochaine dépense."

4. **README.md à la racine** orienté utilisateur :
   - Pitch en 3 lignes
   - Screenshots
   - Comment tester (lien playground avec URL pré-remplie)
   - Stack technique
   - Roadmap V2

5. **Entry pour PR marketplace** dans `marketplace-entry.json` à la racine :
   ```json
   {
     "slug": "potcommun",
     "name": "PotCommun",
     "url": "https://potcommun.vercel.app/",
     "logo": "https://potcommun.vercel.app/logo.svg",
     "description": "Cagnottes & dépenses partagées de groupe. L'argent qui circule au lieu de dormir.",
     "tags": ["social", "groups", "payments"]
   }
   ```

6. **Vidéo démo 90s** (script dans `DEMO_SCRIPT.md`) :
   - 0:00 - 0:10 : problème (l'argent qui dort dans Leetchi)
   - 0:10 - 1:15 : 3 colocs scénario complet (création → dépôt → small spend → proposition loyer → vote → exécution)
   - 1:15 - 1:30 : punchline "Vous avez sauvé 4.2 CRC du démurrage" + logo

### Critère de done

✅ La vidéo de démo est tournée, le repo est public, la mini-app tourne en sandbox et est accessible via le playground avec une URL stable.

---

## Hors scope / V2 (backlog)

Tout ce qui suit va dans `BACKLOG.md`, **pas dans le code** :

- Récurrences (loyer mensuel auto-proposé)
- Délégation de pouvoir de vote
- Catégorisation + analytics dépenses
- Multi-pot dashboard
- Notifications push (via service worker)
- i18n FR/EN
- Dark mode
- Pots publics avec donations externes
- Pont vers Sofia pour réputation financière
- Mode "tontine" (rotation auto du bénéficiaire)

---

## Ordre d'exécution recommandé pour Claude Code

```
Phase 0 ────► STOP, validation manuelle (vidéo de test)
   │
   ▼
Phase 1 ────► forge test ✓ + deploy sandbox
   │
   ▼
Phase 2 ────► création de pot end-to-end ✓
   │
   ▼
Phase 3 ────► flow dépôt/vote/exec complet ✓
   │
   ▼
Phase 4 ────► polish + vidéo
```

**À chaque fin de phase** : commit `feat(potcommun): complete phase N — <résumé>`, push, vérifier que la preview Vercel marche dans le playground.
