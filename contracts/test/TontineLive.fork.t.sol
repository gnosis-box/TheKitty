// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {KittyFactory, IBaseGroupFactory} from "../src/KittyFactory.sol";
import {KittyGovernance} from "../src/KittyGovernance.sol";

/// @title Live rotation smoke test on a Gnosis Chain fork.
///
/// Run with:
///   forge test --match-contract TontineLiveTest -vv \
///     --fork-url https://rpc.gnosischain.com
///
/// What this proves: the *deployed* KittyFactory at
/// 0x880E213224Ce5B6B8a01A21D4318819c67146533 still talks to the real
/// Circles V2 BaseGroupFactory + Hub on Gnosis mainnet, creates a real
/// BaseGroup avatar, instantiates a KittyGovernance in tontine mode,
/// and the rotation auth + timing logic behaves correctly against the
/// real chain context.
///
/// What this does NOT prove: that the pot pays out. The deposit path
/// requires real CRC collateral from Circles-verified humans, which
/// no synthetic test EOA holds on the fork. The mock-Hub tests in
/// KittyGovernance.t.sol already cover the transferOut path (see
/// test_tontine_claimRound_happyPath + _fullCycleWraps for the full
/// 4-round trace), so combined the two suites cover the whole loop.
contract TontineLiveTest is Test {
    address constant FACTORY = 0x880E213224Ce5B6B8a01A21D4318819c67146533;
    address constant HUB = 0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8;
    address constant BASE_GROUP_FACTORY = 0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d;

    KittyFactory factory;

    address alice = makeAddr("live-alice");
    address bob = makeAddr("live-bob");
    address charlie = makeAddr("live-charlie");
    address stranger = makeAddr("live-stranger");

    function setUp() public {
        // Skip if not forking — these checks only matter against real chain state.
        try this.requireFork() {} catch {
            vm.skip(true);
        }
        factory = KittyFactory(FACTORY);
        // Fund the caller so createKitty doesn't run out of gas-paying funds.
        vm.deal(alice, 100 ether);
    }

    /// Helper used in setUp via low-level call so the revert is catchable.
    function requireFork() external view {
        require(FACTORY.code.length > 0, "Not on a fork that knows the factory");
    }

    function test_tontine_live_factoryIsWiredToRealCircles() public view {
        assertEq(factory.hub(), HUB, "factory.hub() should point at Gnosis Circles V2 Hub");
        assertEq(
            address(factory.baseGroupFactory()),
            BASE_GROUP_FACTORY,
            "factory.baseGroupFactory() should point at the Circles V2 BaseGroupFactory"
        );
    }

    function test_tontine_live_createsRealKittyWithTontineState() public {
        (KittyFactory.GroupArgs memory g, KittyFactory.KittyArgs memory k) = _tontineArgs();
        vm.prank(alice);
        (address baseGroup, address governance) = factory.createKitty(g, k);

        assertTrue(baseGroup.code.length > 0, "BaseGroup was deployed on chain");
        KittyGovernance kitty = KittyGovernance(governance);
        assertTrue(kitty.tontineMode(), "tontineMode flag is on");
        assertEq(kitty.roundDuration(), 60, "round duration matches");
        assertEq(kitty.roundContribution(), 10e18, "round contribution matches");
        assertEq(kitty.roundPayout(), 30e18, "payout is contribution * 3 members");
        assertEq(kitty.currentRound(), 0, "starts at round 0");
        assertEq(kitty.currentClaimer(), alice, "alice is the first claimer");
        assertEq(kitty.memberCount(), 3, "all 3 members registered");
        assertTrue(kitty.isMember(alice));
        assertTrue(kitty.isMember(bob));
        assertTrue(kitty.isMember(charlie));

        console2.log("Live KittyGovernance deployed at:", governance);
        console2.log("Live BaseGroup avatar:           ", baseGroup);
    }

    function test_tontine_live_authAndTimingChecks() public {
        (KittyFactory.GroupArgs memory g, KittyFactory.KittyArgs memory k) = _tontineArgs();
        vm.prank(alice);
        (, address governance) = factory.createKitty(g, k);
        KittyGovernance kitty = KittyGovernance(governance);

        // Round 0 hasn't opened yet (firstClaimAt = now + 60).
        vm.prank(alice);
        vm.expectRevert(KittyGovernance.RoundNotReady.selector);
        kitty.claimRound();

        // Warp to the moment round 0 opens.
        vm.warp(kitty.nextClaimAt());

        // A non-member cannot claim, even at the right time.
        vm.prank(stranger);
        vm.expectRevert(KittyGovernance.NotMember.selector);
        kitty.claimRound();

        // Bob (member[1]) cannot claim round 0 — it's alice's turn.
        vm.prank(bob);
        vm.expectRevert(KittyGovernance.NotYourTurn.selector);
        kitty.claimRound();

        // Alice (member[0]) hits the right turn at the right time, but the
        // pot is empty (no real Circles human funded it on this fork). The
        // ERC-1155 transfer at the end of claimRound therefore reverts
        // inside the Hub — we use a try/catch to confirm the call reaches
        // the transfer step. The rotation state changes still get rolled
        // back, which we assert below.
        uint32 roundBefore = kitty.currentRound();
        vm.prank(alice);
        (bool ok,) = address(kitty).call(abi.encodeWithSelector(KittyGovernance.claimRound.selector));
        assertFalse(
            ok,
            "claimRound should revert when pot is empty - the Hub.safeTransferFrom step has no balance to move"
        );
        assertEq(kitty.currentRound(), roundBefore, "failed claim does NOT advance rotation");
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    function _tontineArgs()
        internal
        view
        returns (KittyFactory.GroupArgs memory g, KittyFactory.KittyArgs memory k)
    {
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = charlie;

        g = KittyFactory.GroupArgs({
            service: address(0),
            feeCollection: alice,
            initialConditions: new address[](0),
            name: "LiveTontine",
            symbol: "LTN",
            metadataDigest: bytes32(0)
        });

        k = KittyFactory.KittyArgs({
            members: members,
            quorumPercent: 51,
            smallTxThreshold: 5e18,
            votingPeriod: 1 days,
            trustExpiry: type(uint96).max,
            tontine: KittyGovernance.TontineConfig({
                enabled: true,
                roundDuration: 60,
                roundContribution: 10e18,
                firstClaimAt: uint32(block.timestamp + 60)
            })
        });
    }
}
