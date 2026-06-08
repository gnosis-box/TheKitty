// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";

contract ServiceRegistryTest is Test {
    ServiceRegistry internal reg;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal charlie = makeAddr("charlie");

    function setUp() public {
        reg = new ServiceRegistry();
    }

    // ── publish ─────────────────────────────────────────────────────────────

    function test_publish_recordsService() public {
        vm.prank(alice);
        uint64 id = reg.publish("Coupe de cheveux", "Salon Marseille", 24e18, 60, 0);
        assertEq(id, 0);
        assertEq(reg.serviceCount(), 1);

        ServiceRegistry.Service memory s = reg.getService(0);
        assertEq(s.id, 0);
        assertEq(s.provider, alice);
        assertEq(s.title, "Coupe de cheveux");
        assertEq(s.description, "Salon Marseille");
        assertEq(s.priceCrc, 24e18);
        assertEq(s.durationMins, 60);
        assertTrue(s.active);
        assertEq(s.poolShareBps, 0);
    }

    function test_publish_incrementsIds() public {
        vm.prank(alice);
        reg.publish("A", "", 1, 0, 0);
        vm.prank(bob);
        uint64 id = reg.publish("B", "", 2, 0, 0);
        assertEq(id, 1);
        assertEq(reg.serviceCount(), 2);
    }

    function test_publish_indexesByProvider() public {
        vm.prank(alice);
        reg.publish("A", "", 1, 0, 0);
        vm.prank(alice);
        reg.publish("B", "", 2, 0, 0);
        vm.prank(bob);
        reg.publish("C", "", 3, 0, 0);

        ServiceRegistry.Service[] memory ofAlice = reg.servicesByProvider(alice);
        assertEq(ofAlice.length, 2);
        assertEq(ofAlice[0].title, "A");
        assertEq(ofAlice[1].title, "B");

        ServiceRegistry.Service[] memory ofBob = reg.servicesByProvider(bob);
        assertEq(ofBob.length, 1);
        assertEq(ofBob[0].title, "C");
    }

    function test_publish_emptyTitleReverts() public {
        vm.prank(alice);
        vm.expectRevert(ServiceRegistry.EmptyTitle.selector);
        reg.publish("", "desc", 1, 0, 0);
    }

    function test_publish_titleTooLongReverts() public {
        bytes memory big = new bytes(65);
        vm.prank(alice);
        vm.expectRevert(ServiceRegistry.TitleTooLong.selector);
        reg.publish(string(big), "", 1, 0, 0);
    }

    function test_publish_descriptionTooLongReverts() public {
        bytes memory big = new bytes(257);
        vm.prank(alice);
        vm.expectRevert(ServiceRegistry.DescriptionTooLong.selector);
        reg.publish("A", string(big), 1, 0, 0);
    }

    // ── publish · poolShareBps ──────────────────────────────────────────────

    function test_publish_storesPoolShareBps() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 24e18, 60, 500); // 5%
        assertEq(reg.getService(id).poolShareBps, 500);
    }

    function test_publish_acceptsZeroBps() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        assertEq(reg.getService(id).poolShareBps, 0);
    }

    function test_publish_acceptsMaxBps() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 2000); // 20%
        assertEq(reg.getService(id).poolShareBps, 2000);
    }

    function test_publish_tooHighBpsReverts() public {
        vm.prank(alice);
        vm.expectRevert(ServiceRegistry.PoolShareTooHigh.selector);
        reg.publish("A", "", 1, 0, 2001); // 20.01%
    }

    // ── update ──────────────────────────────────────────────────────────────

    function test_update_onlyProviderCanUpdate() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(bob);
        vm.expectRevert(ServiceRegistry.NotProvider.selector);
        reg.update(id, "A2", "", 2, 0, 0);
    }

    function test_update_appliesChanges() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "old", 1, 30, 100);
        vm.prank(alice);
        reg.update(id, "A2", "new", 9, 90, 750);
        ServiceRegistry.Service memory s = reg.getService(id);
        assertEq(s.title, "A2");
        assertEq(s.description, "new");
        assertEq(s.priceCrc, 9);
        assertEq(s.durationMins, 90);
        assertEq(s.poolShareBps, 750);
    }

    function test_update_onDeactivatedReverts() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(alice);
        reg.deactivate(id);
        vm.prank(alice);
        vm.expectRevert(ServiceRegistry.ServiceInactive.selector);
        reg.update(id, "A2", "", 2, 0, 0);
    }

    function test_update_unknownIdReverts() public {
        vm.prank(alice);
        vm.expectRevert(ServiceRegistry.ServiceNotFound.selector);
        reg.update(42, "A", "", 1, 0, 0);
    }

    function test_update_tooHighBpsReverts() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(alice);
        vm.expectRevert(ServiceRegistry.PoolShareTooHigh.selector);
        reg.update(id, "A", "", 1, 0, 2001);
    }

    // ── deactivate ──────────────────────────────────────────────────────────

    function test_deactivate_flipsActive() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(alice);
        reg.deactivate(id);
        assertFalse(reg.getService(id).active);
    }

    function test_deactivate_onlyProvider() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(bob);
        vm.expectRevert(ServiceRegistry.NotProvider.selector);
        reg.deactivate(id);
    }

    function test_activeServicesByProvider_filters() public {
        vm.prank(alice);
        reg.publish("A", "", 1, 0, 0);
        vm.prank(alice);
        uint64 b = reg.publish("B", "", 2, 0, 0);
        vm.prank(alice);
        reg.publish("C", "", 3, 0, 0);
        vm.prank(alice);
        reg.deactivate(b);

        ServiceRegistry.Service[] memory list = reg.activeServicesByProvider(alice);
        assertEq(list.length, 2);
        assertEq(list[0].title, "A");
        assertEq(list[1].title, "C");
    }

    // ── logPayment ──────────────────────────────────────────────────────────

    function test_logPayment_updatesAggregates() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 24e18, 60, 0);
        vm.prank(bob);
        reg.logPayment(id, 24e18, "coffee");
        assertEq(reg.timesPaid(id), 1);
        assertEq(reg.totalPaid(id), 24e18);

        vm.prank(charlie);
        reg.logPayment(id, 24e18, "");
        assertEq(reg.timesPaid(id), 2);
        assertEq(reg.totalPaid(id), 48e18);
    }

    function test_logPayment_unknownIdReverts() public {
        vm.prank(bob);
        vm.expectRevert(ServiceRegistry.ServiceNotFound.selector);
        reg.logPayment(99, 1, "");
    }

    function test_logPayment_memoTooLongReverts() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        bytes memory big = new bytes(257);
        vm.prank(bob);
        vm.expectRevert(ServiceRegistry.MemoTooLong.selector);
        reg.logPayment(id, 1, string(big));
    }

    function test_logPayment_succeedsEvenIfDeactivated() public {
        // Buyer paid via Hub before noticing the deactivation — log must
        // still record so the trace is consistent.
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(alice);
        reg.deactivate(id);
        vm.prank(bob);
        reg.logPayment(id, 1, "");
        assertEq(reg.timesPaid(id), 1);
    }

    // ── rate ────────────────────────────────────────────────────────────────

    function test_rate_recordsFirstRating() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(bob);
        reg.rate(id, 5);
        assertEq(reg.ratingsCount(id), 1);
        assertEq(reg.ratingsSum(id), 5);
        assertEq(reg.ratingBy(id, bob), 5);
    }

    function test_rate_multipleRatersAccumulate() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(bob);
        reg.rate(id, 4);
        vm.prank(charlie);
        reg.rate(id, 5);
        assertEq(reg.ratingsCount(id), 2);
        assertEq(reg.ratingsSum(id), 9);
    }

    function test_rate_overwritesPreviousRating() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(bob);
        reg.rate(id, 2);
        vm.prank(bob);
        reg.rate(id, 5);
        // Count stays at 1, sum is now 5 (the new value, not 7).
        assertEq(reg.ratingsCount(id), 1);
        assertEq(reg.ratingsSum(id), 5);
        assertEq(reg.ratingBy(id, bob), 5);
    }

    function test_rate_outOfRangeReverts() public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        vm.prank(bob);
        vm.expectRevert(ServiceRegistry.BadRating.selector);
        reg.rate(id, 0);
        vm.prank(bob);
        vm.expectRevert(ServiceRegistry.BadRating.selector);
        reg.rate(id, 6);
    }

    function test_rate_unknownIdReverts() public {
        vm.prank(bob);
        vm.expectRevert(ServiceRegistry.ServiceNotFound.selector);
        reg.rate(42, 5);
    }

    // ── views ───────────────────────────────────────────────────────────────

    function test_getService_unknownIdReverts() public {
        vm.expectRevert(ServiceRegistry.ServiceNotFound.selector);
        reg.getService(99);
    }

    function test_serviceIdsByProvider_emptyForUnknown() public view {
        uint64[] memory ids = reg.serviceIdsByProvider(charlie);
        assertEq(ids.length, 0);
    }

    function test_constants() public view {
        assertEq(reg.MAX_TITLE_LEN(), 64);
        assertEq(reg.MAX_DESCRIPTION_LEN(), 256);
        assertEq(reg.MAX_MEMO_LEN(), 256);
        assertEq(reg.MAX_POOL_SHARE_BPS(), 2000);
    }

    // ── fuzz ────────────────────────────────────────────────────────────────

    /// @dev Per-rater storage holds 1..5 invariant.
    function testFuzz_rate_clamps(uint8 stars) public {
        vm.prank(alice);
        uint64 id = reg.publish("A", "", 1, 0, 0);
        if (stars == 0 || stars > 5) {
            vm.prank(bob);
            vm.expectRevert(ServiceRegistry.BadRating.selector);
            reg.rate(id, stars);
        } else {
            vm.prank(bob);
            reg.rate(id, stars);
            assertEq(reg.ratingBy(id, bob), stars);
        }
    }

    /// @dev Pool share is bounded by MAX_POOL_SHARE_BPS at publish time.
    function testFuzz_publish_poolShareBpsBounded(uint16 bps) public {
        vm.prank(alice);
        if (bps > 2000) {
            vm.expectRevert(ServiceRegistry.PoolShareTooHigh.selector);
            reg.publish("A", "", 1, 0, bps);
        } else {
            uint64 id = reg.publish("A", "", 1, 0, bps);
            assertEq(reg.getService(id).poolShareBps, bps);
        }
    }
}
