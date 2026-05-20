// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {KittyFactory, IBaseGroupFactory} from "../src/KittyFactory.sol";
import {KittyGovernance} from "../src/KittyGovernance.sol";

/// @dev MockBaseGroupFactory mints a fresh MockBaseGroup with the factory as
///      owner, and returns its address. Mirrors the surface of Circles V2's
///      official BaseGroupFactory closely enough to exercise our KittyFactory.
contract MockBaseGroupFactory is IBaseGroupFactory {
    event Created(address group, address owner);

    function createBaseGroup(
        address _owner,
        address /* _service */,
        address /* _feeCollection */,
        address[] calldata /* _initialConditions */,
        string calldata /* _name */,
        string calldata /* _symbol */,
        bytes32 /* _metadataDigest */
    ) external override returns (address group, address mintHandler, address treasury) {
        MockBaseGroup g = new MockBaseGroup(_owner);
        emit Created(address(g), _owner);
        return (address(g), address(g), address(g));
    }
}

contract MockBaseGroup {
    address public owner;
    address[] public trusted;
    uint96 public lastExpiry;

    error OnlyOwner();

    constructor(address _owner) {
        owner = _owner;
    }

    function trustBatchWithConditions(address[] calldata members, uint96 expiry) external {
        if (msg.sender != owner) revert OnlyOwner();
        lastExpiry = expiry;
        for (uint256 i = 0; i < members.length; i++) {
            trusted.push(members[i]);
        }
    }

    function setOwner(address newOwner) external {
        if (msg.sender != owner) revert OnlyOwner();
        owner = newOwner;
    }

    function trustedCount() external view returns (uint256) {
        return trusted.length;
    }
}

contract MockHubLite {
    function toTokenId(address a) external pure returns (uint256) {
        return uint256(uint160(a));
    }
}

contract KittyFactoryTest is Test {
    MockBaseGroupFactory internal baseFactory;
    KittyFactory internal factory;
    MockHubLite internal hub;

    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal charlie = makeAddr("charlie");

    function setUp() public {
        baseFactory = new MockBaseGroupFactory();
        hub = new MockHubLite();
        factory = new KittyFactory(IBaseGroupFactory(address(baseFactory)), address(hub));
    }

    function _members() internal view returns (address[] memory m) {
        m = new address[](3);
        m[0] = alice;
        m[1] = bob;
        m[2] = charlie;
    }

    function test_createKitty_endToEnd() public {
        KittyFactory.GroupArgs memory g = KittyFactory.GroupArgs({
            service: address(0),
            feeCollection: creator,
            initialConditions: new address[](0),
            name: "My Kitty",
            symbol: "KTY",
            metadataDigest: bytes32(0)
        });

        address[] memory members = _members();
        KittyFactory.KittyArgs memory k = KittyFactory.KittyArgs({
            members: members,
            quorumPercent: 51,
            smallTxThreshold: 5e18,
            votingPeriod: 1 days,
            trustExpiry: type(uint96).max
        });

        vm.prank(creator);
        (address baseGroup, address governance) = factory.createKitty(g, k);

        // BaseGroup ownership ends up with the creator (we transferred it).
        assertEq(MockBaseGroup(baseGroup).owner(), creator);

        // Members were trusted from the BaseGroup with the chosen expiry.
        assertEq(MockBaseGroup(baseGroup).trustedCount(), 3);
        assertEq(MockBaseGroup(baseGroup).lastExpiry(), type(uint96).max);

        // KittyGovernance was deployed and bound to the new BaseGroup.
        KittyGovernance gov = KittyGovernance(governance);
        assertEq(gov.hub(), address(hub));
        assertEq(gov.groupAvatar(), baseGroup);
        assertEq(gov.quorumPercent(), 51);
        assertEq(gov.smallTxThreshold(), 5e18);
        assertEq(gov.votingPeriod(), 1 days);
        assertEq(gov.memberCount(), 3);
        assertTrue(gov.isMember(alice));
        assertTrue(gov.isMember(bob));
        assertTrue(gov.isMember(charlie));
    }

    function test_createKitty_emitsEvent() public {
        KittyFactory.GroupArgs memory g = KittyFactory.GroupArgs({
            service: address(0),
            feeCollection: creator,
            initialConditions: new address[](0),
            name: "My Kitty",
            symbol: "KTY",
            metadataDigest: bytes32(0)
        });

        address[] memory members = _members();
        KittyFactory.KittyArgs memory k = KittyFactory.KittyArgs({
            members: members,
            quorumPercent: 51,
            smallTxThreshold: 5e18,
            votingPeriod: 1 days,
            trustExpiry: type(uint96).max
        });

        vm.prank(creator);
        vm.recordLogs();
        factory.createKitty(g, k);

        // Last log is the KittyCreated event from the factory.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        bytes32 sig = keccak256(
            "KittyCreated(address,address,address,address[],uint8,uint128,uint32)"
        );
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == sig) {
                found = true;
                assertEq(address(uint160(uint256(logs[i].topics[1]))), creator);
                break;
            }
        }
        assertTrue(found, "KittyCreated not emitted");
    }
}
