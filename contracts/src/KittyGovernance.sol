// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @notice Minimal Circles V2 Hub interface used by the kitty.
interface IHub {
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    function toTokenId(address avatar) external view returns (uint256);
}

/// @notice Minimal ERC-1155 receiver interface (subset of OpenZeppelin's).
interface IERC1155Receiver {
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4);
}

/// @notice ERC-165 introspection, required for `supportsInterface`.
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @title  KittyGovernance
/// @notice Custodial group treasury for a Circles V2 base group.
///
///         The contract:
///         - holds the group's pot tokens (ERC-1155 from Hub) on behalf of members,
///         - tracks per-member contributions for future redemption,
///         - exposes a `smallSpend` shortcut for sub-threshold amounts,
///         - runs a propose / approve / execute governance loop above the threshold.
///
/// @dev    Members deposit by bundling `Hub.groupMint` + `Hub.safeTransferFrom` to
///         this contract in a single Safe execution. On receipt the contract
///         credits `deposited[from] += value`. The pot's token id is locked in at
///         construction time from the linked group avatar.
///
///         Quorum semantics: `approvals * 100 >= members * quorumPercent`.
///         The threshold rounds UP to the next whole member (e.g. 3 members @ 51%
///         needs 2 approvals = 67%). Document this in UI copy.
contract KittyGovernance is IERC1155Receiver, IERC165, ReentrancyGuard {
    using SafeCast for uint256;

    /// @notice Upper bound on `memo` length to keep storage costs bounded.
    uint256 public constant MAX_MEMO_LEN = 256;

    address public immutable hub;
    address public immutable groupAvatar;
    uint256 public immutable potTokenId;

    uint8 public immutable quorumPercent;
    uint128 public immutable smallTxThreshold;
    uint32 public immutable votingPeriod;

    /// @notice Optional rotating-savings (tontine / ROSCA) parameters.
    ///         When `tontineMode == true`, members can call `claimRound()` in
    ///         turn (by index in `_members`) once per `roundDuration`, each
    ///         time pulling `roundContribution * memberCount` out of the pot.
    ///         Free-form `propose`/`smallSpend` are DISABLED in tontine mode:
    ///         the pot is reserved for the rotation, and each surface commits
    ///         to a single mode (tontine vs group pot).
    bool public immutable tontineMode;
    uint32 public immutable roundDuration;
    uint128 public immutable roundContribution;

    /// @notice Total rounds in one full cycle. Defaults to memberCount but
    ///         can be a multiple if the creator wants multiple full
    ///         rotations before stakes refund.
    uint32 public immutable cycleRounds;

    /// @notice Penalty stake every member commits at join time. 0 disables
    ///         the stake mechanism entirely (legacy "honor system" mode).
    ///         When > 0, the kitty stays in Phase.Setup until every member
    ///         has called depositStake(), then transitions to Phase.Active
    ///         and round 0 can be claimed.
    uint128 public immutable stakeAmount;

    /// @notice Lifecycle phase of the kitty.
    ///   Setup    — stake-mode kitties stay here until all stakes are in.
    ///              For stakeAmount == 0 kitties the constructor jumps
    ///              straight to Active.
    ///   Active   — claimRound / propose / smallSpend / deposit all allowed.
    ///   Complete — cycleRounds claims have been settled. Members can pull
    ///              their remaining stake back via withdrawStake().
    enum Phase {
        Setup,
        Active,
        Complete
    }
    Phase public phase;

    /// @notice Per-member stake balance. Decreases when slashing covers a
    ///         shortfall on a round; refundable when the kitty enters
    ///         Phase.Complete and the member was honest.
    mapping(address => uint128) public staked;
    mapping(address => bool) public hasStaked;
    /// @notice Number of members who have called depositStake. Used to
    ///         decide the Setup -> Active transition.
    uint32 public stakedMemberCount;

    /// @notice Index of the next round to be claimed (0-based, no wrap-around).
    uint32 public currentRound;
    /// @notice Earliest timestamp at which the current claimer can call
    ///         `claimRound`. Bumped by `roundDuration` after each claim.
    uint32 public nextClaimAt;

    address[] private _members;
    mapping(address => bool) public isMember;

    /// Gross cumulative amount each member has transferred in. Informational
    /// only (never decreases) — redemption is driven by `shares`, not this.
    mapping(address => uint128) public deposited;
    uint128 public totalDeposited;

    /// @notice Group-pot redemption accounting (non-tontine mode only). Each
    ///         deposit mints `shares` proportional to the live pot; each
    ///         collective spend dilutes every share equally. `withdraw` burns
    ///         shares for the matching slice of `potBalance`, so a member
    ///         always recovers their fair share of whatever the group hasn't
    ///         spent yet.
    /// @dev    `shares[a]` is the RAW recorded balance and may be stale: when a
    ///         spend drains the pot to exactly zero the pool is retired to a new
    ///         `shareEpoch`, invalidating every outstanding share in O(1) (they
    ///         were worth 0 anyway). Stale shares are re-zeroed on the owner's
    ///         next deposit. Use `withdrawableOf` for the truthful value.
    mapping(address => uint256) public shares;
    uint256 public totalShares;
    /// @notice Pool epoch. Bumped whenever a spend empties the pot; shares
    ///         tagged with an older epoch are dead and re-zeroed on next touch.
    uint64 public shareEpoch;
    mapping(address => uint64) private _shareEpochOf;
    /// @notice Live count of pot tokens held for the group-pot pool. Tracked
    ///         internally (not read from the Hub) so withdrawals never depend
    ///         on an external balance call. Stays in sync because every inflow
    ///         runs through `_credit` and every outflow through a guarded spend.
    uint128 public potBalance;

    struct Proposal {
        address proposer;
        address recipient;
        uint128 amount;
        uint32 deadline;
        uint32 approvals;
        bool executed;
        string memo;
    }

    /// @notice Tontine configuration passed to the constructor.
    /// @dev    `enabled == false` disables the rotating-savings path entirely;
    ///         the other fields must be zero in that case. When enabled,
    ///         `roundDuration`, `roundContribution`, and `cycleRounds` must be
    ///         non-zero, and `firstClaimAt` sets when round 0 becomes
    ///         claimable (use `block.timestamp` for "immediately" or any
    ///         future timestamp for a delayed start). `stakeAmount` is the
    ///         per-member penalty stake — set to 0 to disable the stake
    ///         mechanism entirely.
    struct TontineConfig {
        bool enabled;
        uint32 roundDuration;
        uint128 roundContribution;
        uint32 firstClaimAt;
        uint32 cycleRounds;
        uint128 stakeAmount;
    }

    Proposal[] private _proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event KittyInitialized(address indexed group, address[] members);
    event TontineInitialized(uint32 roundDuration, uint128 roundContribution, uint32 firstClaimAt);
    event StakeRequired(uint128 stakeAmount, uint32 cycleRounds);
    event StakeDeposited(address indexed member, uint128 amount, uint32 stakedSoFar);
    event PhaseChanged(Phase newPhase);
    event MemberSlashed(
        uint32 indexed round,
        address indexed member,
        uint128 shortfall,
        uint128 penalty
    );
    event StakeRefunded(address indexed member, uint128 amount);
    event RoundClaimed(
        uint32 indexed round,
        address indexed claimer,
        uint128 amount,
        uint32 nextClaimAt
    );
    event Deposit(address indexed from, uint128 amount, uint128 newTotal);
    event Withdrawn(address indexed account, uint256 shares, uint128 amount);
    event Proposed(
        uint256 indexed id,
        address indexed proposer,
        address indexed recipient,
        uint128 amount,
        uint32 deadline,
        string memo
    );
    event Approved(uint256 indexed id, address indexed voter, uint32 approvals);
    event Executed(uint256 indexed id, address indexed recipient, uint128 amount);
    event SmallSpend(
        address indexed by,
        address indexed recipient,
        uint128 amount,
        string memo
    );

    error NotMember();
    error BadQuorum();
    error NotEnoughMembers();
    error DuplicateMember();
    error AmountExceedsThreshold();
    error AlreadyExecuted();
    error AlreadyVoted();
    error VotingClosed();
    error QuorumNotReached();
    error UnknownProposal();
    error OnlyHub();
    error WrongTokenId();
    error ZeroAddress();
    error BadVotingPeriod();
    error DirectMintNotAllowed();
    error MemoTooLong();
    error NotTontine();
    error BadTontineParams();
    error RoundNotReady();
    error NotYourTurn();
    error NotInSetup();
    error NotActive();
    error AlreadyStaked();
    error NoStakeMode();
    error CycleAlreadyComplete();
    error TontineBankrupt();
    error FreeSpendInTontine();
    error BadRecipient();
    error NotGroupPot();
    error BadShareAmount();

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    constructor(
        address _hub,
        address _groupAvatar,
        address[] memory members_,
        uint8 _quorumPercent,
        uint128 _smallTxThreshold,
        uint32 _votingPeriod,
        TontineConfig memory _tontine
    ) {
        if (_hub == address(0) || _groupAvatar == address(0)) revert ZeroAddress();
        if (_quorumPercent == 0 || _quorumPercent > 100) revert BadQuorum();
        if (_votingPeriod == 0) revert BadVotingPeriod();
        if (members_.length < 2) revert NotEnoughMembers();

        if (_tontine.enabled) {
            if (_tontine.roundDuration == 0 || _tontine.roundContribution == 0) {
                revert BadTontineParams();
            }
            // slither-disable-next-line timestamp
            if (_tontine.firstClaimAt < block.timestamp) revert BadTontineParams();
            if (_tontine.cycleRounds == 0) revert BadTontineParams();
            // ROSCA fairness: each member must get the same number of turns, so
            // the cycle length must be a whole multiple of the member count.
            // Otherwise members whose turn never comes deposit without ever
            // claiming, and there is no redemption path to recover those funds.
            if (_tontine.cycleRounds % members_.length != 0) revert BadTontineParams();
        } else {
            if (
                _tontine.roundDuration != 0
                    || _tontine.roundContribution != 0
                    || _tontine.firstClaimAt != 0
                    || _tontine.cycleRounds != 0
                    || _tontine.stakeAmount != 0
            ) revert BadTontineParams();
        }

        hub = _hub;
        groupAvatar = _groupAvatar;
        potTokenId = IHub(_hub).toTokenId(_groupAvatar);
        quorumPercent = _quorumPercent;
        smallTxThreshold = _smallTxThreshold;
        votingPeriod = _votingPeriod;

        tontineMode = _tontine.enabled;
        roundDuration = _tontine.roundDuration;
        roundContribution = _tontine.roundContribution;
        cycleRounds = _tontine.cycleRounds;
        stakeAmount = _tontine.stakeAmount;
        nextClaimAt = _tontine.firstClaimAt;

        // Stake-enabled tontines start in Setup and wait for every member
        // to stake. Honor-system kitties (stakeAmount == 0) skip Setup.
        if (_tontine.enabled && _tontine.stakeAmount > 0) {
            phase = Phase.Setup;
        } else {
            phase = Phase.Active;
        }

        for (uint256 i = 0; i < members_.length; i++) {
            address m = members_[i];
            if (m == address(0)) revert ZeroAddress();
            if (isMember[m]) revert DuplicateMember();
            isMember[m] = true;
            _members.push(m);
        }

        emit KittyInitialized(_groupAvatar, members_);
        if (_tontine.enabled) {
            emit TontineInitialized(
                _tontine.roundDuration,
                _tontine.roundContribution,
                _tontine.firstClaimAt
            );
            if (_tontine.stakeAmount > 0) {
                emit StakeRequired(_tontine.stakeAmount, _tontine.cycleRounds);
            }
        }
    }

    // ── stake mechanism ─────────────────────────────────────────────────────

    /// @notice A member calls this once in Setup to commit their penalty
    ///         stake. Funding is identical to a regular deposit: the member
    ///         either bundles `Hub.groupMint + safeTransferFrom`, or the
    ///         caller bundles a single tx via setApprovalForAll (handled
    ///         off-contract). This entrypoint just records that the stake
    ///         was received and flips Setup -> Active when everyone is in.
    /// @dev    Must be called AFTER the actual ERC-1155 transfer of
    ///         `stakeAmount` pot tokens into this contract. The transfer
    ///         already added to `deposited[msg.sender]` via the receiver
    ///         hook; we re-account it into `staked[msg.sender]` so the
    ///         stake isn't counted as a round contribution.
    function depositStake() external onlyMember {
        if (stakeAmount == 0) revert NoStakeMode();
        if (phase != Phase.Setup) revert NotInSetup();
        if (hasStaked[msg.sender]) revert AlreadyStaked();
        if (deposited[msg.sender] < stakeAmount) revert TontineBankrupt();

        // Reclassify stakeAmount from deposit -> stake. The pot balance
        // doesn't change; the per-member accounting does.
        deposited[msg.sender] -= stakeAmount;
        totalDeposited -= stakeAmount;
        staked[msg.sender] = stakeAmount;
        hasStaked[msg.sender] = true;
        stakedMemberCount += 1;

        emit StakeDeposited(msg.sender, stakeAmount, stakedMemberCount);
        if (stakedMemberCount == _members.length) {
            phase = Phase.Active;
            emit PhaseChanged(Phase.Active);
        }
    }

    /// @notice After the cycle is complete, each member can pull back their
    ///         remaining stake (whatever wasn't slashed for defaults).
    function withdrawStake() external onlyMember nonReentrant {
        if (phase != Phase.Complete) revert NotActive();
        uint128 amount = staked[msg.sender];
        if (amount == 0) return;
        staked[msg.sender] = 0;
        emit StakeRefunded(msg.sender, amount);
        _transferOut(msg.sender, amount);
    }

    // ── ERC-1155 receiver ───────────────────────────────────────────────────

    function onERC1155Received(
        address /* operator */,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata /* data */
    ) external override returns (bytes4) {
        if (msg.sender != hub) revert OnlyHub();
        if (from == address(0)) revert DirectMintNotAllowed();
        if (id != potTokenId) revert WrongTokenId();
        _credit(from, value.toUint128());
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address /* operator */,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata /* data */
    ) external override returns (bytes4) {
        if (msg.sender != hub) revert OnlyHub();
        if (from == address(0)) revert DirectMintNotAllowed();
        uint256 len = ids.length;
        uint128 sum = 0;
        for (uint256 i = 0; i < len; i++) {
            if (ids[i] != potTokenId) revert WrongTokenId();
            sum += values[i].toUint128();
        }
        _credit(from, sum);
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    function _credit(address from, uint128 amount) internal {
        deposited[from] += amount;
        totalDeposited += amount;
        // Group-pot mode mints redeemable shares against the live pot so the
        // member can `withdraw` their proportional slice later. Tontine mode
        // skips this — its flow is the rotation + stake refund.
        if (!tontineMode) {
            // A prior spend may have retired the pool to a newer epoch; any
            // shares the depositor still carries from the old epoch are dead.
            if (_shareEpochOf[from] != shareEpoch) {
                shares[from] = 0;
                _shareEpochOf[from] = shareEpoch;
            }
            uint256 minted = (totalShares == 0 || potBalance == 0)
                ? amount
                : (uint256(amount) * totalShares) / potBalance;
            shares[from] += minted;
            totalShares += minted;
            potBalance += amount;
        }
        emit Deposit(from, amount, totalDeposited);
    }

    /// @dev Owner's redeemable shares, or 0 if they belong to a retired epoch.
    function _liveShares(address a) internal view returns (uint256) {
        return _shareEpochOf[a] == shareEpoch ? shares[a] : 0;
    }

    /// @dev Run after every spend. If the pot is now empty, retire the share
    ///      pool: outstanding shares (worth 0) are invalidated by bumping the
    ///      epoch, so the next deposit re-seeds a clean 1:1 pool instead of
    ///      letting dead shares dilute it.
    function _settleDrain() private {
        if (potBalance == 0 && totalShares != 0) {
            totalShares = 0;
            shareEpoch += 1;
        }
    }

    // ── spending ────────────────────────────────────────────────────────────

    /// @notice Spend below the small-tx threshold without a vote.
    function smallSpend(
        address recipient,
        uint128 amount,
        string calldata memo
    ) external onlyMember nonReentrant {
        // In tontine mode the pot is reserved for the rotation; free-form
        // spending could starve the next claim. Free spending lives only on
        // the "group pot" surface (tontineMode == false).
        if (tontineMode) revert FreeSpendInTontine();
        if (recipient == address(0)) revert ZeroAddress();
        if (recipient == address(this)) revert BadRecipient();
        if (amount > smallTxThreshold) revert AmountExceedsThreshold();
        if (bytes(memo).length > MAX_MEMO_LEN) revert MemoTooLong();
        // Reverts if the pot can't cover it — dilutes every share equally.
        potBalance -= amount;
        _settleDrain();
        emit SmallSpend(msg.sender, recipient, amount, memo);
        _transferOut(recipient, amount);
    }

    /// @notice Open a proposal for a larger spend. The proposer's vote is counted.
    function propose(
        address recipient,
        uint128 amount,
        string calldata memo
    ) external onlyMember returns (uint256 id) {
        if (tontineMode) revert FreeSpendInTontine();
        if (recipient == address(0)) revert ZeroAddress();
        if (recipient == address(this)) revert BadRecipient();
        if (bytes(memo).length > MAX_MEMO_LEN) revert MemoTooLong();
        uint32 deadline = uint32(block.timestamp) + votingPeriod;
        id = _proposals.length;
        _proposals.push(
            Proposal({
                proposer: msg.sender,
                recipient: recipient,
                amount: amount,
                deadline: deadline,
                approvals: 1,
                executed: false,
                memo: memo
            })
        );
        hasVoted[id][msg.sender] = true;
        emit Proposed(id, msg.sender, recipient, amount, deadline, memo);
        emit Approved(id, msg.sender, 1);
    }

    /// @notice Approve a pending proposal. Does NOT auto-execute — see `execute`.
    ///         Front-ends should bundle `[approve, execute]` when the next vote
    ///         meets quorum, so vote-recording stays decoupled from transfer
    ///         success.
    function approve(uint256 id) external onlyMember {
        if (id >= _proposals.length) revert UnknownProposal();
        Proposal storage p = _proposals[id];
        if (p.executed) revert AlreadyExecuted();
        // slither-disable-next-line timestamp
        if (block.timestamp > p.deadline) revert VotingClosed();
        if (hasVoted[id][msg.sender]) revert AlreadyVoted();

        hasVoted[id][msg.sender] = true;
        p.approvals += 1;
        emit Approved(id, msg.sender, p.approvals);
    }

    /// @notice Settle a proposal once it has reached quorum.
    function execute(uint256 id) external onlyMember nonReentrant {
        if (id >= _proposals.length) revert UnknownProposal();
        Proposal storage p = _proposals[id];
        if (p.executed) revert AlreadyExecuted();
        if (!_quorumReached(p.approvals)) revert QuorumNotReached();
        p.executed = true;
        // Reverts if the pot can't cover it — dilutes every share equally.
        potBalance -= p.amount;
        _settleDrain();
        emit Executed(id, p.recipient, p.amount);
        _transferOut(p.recipient, p.amount);
    }

    // ── redemption (group-pot mode) ──────────────────────────────────────────

    /// @notice Redeem `shareAmount` of your pot shares for the matching slice
    ///         of pot tokens. Group-pot mode only — tontine kitties move funds
    ///         via `claimRound` / `withdrawStake`. Collective spends already
    ///         made by the group reduce the value of every share equally, so
    ///         you receive your fair share of what remains, never more than the
    ///         pot holds.
    function withdraw(uint256 shareAmount) external nonReentrant returns (uint128 amount) {
        if (tontineMode) revert NotGroupPot();
        uint256 s = _liveShares(msg.sender);
        if (shareAmount == 0 || shareAmount > s) revert BadShareAmount();

        // shareAmount <= totalShares, so amount <= potBalance and fits uint128.
        amount = uint128((uint256(shareAmount) * potBalance) / totalShares);
        shares[msg.sender] = s - shareAmount;
        totalShares -= shareAmount;
        potBalance -= amount;

        emit Withdrawn(msg.sender, shareAmount, amount);
        _transferOut(msg.sender, amount);
    }

    /// @notice Pot tokens `account` would receive by burning all their shares
    ///         right now. Front-end helper for the "withdraw" button.
    function withdrawableOf(address account) external view returns (uint128) {
        if (totalShares == 0) return 0;
        return uint128((uint256(_liveShares(account)) * potBalance) / totalShares);
    }

    // ── tontine ─────────────────────────────────────────────────────────────

    /// @notice Address whose turn it is to claim the current round. Reverts if
    ///         tontine mode is disabled. Rotation is deterministic by member
    ///         index, modulo member count, so the cycle restarts automatically.
    function currentClaimer() external view returns (address) {
        if (!tontineMode) revert NotTontine();
        return _members[currentRound % _members.length];
    }

    /// @notice Pot share paid out at each round (`roundContribution * members`).
    function roundPayout() public view returns (uint128) {
        return roundContribution * uint128(_members.length);
    }

    /// @notice Claim the current round's payout. Only the member at
    ///         `currentRound % members.length` can call this, and only once
    ///         `nextClaimAt` has elapsed. Rotation advances by one and
    ///         `nextClaimAt` is bumped by `roundDuration` regardless of when
    ///         the claimer actually called.
    /// @dev    Reverts if pot balance is insufficient (members didn't all
    ///         deposit their share for this round). The cycle pauses until
    ///         enough collateral is in the pot.
    function claimRound() external onlyMember nonReentrant {
        if (!tontineMode) revert NotTontine();
        if (phase == Phase.Setup) revert NotInSetup();
        if (phase == Phase.Complete) revert CycleAlreadyComplete();
        // slither-disable-next-line timestamp
        if (block.timestamp < nextClaimAt) revert RoundNotReady();

        uint32 round = currentRound;
        address claimer = _members[round % _members.length];
        if (msg.sender != claimer) revert NotYourTurn();

        // Slash defaulters before paying out. The expected cumulative
        // deposit per member at the time round R is claimed is
        // `roundContribution * (R + 1)` — they've paid into the pot for
        // rounds 0..R inclusive. Anyone short gets the gap covered from
        // their stake at a 2x penalty.
        if (stakeAmount > 0) {
            _detectAndSlash(round);
        }

        uint128 payout = roundPayout();
        uint32 nextAt = uint32(block.timestamp) + roundDuration;

        currentRound = round + 1;
        nextClaimAt = nextAt;
        if (currentRound == cycleRounds) {
            phase = Phase.Complete;
            emit PhaseChanged(Phase.Complete);
        }

        emit RoundClaimed(round, claimer, payout, nextAt);
        _transferOut(claimer, payout);
    }

    /// @notice Liveness escape hatch. If the rotation stalls — e.g. a member
    ///         defaults and their stake can no longer cover the slash, so every
    ///         `claimRound` reverts `TontineBankrupt` — any member can force the
    ///         kitty into `Phase.Complete` once the current round has been
    ///         claimable for more than a full extra `roundDuration` without
    ///         progressing. This unblocks `withdrawStake` so honest members
    ///         recover their remaining stake instead of being frozen forever.
    /// @dev    Does NOT pay any pending round; residual round deposits are
    ///         settled socially off-chain (the trust graph is the backstop).
    ///         The grace window (nextClaimAt + roundDuration) guarantees the
    ///         current claimer keeps their full turn before anyone can exit.
    function forceComplete() external onlyMember {
        if (!tontineMode) revert NotTontine();
        if (phase != Phase.Active) revert NotActive();
        // slither-disable-next-line timestamp
        if (block.timestamp <= uint256(nextClaimAt) + roundDuration) revert RoundNotReady();
        phase = Phase.Complete;
        emit PhaseChanged(Phase.Complete);
    }

    /// @dev For each member, compare their cumulative deposits to the
    ///      expected mark for round R. If short, slash 2x the shortfall
    ///      from their stake and credit the shortfall into `deposited` so
    ///      the next `roundPayout` computation has the full pot.
    ///      Reverts TontineBankrupt if a member's stake can't cover.
    function _detectAndSlash(uint32 round) internal {
        uint256 expected = uint256(roundContribution) * (uint256(round) + 1);
        uint256 n = _members.length;
        for (uint256 i = 0; i < n; i++) {
            address m = _members[i];
            uint256 dep = deposited[m];
            if (dep >= expected) continue;

            uint128 shortfall = (expected - dep).toUint128();
            uint128 penalty = shortfall * 2;
            if (penalty > staked[m]) revert TontineBankrupt();

            staked[m] -= penalty;
            // The shortfall is paid into the pot; the extra penalty
            // (shortfall * 1) is forfeit and stays in the contract as
            // "bonus" that members share at withdraw / next round.
            deposited[m] += shortfall;
            totalDeposited += shortfall;

            emit MemberSlashed(round, m, shortfall, penalty);
        }
    }

    /// @dev Transfers pot tokens out of THIS contract (the custodian), not the group.
    function _transferOut(address recipient, uint128 amount) internal {
        IHub(hub).safeTransferFrom(address(this), recipient, potTokenId, amount, "");
    }

    function _quorumReached(uint32 approvals) internal view returns (bool) {
        return uint256(approvals) * 100 >= _members.length * quorumPercent;
    }

    // ── views ───────────────────────────────────────────────────────────────

    function memberCount() external view returns (uint256) {
        return _members.length;
    }

    function getMembers() external view returns (address[] memory) {
        return _members;
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        if (id >= _proposals.length) revert UnknownProposal();
        return _proposals[id];
    }
}
