// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

/// @notice Subset of the Circles V2 Hub the policy needs to read collateral
///         balances from when deciding what to return on redeem.
interface IHubReader {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function toTokenId(address avatar) external view returns (uint256);
}

/// @title  KittyMintPolicy
/// @notice Per-kitty mint policy attached to a BaseGroup avatar. Implements the
///         three callbacks the Hub invokes during groupMint / groupRedeem /
///         groupBurn, with semantics tailored for The Kitty:
///
///         - beforeMintPolicy: permissive. Any trusted member can collateralize
///           their personal CRC into the group token, just like the standard
///           BaseGroupMintPolicy.
///
///         - beforeRedeemPolicy: returns 1:1 personal CRC of a single
///           collateral avatar that the redeemer specifies in `data`. The
///           Hub will burn `amount` group tokens from the redeemer and send
///           `amount` of the requested collateral avatar's CRC back. Lets a
///           kitty member who received a payout (e.g. from claimRound) cash
///           out into spendable personal CRC without leaving the app.
///
///         - beforeBurnPolicy: permissive. Used for clean exits where the
///           burner accepts losing the collateral value.
///
/// @dev    `data` payload for redeem:
///             abi.encode(address collateralAvatar)
///         The avatar must be one the BaseGroup vault actually holds enough
///         CRC of. The Hub itself will revert the transfer if the balance is
///         insufficient, so the policy stays simple.
contract KittyMintPolicy {
    address public immutable hub;
    address public immutable group;

    error WrongGroup();
    error InvalidRedeemData();

    constructor(address _hub, address _group) {
        hub = _hub;
        group = _group;
    }

    // ── beforeMintPolicy ────────────────────────────────────────────────────

    /// @notice Called by the Hub before a `groupMint` proceeds. Returning
    ///         true authorizes the mint; reverting blocks it. We let any
    ///         trusted member mint — the trust graph is the real auth layer.
    function beforeMintPolicy(
        address /* minter */,
        address _group,
        uint256[] calldata /* collateralAvatars */,
        uint256[] calldata /* amounts */,
        bytes calldata /* data */
    ) external view returns (bool) {
        if (_group != group) revert WrongGroup();
        return true;
    }

    // ── beforeRedeemPolicy ──────────────────────────────────────────────────

    /// @notice Called by the Hub before a `groupRedeem` proceeds. The
    ///         returned arrays tell the Hub which collateral avatars' CRC
    ///         to send to the redeemer (`ids` / `values`) and which to burn
    ///         outright (`burnIds` / `burnValues`).
    /// @dev    Decodes `data` as `abi.encode(address collateralAvatar)` and
    ///         returns a single-element payout of `amount` CRC from that
    ///         avatar. We do not burn anything — the redeemer gets full
    ///         value for the group tokens they burned.
    function beforeRedeemPolicy(
        address /* operator */,
        address /* redeemer */,
        address _group,
        uint256 amount,
        bytes calldata data
    )
        external
        view
        returns (
            uint256[] memory ids,
            uint256[] memory values,
            uint256[] memory burnIds,
            uint256[] memory burnValues
        )
    {
        if (_group != group) revert WrongGroup();
        if (data.length != 32) revert InvalidRedeemData();

        address collateralAvatar = abi.decode(data, (address));
        if (collateralAvatar == address(0)) revert InvalidRedeemData();

        ids = new uint256[](1);
        values = new uint256[](1);
        ids[0] = IHubReader(hub).toTokenId(collateralAvatar);
        values[0] = amount;

        // Nothing burned — the redeemer gets the full value.
        burnIds = new uint256[](0);
        burnValues = new uint256[](0);
    }

    // ── beforeBurnPolicy ────────────────────────────────────────────────────

    /// @notice Called by the Hub before a `groupBurn` (pure destruction with
    ///         no collateral return). Permissive: anyone with group tokens
    ///         can burn them and accept the loss.
    function beforeBurnPolicy(
        address /* burner */,
        address _group,
        uint256 /* amount */,
        bytes calldata /* data */
    ) external view returns (bool) {
        if (_group != group) revert WrongGroup();
        return true;
    }
}
