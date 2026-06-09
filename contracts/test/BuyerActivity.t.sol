// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import {BuyerActivity} from "../src/BuyerActivity.sol";

contract BuyerActivityTest is Test {
    BuyerActivity activity;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    event MarkedPaid(address indexed buyer, uint64 at);

    function setUp() public {
        activity = new BuyerActivity();
    }

    function test_initialState_neverPaid() public view {
        assertFalse(activity.hasPaid(alice));
        assertEq(activity.firstPaidAt(alice), 0);
    }

    function test_markPaid_setsFirstPaidAt_andHasPaid() public {
        vm.warp(1_000_000);
        vm.prank(alice);
        activity.markPaid();

        assertTrue(activity.hasPaid(alice));
        assertEq(activity.firstPaidAt(alice), 1_000_000);
    }

    function test_markPaid_emitsEvent_onFirstCallOnly() public {
        vm.warp(1_000_000);

        vm.expectEmit(true, false, false, true);
        emit MarkedPaid(alice, 1_000_000);
        vm.prank(alice);
        activity.markPaid();

        // Second call — must NOT emit.
        vm.warp(2_000_000);
        vm.recordLogs();
        vm.prank(alice);
        activity.markPaid();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 0, "second markPaid must not emit");
    }

    function test_markPaid_isIdempotent_firstPaidAtSticks() public {
        vm.warp(1_000_000);
        vm.prank(alice);
        activity.markPaid();

        vm.warp(2_000_000);
        vm.prank(alice);
        activity.markPaid();

        assertEq(activity.firstPaidAt(alice), 1_000_000, "firstPaidAt must stick to first call");
    }

    function test_markPaid_perBuyer_independent() public {
        vm.warp(1_000_000);
        vm.prank(alice);
        activity.markPaid();

        vm.warp(2_000_000);
        vm.prank(bob);
        activity.markPaid();

        assertEq(activity.firstPaidAt(alice), 1_000_000);
        assertEq(activity.firstPaidAt(bob), 2_000_000);
        assertTrue(activity.hasPaid(alice));
        assertTrue(activity.hasPaid(bob));
    }

    function testFuzz_markPaid_setsCallerOnly(address buyer, uint64 ts) public {
        vm.assume(buyer != address(0));
        vm.assume(ts > 0);
        vm.warp(ts);
        vm.prank(buyer);
        activity.markPaid();

        assertEq(activity.firstPaidAt(buyer), ts);
        assertTrue(activity.hasPaid(buyer));
    }
}
