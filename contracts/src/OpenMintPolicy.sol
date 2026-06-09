// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

/// @dev Minimal IMintPolicy interface mirroring circles-contracts-v2 beta.
///      Kept inline so we don't pull the full Circles V2 contracts as a
///      dependency just for one interface.
interface IMintPolicy {
    function beforeMintPolicy(
        address minter,
        address group,
        uint256[] calldata collateral,
        uint256[] calldata amounts,
        bytes calldata data
    ) external returns (bool);

    function beforeRedeemPolicy(
        address operator,
        address redeemer,
        address group,
        uint256 value,
        bytes calldata data
    )
        external
        returns (
            uint256[] memory redemptionIds,
            uint256[] memory redemptionValues,
            uint256[] memory burnIds,
            uint256[] memory burnValues
        );

    function beforeBurnPolicy(address burner, address group, uint256 value, bytes calldata data)
        external
        returns (bool);
}

interface IHubV2 {
    function isHuman(address avatar) external view returns (bool);
}

interface IBuyerActivity {
    function hasPaid(address buyer) external view returns (bool);
}

/// @dev Mirror of BaseMintPolicyDefinitions.BaseRedemptionPolicy from the
///      Circles V2 contracts. The standard treasury encodes redemption
///      requests in this shape so any policy can forward them.
library OpenMintPolicyDefinitions {
    struct BaseRedemptionPolicy {
        uint256[] redemptionIds;
        uint256[] redemptionValues;
    }
}

/// @title  OpenMintPolicy
/// @notice Mint policy for the Kitty reward pool's group avatar. Accepts
///         collateral from **any** Circles V2 human that has already paid
///         at least one service tracked by `BuyerActivity`. Replaces the
///         standard `baseGroupMintPolicy` per-buyer trust gate with an
///         activity-based filter so the pool scales without an operator
///         curating membership.
///
/// @dev    The policy is intentionally generic — `_group` is not validated
///         so anyone can attach this policy to their own group avatar at
///         their discretion. The sybil-resistance comes from the
///         intersection of two checks:
///
///         1. `Hub.isHuman(collateral)` — the collateral provider passed
///            the Circles V2 humanity attestation chain.
///         2. `BuyerActivity.hasPaid(collateral)` — the collateral
///            provider has actually moved CRC to a registered service
///            provider at least once (real economic activity).
///
///         The redeem path forwards the caller's requested collateral
///         allocation to the standard treasury, mirroring the canonical
///         `MintPolicy` reference impl. Burn is unconditionally allowed.
contract OpenMintPolicy is IMintPolicy {
    IHubV2 public immutable hub;
    IBuyerActivity public immutable activity;

    error CollateralNotHuman(address avatar);
    error CollateralNotActiveBuyer(address avatar);
    error EmptyCollateral();
    error LengthMismatch();

    constructor(address hubV2, address buyerActivity) {
        hub = IHubV2(hubV2);
        activity = IBuyerActivity(buyerActivity);
    }

    /// @notice Reverts (instead of returning false) so the caller gets a
    ///         clear error reason in the host wallet UI. The Hub treats a
    ///         revert and a false return identically (the mint fails),
    ///         but a custom error gives the front a stable code to map
    ///         to a user-facing message.
    function beforeMintPolicy(
        address, /*_minter*/
        address, /*_group*/
        uint256[] calldata _collateral,
        uint256[] calldata _amounts,
        bytes calldata /*_data*/
    ) external view override returns (bool) {
        uint256 n = _collateral.length;
        if (n == 0) revert EmptyCollateral();
        if (_amounts.length != n) revert LengthMismatch();

        for (uint256 i; i < n; ++i) {
            // Personal CRC token id = uint256(uint160(avatar)). Group / org
            // collateral would have higher bits set by the Hub when issuing
            // a non-personal id, but for our pool only personal CRC is
            // valid, so we reject anything whose top bits are non-zero.
            uint256 id = _collateral[i];
            if (id > type(uint160).max) revert CollateralNotHuman(address(0));

            address avatar = address(uint160(id));
            if (!hub.isHuman(avatar)) revert CollateralNotHuman(avatar);
            if (!activity.hasPaid(avatar)) revert CollateralNotActiveBuyer(avatar);
        }
        return true;
    }

    /// @notice Forwards the caller's requested redemption allocation to the
    ///         treasury. Mirrors the canonical `MintPolicy.beforeRedeemPolicy`
    ///         from circles-contracts-v2.
    function beforeRedeemPolicy(
        address, /*_operator*/
        address, /*_redeemer*/
        address, /*_group*/
        uint256, /*_value*/
        bytes calldata _data
    )
        external
        pure
        override
        returns (
            uint256[] memory _ids,
            uint256[] memory _values,
            uint256[] memory _burnIds,
            uint256[] memory _burnValues
        )
    {
        OpenMintPolicyDefinitions.BaseRedemptionPolicy memory redemption =
            abi.decode(_data, (OpenMintPolicyDefinitions.BaseRedemptionPolicy));

        _burnIds = new uint256[](0);
        _burnValues = new uint256[](0);

        return (redemption.redemptionIds, redemption.redemptionValues, _burnIds, _burnValues);
    }

    /// @notice Burn is always allowed (no eligibility gate on exits — once
    ///         a buyer is in, they can leave at will).
    function beforeBurnPolicy(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bool)
    {
        return true;
    }
}
