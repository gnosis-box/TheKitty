// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {KittyGovernance} from "./KittyGovernance.sol";

/// @notice Minimal slice of the Circles V2 `BaseGroupFactory` we need.
///         Verified against the npm package "aboutcircles/sdk-abis" v0.1.31
///         (Gnosis chainId 100, factory deployed at
///         0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d).
interface IBaseGroupFactory {
    function createBaseGroup(
        address _owner,
        address _service,
        address _feeCollection,
        address[] calldata _initialConditions,
        string calldata _name,
        string calldata _symbol,
        bytes32 _metadataDigest
    ) external returns (address group, address mintHandler, address treasury);
}

/// @notice Minimal slice of the `BaseGroup` owner API we use during creation.
interface IBaseGroup {
    function trustBatchWithConditions(address[] calldata _members, uint96 _expiry) external;

    function setOwner(address _owner) external;
}

/// @title  KittyFactory
/// @notice One-shot factory: deploys a Circles V2 BaseGroup, deploys a
///         KittyGovernance bound to it, trusts the founding members, and hands
///         ownership of the group back to the user — all in one transaction.
///
/// @dev    The user's Safe is the `msg.sender` here. We pull a temporary
///         ownership of the BaseGroup so we can call `trustBatchWithConditions`,
///         then `setOwner(creator)` at the end so the user retains group
///         control after the call returns.
contract KittyFactory {
    IBaseGroupFactory public immutable baseGroupFactory;
    address public immutable hub;

    event KittyCreated(
        address indexed creator,
        address indexed baseGroup,
        address indexed governance,
        address[] members,
        uint8 quorumPercent,
        uint128 smallTxThreshold,
        uint32 votingPeriod
    );

    constructor(IBaseGroupFactory _baseGroupFactory, address _hub) {
        baseGroupFactory = _baseGroupFactory;
        hub = _hub;
    }

    struct GroupArgs {
        address service;
        address feeCollection;
        address[] initialConditions;
        string name;
        string symbol;
        bytes32 metadataDigest;
    }

    struct KittyArgs {
        address[] members;
        uint8 quorumPercent;
        uint128 smallTxThreshold;
        uint32 votingPeriod;
        uint96 trustExpiry;
    }

    /// @notice Create a brand-new kitty in one tx.
    /// @return baseGroup    Address of the new Circles V2 BaseGroup avatar.
    /// @return governance   Address of the deployed KittyGovernance contract.
    function createKitty(GroupArgs calldata g, KittyArgs calldata k)
        external
        returns (address baseGroup, address governance)
    {
        // 1. The factory deploys the BaseGroup with US as the temporary owner,
        //    so we can trust the members on the user's behalf.
        (baseGroup,,) = baseGroupFactory.createBaseGroup(
            address(this),
            g.service,
            g.feeCollection,
            g.initialConditions,
            g.name,
            g.symbol,
            g.metadataDigest
        );

        // 2. Trust the founding members from the BaseGroup (we're its owner).
        //    `trustExpiry` is an absolute uint96 timestamp — use type(uint96).max
        //    for "never expires".
        IBaseGroup(baseGroup).trustBatchWithConditions(k.members, k.trustExpiry);

        // 3. Deploy the KittyGovernance bound to this BaseGroup.
        governance = address(
            new KittyGovernance(
                hub,
                baseGroup,
                k.members,
                k.quorumPercent,
                k.smallTxThreshold,
                k.votingPeriod
            )
        );

        // 4. Hand BaseGroup ownership to the original creator so they can
        //    keep managing trust / metadata after the call.
        IBaseGroup(baseGroup).setOwner(msg.sender);

        emit KittyCreated(
            msg.sender,
            baseGroup,
            governance,
            k.members,
            k.quorumPercent,
            k.smallTxThreshold,
            k.votingPeriod
        );
    }
}
