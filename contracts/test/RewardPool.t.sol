// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import {RewardPool} from "../src/RewardPool.sol";

/// @dev Mocks the slice of the V2 Hub the pool touches: balanceOf,
///      safeTransferFrom (for claim), registerGroup (in constructor),
///      isHuman (for provider draw eligibility).
contract MockHubRP {
    mapping(address => mapping(uint256 => uint256)) public balances;
    mapping(address => bool) public humans;
    address public lastRegisteredPolicy;
    string public lastRegisteredName;
    string public lastRegisteredSymbol;
    bytes32 public lastRegisteredDigest;
    address public lastRegisteredCaller;

    function setBalance(address account, uint256 id, uint256 amount) external {
        balances[account][id] = amount;
    }

    function setHuman(address a, bool v) external {
        humans[a] = v;
    }

    function isHuman(address a) external view returns (bool) {
        return humans[a];
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return balances[account][id];
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata
    ) external {
        require(balances[from][id] >= amount, "insufficient");
        balances[from][id] -= amount;
        balances[to][id] += amount;
    }

    function registerGroup(
        address mint,
        string calldata name,
        string calldata symbol,
        bytes32 metadataDigest
    ) external {
        lastRegisteredPolicy = mint;
        lastRegisteredName = name;
        lastRegisteredSymbol = symbol;
        lastRegisteredDigest = metadataDigest;
        lastRegisteredCaller = msg.sender;
    }
}

contract MockActivityRP {
    mapping(address => bool) public paid;

    function setPaid(address a, bool v) external {
        paid[a] = v;
    }

    function hasPaid(address a) external view returns (bool) {
        return paid[a];
    }
}

contract RewardPoolTest is Test {
    MockHubRP hub;
    MockActivityRP activity;
    RewardPool pool;

    address policy = address(0x7D2a);

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address dave = makeAddr("dave");

    function setUp() public {
        hub = new MockHubRP();
        activity = new MockActivityRP();
        pool = new RewardPool(
            address(hub),
            policy,
            address(activity),
            "TheKittyPool",
            "TKP",
            bytes32(0)
        );
        // Warp to a known week (Wed 2026-06-10 12:00 UTC) to avoid epoch edge.
        vm.warp(1_780_400_000);
    }

    // ── constructor: self-registers as group ───────────────────────────────

    function test_constructor_registersGroup_withPolicy() public view {
        assertEq(hub.lastRegisteredPolicy(), policy);
        assertEq(hub.lastRegisteredName(), "TheKittyPool");
        assertEq(hub.lastRegisteredSymbol(), "TKP");
        assertEq(hub.lastRegisteredDigest(), bytes32(0));
        // The pool contract itself is the registrant (avatar) — that's the
        // whole point so the pool's address is the group avatar.
        assertEq(hub.lastRegisteredCaller(), address(pool));
    }

    function test_constructor_setsImmutables() public view {
        assertEq(address(pool.hub()), address(hub));
        assertEq(address(pool.activity()), address(activity));
        assertEq(pool.mintPolicy(), policy);
        assertEq(pool.selfTokenId(), uint256(uint160(address(pool))));
    }

    // ── enterWeek ──────────────────────────────────────────────────────────

    function test_enterWeek_addsBuyer() public {
        activity.setPaid(alice, true);
        vm.prank(alice);
        pool.enterWeek();

        uint256 w = pool.currentWeek();
        assertEq(pool.entriesCount(w), 1);
        address[] memory list = pool.entries(w);
        assertEq(list[0], alice);
        assertTrue(pool.enteredWeek(w, alice));
    }

    function test_enterWeek_revertsIfNotPaid() public {
        vm.prank(alice);
        vm.expectRevert(RewardPool.NotPaidYet.selector);
        pool.enterWeek();
    }

    function test_enterWeek_idempotentInSameWeek() public {
        activity.setPaid(alice, true);
        vm.prank(alice);
        pool.enterWeek();
        vm.prank(alice);
        pool.enterWeek();

        assertEq(pool.entriesCount(pool.currentWeek()), 1);
    }

    function test_enterWeek_separateWeeks_separateEntries() public {
        activity.setPaid(alice, true);
        vm.prank(alice);
        pool.enterWeek();
        uint256 w1 = pool.currentWeek();

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        pool.enterWeek();
        uint256 w2 = pool.currentWeek();

        assertGt(w2, w1);
        assertEq(pool.entriesCount(w1), 1);
        assertEq(pool.entriesCount(w2), 1);
    }

    function test_enterWeek_multipleBuyers() public {
        activity.setPaid(alice, true);
        activity.setPaid(bob, true);
        activity.setPaid(charlie, true);

        vm.prank(alice);
        pool.enterWeek();
        vm.prank(bob);
        pool.enterWeek();
        vm.prank(charlie);
        pool.enterWeek();

        uint256 w = pool.currentWeek();
        assertEq(pool.entriesCount(w), 3);
        address[] memory list = pool.entries(w);
        assertEq(list[0], alice);
        assertEq(list[1], bob);
        assertEq(list[2], charlie);
    }

    // ── drawWeekly ─────────────────────────────────────────────────────────

    function _seedWeek(address[] memory buyers, uint256 prize) internal returns (uint256 w) {
        for (uint256 i; i < buyers.length; ++i) {
            activity.setPaid(buyers[i], true);
            vm.prank(buyers[i]);
            pool.enterWeek();
        }
        w = pool.currentWeek();
        hub.setBalance(address(pool), pool.selfTokenId(), prize);
    }

    function test_drawWeekly_picksFromEntries() public {
        address[] memory buyers = new address[](3);
        buyers[0] = alice;
        buyers[1] = bob;
        buyers[2] = charlie;
        uint256 w = _seedWeek(buyers, 1_000);

        vm.warp(block.timestamp + 7 days);
        vm.prevrandao(bytes32(uint256(1))); // index 1 % 3 = 1 → bob
        pool.drawWeekly(w);

        assertEq(pool.winners(w), bob);
        // No provider entries → full pool to buyer.
        assertEq(pool.weeklyPrize(w), 1_000);
        assertEq(pool.providerWinners(w), address(0));
        assertEq(pool.providerWeeklyPrize(w), 0);
    }

    function test_drawWeekly_revertsBeforeWeekEnds() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 100);

        vm.expectRevert(RewardPool.WeekNotEnded.selector);
        pool.drawWeekly(w);
    }

    function test_drawWeekly_revertsIfAlreadyDrawn() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 500);

        vm.warp(block.timestamp + 7 days);
        pool.drawWeekly(w);

        vm.expectRevert(RewardPool.AlreadyDrawn.selector);
        pool.drawWeekly(w);
    }

    function test_drawWeekly_revertsIfNoEntries() public {
        uint256 w = pool.currentWeek();
        hub.setBalance(address(pool), pool.selfTokenId(), 100);

        vm.warp(block.timestamp + 7 days);
        vm.expectRevert(RewardPool.NoEntries.selector);
        pool.drawWeekly(w);
    }

    function test_drawWeekly_revertsIfPoolEmpty() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 0);

        vm.warp(block.timestamp + 7 days);
        vm.expectRevert(RewardPool.EmptyPool.selector);
        pool.drawWeekly(w);
    }

    // ── claim ──────────────────────────────────────────────────────────────

    function test_claim_transfersPrizeToWinner() public {
        address[] memory buyers = new address[](2);
        buyers[0] = alice;
        buyers[1] = bob;
        uint256 w = _seedWeek(buyers, 750);

        vm.warp(block.timestamp + 7 days);
        vm.prevrandao(bytes32(uint256(2))); // 2 % 2 = 0 → alice
        pool.drawWeekly(w);

        assertEq(pool.winners(w), alice);

        vm.prank(alice);
        pool.claim(w);

        assertEq(hub.balanceOf(alice, pool.selfTokenId()), 750);
        assertEq(hub.balanceOf(address(pool), pool.selfTokenId()), 0);
        assertTrue(pool.claimed(w));
    }

    function test_claim_revertsIfNotWinner() public {
        address[] memory buyers = new address[](2);
        buyers[0] = alice;
        buyers[1] = bob;
        uint256 w = _seedWeek(buyers, 100);

        vm.warp(block.timestamp + 7 days);
        vm.prevrandao(bytes32(uint256(0))); // → alice
        pool.drawWeekly(w);

        vm.prank(bob);
        vm.expectRevert(RewardPool.NotWinner.selector);
        pool.claim(w);
    }

    function test_claim_revertsIfAlreadyClaimed() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 200);

        vm.warp(block.timestamp + 7 days);
        pool.drawWeekly(w);

        vm.prank(alice);
        pool.claim(w);

        vm.prank(alice);
        vm.expectRevert(RewardPool.AlreadyClaimed.selector);
        pool.claim(w);
    }

    // ── enterProviderWeek ──────────────────────────────────────────────────

    function test_enterProviderWeek_revertsIfNotHuman() public {
        vm.expectRevert(RewardPool.NotHuman.selector);
        pool.enterProviderWeek(dave);
    }

    function test_enterProviderWeek_addsProvider() public {
        hub.setHuman(dave, true);
        pool.enterProviderWeek(dave);

        uint256 w = pool.currentWeek();
        assertEq(pool.providerEntriesCount(w), 1);
        assertTrue(pool.providerInWeek(w, dave));
    }

    function test_enterProviderWeek_idempotent() public {
        hub.setHuman(dave, true);
        pool.enterProviderWeek(dave);
        pool.enterProviderWeek(dave);

        assertEq(pool.providerEntriesCount(pool.currentWeek()), 1);
    }

    function test_enterProviderWeek_separateWeeks() public {
        hub.setHuman(dave, true);
        pool.enterProviderWeek(dave);
        uint256 w1 = pool.currentWeek();

        vm.warp(block.timestamp + 7 days);
        pool.enterProviderWeek(dave);
        uint256 w2 = pool.currentWeek();

        assertGt(w2, w1);
        assertEq(pool.providerEntriesCount(w1), 1);
        assertEq(pool.providerEntriesCount(w2), 1);
    }

    // ── two-sided draw ─────────────────────────────────────────────────────

    function test_drawWeekly_twoSidedSplits80_20() public {
        // Seed buyers + providers.
        address[] memory buyers = new address[](2);
        buyers[0] = alice;
        buyers[1] = bob;
        uint256 w = _seedWeek(buyers, 1_000);

        hub.setHuman(charlie, true);
        hub.setHuman(dave, true);
        pool.enterProviderWeek(charlie);
        pool.enterProviderWeek(dave);

        vm.warp(block.timestamp + 7 days);
        vm.prevrandao(bytes32(uint256(1))); // 1 % 2 = 1 → bob
        pool.drawWeekly(w);

        // 80% / 20% split.
        assertEq(pool.winners(w), bob);
        assertEq(pool.weeklyPrize(w), 800);

        address provWinner = pool.providerWinners(w);
        assertTrue(provWinner == charlie || provWinner == dave);
        assertEq(pool.providerWeeklyPrize(w), 200);
    }

    function test_drawWeekly_noProviders_fullPoolToBuyer() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 1_000);

        vm.warp(block.timestamp + 7 days);
        pool.drawWeekly(w);

        assertEq(pool.winners(w), alice);
        assertEq(pool.weeklyPrize(w), 1_000); // full pool, no provider share carved out
        assertEq(pool.providerWinners(w), address(0));
        assertEq(pool.providerWeeklyPrize(w), 0);
    }

    function test_claimProvider_transfersPrize() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 500);

        hub.setHuman(charlie, true);
        pool.enterProviderWeek(charlie);

        vm.warp(block.timestamp + 7 days);
        pool.drawWeekly(w);

        assertEq(pool.providerWinners(w), charlie);
        assertEq(pool.providerWeeklyPrize(w), 100); // 20% of 500

        vm.prank(charlie);
        pool.claimProvider(w);

        assertEq(hub.balanceOf(charlie, pool.selfTokenId()), 100);
        assertTrue(pool.providerClaimed(w));
    }

    function test_claimProvider_revertsIfNotProviderWinner() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 200);

        hub.setHuman(charlie, true);
        pool.enterProviderWeek(charlie);

        vm.warp(block.timestamp + 7 days);
        pool.drawWeekly(w);

        vm.prank(dave);
        vm.expectRevert(RewardPool.NotProviderWinner.selector);
        pool.claimProvider(w);
    }

    function test_claimProvider_revertsIfAlreadyClaimed() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 300);

        hub.setHuman(charlie, true);
        pool.enterProviderWeek(charlie);

        vm.warp(block.timestamp + 7 days);
        pool.drawWeekly(w);

        vm.prank(charlie);
        pool.claimProvider(w);

        vm.prank(charlie);
        vm.expectRevert(RewardPool.AlreadyClaimedProvider.selector);
        pool.claimProvider(w);
    }

    function test_drawWeekly_buyerAndProviderClaim_independent() public {
        // Both claims work independently against the same pool snapshot.
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 1_000);

        hub.setHuman(charlie, true);
        pool.enterProviderWeek(charlie);

        vm.warp(block.timestamp + 7 days);
        pool.drawWeekly(w);

        // Provider claims first.
        vm.prank(charlie);
        pool.claimProvider(w);
        assertEq(hub.balanceOf(charlie, pool.selfTokenId()), 200);

        // Buyer claims after.
        vm.prank(alice);
        pool.claim(w);
        assertEq(hub.balanceOf(alice, pool.selfTokenId()), 800);

        assertEq(hub.balanceOf(address(pool), pool.selfTokenId()), 0);
    }

    function test_claim_lateContributionsRollIntoNextWeek() public {
        address[] memory buyers = new address[](1);
        buyers[0] = alice;
        uint256 w = _seedWeek(buyers, 100);

        vm.warp(block.timestamp + 7 days);
        pool.drawWeekly(w);

        // Add 50 AFTER draw — should NOT inflate the snapshot.
        hub.setBalance(address(pool), pool.selfTokenId(), 150);

        assertEq(pool.weeklyPrize(w), 100, "snapshot must be 100");

        vm.prank(alice);
        pool.claim(w);

        // Pool keeps the 50 for future weeks.
        assertEq(hub.balanceOf(address(pool), pool.selfTokenId()), 50);
        assertEq(hub.balanceOf(alice, pool.selfTokenId()), 100);
    }

    // ── receivers ──────────────────────────────────────────────────────────

    function test_receiver_returnsSelector() public view {
        bytes4 single = pool.onERC1155Received(address(0), address(0), 0, 0, "");
        assertEq(single, pool.onERC1155Received.selector);
        uint256[] memory empty = new uint256[](0);
        bytes4 batch = pool.onERC1155BatchReceived(address(0), address(0), empty, empty, "");
        assertEq(batch, pool.onERC1155BatchReceived.selector);
    }

    // ── currentWeek monotonicity ───────────────────────────────────────────

    function test_currentWeek_isMonotonic() public {
        uint256 w0 = pool.currentWeek();
        vm.warp(block.timestamp + 7 days);
        assertGt(pool.currentWeek(), w0);
    }
}
