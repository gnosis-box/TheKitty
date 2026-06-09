// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BuyerActivity} from "../src/BuyerActivity.sol";
import {OpenMintPolicy} from "../src/OpenMintPolicy.sol";

/// @notice Stage 1 of the cycle 5 rewards deploy. Drops `BuyerActivity`
///         and `OpenMintPolicy` on Gnosis Chain. After this script runs,
///         the user registers a pool group avatar via BaseGroupFactory
///         (passing the OpenMintPolicy address as the mint policy), then
///         runs `DeployRewardsStage2` to deploy the RewardPool wired to
///         that group.
///
/// Usage:
///   source contracts/.env && forge script script/DeployRewardsStage1.s.sol \
///     --rpc-url $GNOSIS_RPC \
///     --broadcast \
///     --verify
///
/// Env vars:
///   PRIVATE_KEY    deployer EOA key
///   HUB_V2_ADDR    Circles V2 Hub address on Gnosis Chain
///                  (defaults to 0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8)
contract DeployRewardsStage1 is Script {
    function run() external returns (BuyerActivity activity, OpenMintPolicy policy) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address hub = vm.envOr("HUB_V2_ADDR", address(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8));

        vm.startBroadcast(pk);
        activity = new BuyerActivity();
        policy = new OpenMintPolicy(hub, address(activity));
        vm.stopBroadcast();

        console2.log("BuyerActivity deployed at:", address(activity));
        console2.log("OpenMintPolicy deployed at:", address(policy));
        console2.log("");
        console2.log("Next: register a pool group avatar via BaseGroupFactory");
        console2.log("      passing the OpenMintPolicy address as the policy.");
        console2.log("      Then set POOL_GROUP_ADDR and run DeployRewardsStage2.");
    }
}
