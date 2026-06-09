// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import {OpenMintPolicy, OpenMintPolicyDefinitions} from "../src/OpenMintPolicy.sol";

/// @dev Tiny mock that lets each test toggle isHuman per address.
contract MockHub {
    mapping(address => bool) public humans;

    function setHuman(address a, bool v) external {
        humans[a] = v;
    }

    function isHuman(address a) external view returns (bool) {
        return humans[a];
    }
}

/// @dev Tiny mock that lets each test toggle hasPaid per address.
contract MockBuyerActivity {
    mapping(address => bool) public paid;

    function setPaid(address a, bool v) external {
        paid[a] = v;
    }

    function hasPaid(address a) external view returns (bool) {
        return paid[a];
    }
}

contract OpenMintPolicyTest is Test {
    MockHub hub;
    MockBuyerActivity activity;
    OpenMintPolicy policy;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address mallory = makeAddr("mallory");

    function setUp() public {
        hub = new MockHub();
        activity = new MockBuyerActivity();
        policy = new OpenMintPolicy(address(hub), address(activity));
    }

    // ── helpers ────────────────────────────────────────────────────────────

    function _tid(address avatar) internal pure returns (uint256) {
        return uint256(uint160(avatar));
    }

    function _ids(address a) internal pure returns (uint256[] memory out) {
        out = new uint256[](1);
        out[0] = _tid(a);
    }

    function _ids2(address a, address b) internal pure returns (uint256[] memory out) {
        out = new uint256[](2);
        out[0] = _tid(a);
        out[1] = _tid(b);
    }

    function _amounts(uint256 a) internal pure returns (uint256[] memory out) {
        out = new uint256[](1);
        out[0] = a;
    }

    function _amounts2(uint256 a, uint256 b) internal pure returns (uint256[] memory out) {
        out = new uint256[](2);
        out[0] = a;
        out[1] = b;
    }

    // ── beforeMintPolicy ───────────────────────────────────────────────────

    function test_beforeMint_happyPath_humanAndPaid() public {
        hub.setHuman(alice, true);
        activity.setPaid(alice, true);

        bool ok = policy.beforeMintPolicy(alice, address(0xBEEF), _ids(alice), _amounts(100), "");
        assertTrue(ok);
    }

    function test_beforeMint_revert_collateralNotHuman() public {
        hub.setHuman(alice, false);
        activity.setPaid(alice, true);

        vm.expectRevert(abi.encodeWithSelector(OpenMintPolicy.CollateralNotHuman.selector, alice));
        policy.beforeMintPolicy(alice, address(0xBEEF), _ids(alice), _amounts(100), "");
    }

    function test_beforeMint_revert_collateralNeverPaid() public {
        hub.setHuman(alice, true);
        activity.setPaid(alice, false);

        vm.expectRevert(abi.encodeWithSelector(OpenMintPolicy.CollateralNotActiveBuyer.selector, alice));
        policy.beforeMintPolicy(alice, address(0xBEEF), _ids(alice), _amounts(100), "");
    }

    function test_beforeMint_revert_emptyCollateral() public {
        uint256[] memory empty = new uint256[](0);
        vm.expectRevert(OpenMintPolicy.EmptyCollateral.selector);
        policy.beforeMintPolicy(alice, address(0xBEEF), empty, empty, "");
    }

    function test_beforeMint_revert_lengthMismatch() public {
        hub.setHuman(alice, true);
        activity.setPaid(alice, true);
        uint256[] memory ids = _ids(alice);
        uint256[] memory amts = _amounts2(100, 200);

        vm.expectRevert(OpenMintPolicy.LengthMismatch.selector);
        policy.beforeMintPolicy(alice, address(0xBEEF), ids, amts, "");
    }

    function test_beforeMint_mixedBatch_revertsOnFirstBad() public {
        hub.setHuman(alice, true);
        activity.setPaid(alice, true);
        hub.setHuman(bob, true);
        activity.setPaid(bob, false); // bob never paid

        vm.expectRevert(abi.encodeWithSelector(OpenMintPolicy.CollateralNotActiveBuyer.selector, bob));
        policy.beforeMintPolicy(alice, address(0xBEEF), _ids2(alice, bob), _amounts2(100, 200), "");
    }

    function test_beforeMint_revert_nonPersonalTokenId() public {
        // A token id with bits above uint160 — not a personal avatar id.
        uint256[] memory ids = new uint256[](1);
        ids[0] = uint256(type(uint160).max) + 1;
        uint256[] memory amts = _amounts(100);

        vm.expectRevert(
            abi.encodeWithSelector(OpenMintPolicy.CollateralNotHuman.selector, address(0))
        );
        policy.beforeMintPolicy(alice, address(0xBEEF), ids, amts, "");
    }

    function test_beforeMint_batch_allHumanAllPaid() public {
        hub.setHuman(alice, true);
        activity.setPaid(alice, true);
        hub.setHuman(bob, true);
        activity.setPaid(bob, true);

        bool ok = policy.beforeMintPolicy(
            alice, address(0xBEEF), _ids2(alice, bob), _amounts2(100, 200), ""
        );
        assertTrue(ok);
    }

    // ── beforeBurnPolicy ───────────────────────────────────────────────────

    function test_beforeBurn_alwaysAllows() public {
        bool ok = policy.beforeBurnPolicy(mallory, address(0xBEEF), 999, "");
        assertTrue(ok);
    }

    // ── beforeRedeemPolicy ─────────────────────────────────────────────────

    function test_beforeRedeem_forwardsCallerRequest() public {
        uint256[] memory wantIds = new uint256[](2);
        wantIds[0] = _tid(alice);
        wantIds[1] = _tid(bob);
        uint256[] memory wantVals = new uint256[](2);
        wantVals[0] = 50;
        wantVals[1] = 75;

        bytes memory data = abi.encode(
            OpenMintPolicyDefinitions.BaseRedemptionPolicy({
                redemptionIds: wantIds,
                redemptionValues: wantVals
            })
        );

        (
            uint256[] memory rIds,
            uint256[] memory rVals,
            uint256[] memory bIds,
            uint256[] memory bVals
        ) = policy.beforeRedeemPolicy(mallory, mallory, address(0xBEEF), 125, data);

        assertEq(rIds.length, 2);
        assertEq(rIds[0], _tid(alice));
        assertEq(rIds[1], _tid(bob));
        assertEq(rVals[0], 50);
        assertEq(rVals[1], 75);
        assertEq(bIds.length, 0);
        assertEq(bVals.length, 0);
    }

    // ── immutables ─────────────────────────────────────────────────────────

    function test_constructor_setsImmutables() public view {
        assertEq(address(policy.hub()), address(hub));
        assertEq(address(policy.activity()), address(activity));
    }

    // ── fuzz ───────────────────────────────────────────────────────────────

    function testFuzz_beforeMint_humanAndPaid_passes(address buyer) public {
        vm.assume(buyer != address(0));
        hub.setHuman(buyer, true);
        activity.setPaid(buyer, true);

        bool ok = policy.beforeMintPolicy(buyer, address(0xBEEF), _ids(buyer), _amounts(1), "");
        assertTrue(ok);
    }

    function testFuzz_beforeMint_neverPaid_reverts(address buyer) public {
        vm.assume(buyer != address(0));
        hub.setHuman(buyer, true);
        activity.setPaid(buyer, false);

        vm.expectRevert(abi.encodeWithSelector(OpenMintPolicy.CollateralNotActiveBuyer.selector, buyer));
        policy.beforeMintPolicy(buyer, address(0xBEEF), _ids(buyer), _amounts(1), "");
    }
}
