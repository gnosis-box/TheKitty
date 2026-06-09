// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

/// @title  BuyerActivity
/// @notice Public attestation log of which Circles humans have paid at least
///         one service via the Kitty's ServiceRegistry. Used as the
///         eligibility gate for the reward pool's `OpenMintPolicy` so the
///         pool only accepts collateral from humans that have already
///         participated economically in the trust circle.
///
/// @dev    The contract holds no funds and verifies nothing on its own —
///         it is a public, self-attested boolean log. The integrity of
///         the attestation comes from the bundle layer: the PaySheet
///         always calls `markPaid()` in the same tx as a real
///         `Hub.safeTransferFrom` of CRC to a registered service
///         provider, so a buyer who attests without actually paying
///         loses CRC for nothing. The economic gradient does the
///         sybil-resistance work that an on-chain proof would do at
///         much higher complexity cost.
///
///         Idempotent after the first call: `firstPaidAt` is sticky.
contract BuyerActivity {
    /// @notice Block timestamp of the buyer's first markPaid call. 0 means
    ///         never paid. Once set, never overwritten.
    mapping(address => uint64) public firstPaidAt;

    event MarkedPaid(address indexed buyer, uint64 at);

    /// @notice Self-attest that msg.sender just paid for a service. Idempotent
    ///         after the first call — subsequent calls are no-ops (and do not
    ///         emit a duplicate event).
    function markPaid() external {
        if (firstPaidAt[msg.sender] == 0) {
            uint64 nowTs = uint64(block.timestamp);
            firstPaidAt[msg.sender] = nowTs;
            emit MarkedPaid(msg.sender, nowTs);
        }
    }

    /// @notice Cheap boolean view consumed by the OpenMintPolicy gate.
    function hasPaid(address buyer) external view returns (bool) {
        return firstPaidAt[buyer] != 0;
    }
}
