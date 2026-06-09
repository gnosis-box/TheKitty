// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

interface IHubV2RP {
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    function balanceOf(address account, uint256 id) external view returns (uint256);

    function registerGroup(
        address mint,
        string calldata name,
        string calldata symbol,
        bytes32 metadataDigest
    ) external;
}

interface IBuyerActivityRP {
    function hasPaid(address buyer) external view returns (bool);
}

/// @title  RewardPool
/// @notice The Kitty's weekly prize pool, fused with its Circles V2 group
///         avatar registration. In the constructor the contract registers
///         itself as a group on the Hub V2 with the `OpenMintPolicy`
///         attached, so the contract's own address is the group avatar.
///         Buyers `groupMint(rewardPool, [buyer], [poolCut], "")` to mint
///         pool tokens against their personal CRC, then transfer those
///         pool tokens into this contract. Each Sunday 18:00 UTC a random
///         eligible buyer is drawn via `block.prevrandao` and the winner
///         claims the snapshotted prize.
///
/// @dev    Why fuse the avatar and the prize custodian into one contract?
///         Hub V2 enforces "recipient trusts sender's token" on every
///         ERC-1155 transfer. A separate custodian contract would need to
///         become a registered avatar just to call `Hub.trust(groupToken)`
///         before it could receive contributions. By making the avatar
///         the custodian, Hub V2's implicit self-trust rule
///         (`to == tokenAvatar`) lets the pool receive its own group
///         token with no explicit trust setup. Saves one contract, one
///         deploy, one `activate()` call, and the entire class of
///         "forgot to activate" bugs.
///
///         The pool's group token id is `uint256(uint160(address(this)))`.
///         Buyers pre-trust the pool (one shot via the front bundle) so
///         that winning a prize doesn't revert at claim time.
///
///         Anti-grinding posture for `block.prevrandao`: hackathon-grade.
///         For production we'd commit-reveal or use VRF; for the Garage
///         cycle 5 demo the small prize size makes manipulation
///         economically irrational vs. the gas + reputation cost.
contract RewardPool {
    IHubV2RP public immutable hub;
    IBuyerActivityRP public immutable activity;
    address public immutable mintPolicy;
    /// @notice ERC-1155 token id for the pool's own group token. Equal to
    ///         `uint256(uint160(address(this)))` by Circles V2 convention.
    uint256 public immutable selfTokenId;

    /// @notice Seven-day window. Week boundary alignment is computed in
    ///         `currentWeek()` so block.timestamp at the Mon 00:00 UTC
    ///         instant deterministically maps to the next week index.
    uint256 public constant WEEK = 7 days;

    /// @notice Eligible buyers entered into a given week's draw, in entry
    ///         order. Index = `weekIndex`.
    mapping(uint256 => address[]) public weeklyEntries;
    mapping(uint256 => mapping(address => bool)) public enteredWeek;

    /// @notice Winner address per drawn week. address(0) = not yet drawn.
    mapping(uint256 => address) public winners;
    /// @notice Snapshotted prize amount (group token units) per drawn week.
    mapping(uint256 => uint256) public weeklyPrize;
    /// @notice True once the winner has claimed the snapshotted prize.
    mapping(uint256 => bool) public claimed;

    event PoolRegistered(address indexed mintPolicy, string name, string symbol);
    event WeekEntered(uint256 indexed weekIndex, address indexed buyer);
    event WinnerDrawn(uint256 indexed weekIndex, address indexed winner, uint256 prize);
    event Claimed(uint256 indexed weekIndex, address indexed winner, uint256 prize);

    error NotPaidYet();
    error WeekNotEnded();
    error AlreadyDrawn();
    error NoEntries();
    error NotWinner();
    error AlreadyClaimed();
    error EmptyPool();

    constructor(
        address hubV2,
        address mintPolicy_,
        address buyerActivity,
        string memory name,
        string memory symbol,
        bytes32 metadataDigest
    ) {
        hub = IHubV2RP(hubV2);
        mintPolicy = mintPolicy_;
        activity = IBuyerActivityRP(buyerActivity);
        selfTokenId = uint256(uint160(address(this)));
        IHubV2RP(hubV2).registerGroup(mintPolicy_, name, symbol, metadataDigest);
        emit PoolRegistered(mintPolicy_, name, symbol);
    }

    /// @notice Buyer self-registers as eligible for the current week. Must
    ///         have a non-zero `firstPaidAt` on the BuyerActivity log
    ///         (proves they've moved CRC to a service provider at least
    ///         once). Idempotent within a week — calling twice in the
    ///         same week is a no-op (no duplicate event).
    function enterWeek() external {
        if (!activity.hasPaid(msg.sender)) revert NotPaidYet();

        uint256 w = currentWeek();
        if (!enteredWeek[w][msg.sender]) {
            enteredWeek[w][msg.sender] = true;
            weeklyEntries[w].push(msg.sender);
            emit WeekEntered(w, msg.sender);
        }
    }

    /// @notice Run the draw for a past week. Anyone may call. Picks an
    ///         entry index via `block.prevrandao % entries.length`. The
    ///         prize amount is snapshotted from the pool's current group
    ///         token balance — later contributions stay for future weeks.
    /// @param weekIndex Index of the week to draw. Must be a fully closed
    ///        week (< `currentWeek()`).
    function drawWeekly(uint256 weekIndex) external {
        if (weekIndex >= currentWeek()) revert WeekNotEnded();
        if (winners[weekIndex] != address(0)) revert AlreadyDrawn();

        address[] storage weekEntries = weeklyEntries[weekIndex];
        uint256 n = weekEntries.length;
        if (n == 0) revert NoEntries();

        uint256 prize = hub.balanceOf(address(this), selfTokenId);
        if (prize == 0) revert EmptyPool();

        uint256 r = uint256(block.prevrandao) % n;
        address winner = weekEntries[r];

        winners[weekIndex] = winner;
        weeklyPrize[weekIndex] = prize;
        emit WinnerDrawn(weekIndex, winner, prize);
    }

    /// @notice Winner claims the snapshotted prize. Transfers group tokens
    ///         from the pool to the winner. Decoupled from `drawWeekly`
    ///         so a winner who has not pre-trusted the group token can
    ///         set up trust and then claim without blocking the draw.
    function claim(uint256 weekIndex) external {
        address w = winners[weekIndex];
        if (msg.sender != w) revert NotWinner();
        if (claimed[weekIndex]) revert AlreadyClaimed();

        claimed[weekIndex] = true;
        uint256 prize = weeklyPrize[weekIndex];
        hub.safeTransferFrom(address(this), msg.sender, selfTokenId, prize, "");
        emit Claimed(weekIndex, msg.sender, prize);
    }

    /// @notice Required ERC-1155 receiver hooks so the Hub accepts the
    ///         pool as a transfer target — even though self-trust covers
    ///         the trust gate, the Hub still calls the receiver hook.
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    // ── views ───────────────────────────────────────────────────────────────

    /// @notice Current ISO-aligned week index. Unix epoch (Jan 1 1970) was a
    ///         Thursday, so adding 3 days shifts Mon 00:00 UTC to the
    ///         start of week N. Result is monotonic and increments at the
    ///         Mon 00:00 UTC boundary.
    function currentWeek() public view returns (uint256) {
        return (block.timestamp + 3 days) / WEEK;
    }

    function entriesCount(uint256 weekIndex) external view returns (uint256) {
        return weeklyEntries[weekIndex].length;
    }

    function entries(uint256 weekIndex) external view returns (address[] memory) {
        return weeklyEntries[weekIndex];
    }

    function poolBalance() external view returns (uint256) {
        return hub.balanceOf(address(this), selfTokenId);
    }
}
