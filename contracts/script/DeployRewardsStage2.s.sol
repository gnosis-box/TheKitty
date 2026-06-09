// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RewardPool} from "../src/RewardPool.sol";

/// @notice Stage 2 of the cycle 5 rewards deploy. Drops the `RewardPool`
///         which **is** the pool group avatar — its constructor calls
///         `Hub.registerGroup` so the same contract address is both the
///         Circles V2 group and the prize custodian. No `activate()` is
///         needed because Hub V2 implicit self-trust covers the
///         recipient gate when the pool receives its own group token.
///
/// Usage:
///   cd contracts && source .env && \
///   POLICY_ADDR=0x7D2a0C97324876F327281BBffFfE076Eaf3af84a \
///   BUYER_ACTIVITY_ADDR=0x99921C234d4Ca518DC58ba63ff9bfD2Cc9435f34 \
///   POOL_NAME=TheKittyPool POOL_SYMBOL=TKP \
///   forge script script/DeployRewardsStage2.s.sol \
///     --rpc-url $GNOSIS_RPC --broadcast --verify
///
/// Env vars:
///   PRIVATE_KEY          deployer EOA key
///   HUB_V2_ADDR          Circles V2 Hub on Gnosis Chain
///                        (default 0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8)
///   POLICY_ADDR          OpenMintPolicy from Stage 1
///   BUYER_ACTIVITY_ADDR  BuyerActivity from Stage 1
///   POOL_NAME            ERC20-equivalent name for the group token (default "TheKittyPool")
///   POOL_SYMBOL          ERC20-equivalent symbol (default "TKP")
///   POOL_METADATA_DIGEST optional bytes32 metadata pointer (default 0x0)
contract DeployRewardsStage2 is Script {
    function run() external returns (RewardPool pool) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address hub = vm.envOr("HUB_V2_ADDR", address(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8));
        address policy = vm.envAddress("POLICY_ADDR");
        address activity = vm.envAddress("BUYER_ACTIVITY_ADDR");
        string memory name = vm.envOr("POOL_NAME", string("TheKittyPool"));
        string memory symbol = vm.envOr("POOL_SYMBOL", string("TKP"));
        bytes32 digest = vm.envOr("POOL_METADATA_DIGEST", bytes32(0));

        vm.startBroadcast(pk);
        pool = new RewardPool(hub, policy, activity, name, symbol, digest);
        vm.stopBroadcast();

        console2.log("RewardPool deployed at:", address(pool));
        console2.log("  (this address is both the prize custodian AND the group avatar)");
        console2.log("  hub:           ", hub);
        console2.log("  policy:        ", policy);
        console2.log("  buyerActivity: ", activity);
        console2.log("  selfTokenId:   ", pool.selfTokenId());
    }
}
