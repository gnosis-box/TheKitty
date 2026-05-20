// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {KittyFactory, IBaseGroupFactory} from "../src/KittyFactory.sol";

/// @notice Deploys the singleton `KittyFactory` on Gnosis Chain. Run once.
///         The factory address is the one the frontend uses to spin up new
///         kitties via a single transaction (see VITE_KITTY_FACTORY).
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url $GNOSIS_RPC \
///     --broadcast \
///     --verify
///
/// Env vars expected:
///   PRIVATE_KEY            deployer EOA key
///   HUB_ADDRESS            Circles V2 Hub on Gnosis (default in .env.example)
///   BASE_GROUP_FACTORY     Circles V2 BaseGroupFactory on Gnosis
contract Deploy is Script {
    function run() external returns (KittyFactory factory) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address hub = vm.envAddress("HUB_ADDRESS");
        address baseGroupFactory = vm.envAddress("BASE_GROUP_FACTORY");

        vm.startBroadcast(pk);
        factory = new KittyFactory(IBaseGroupFactory(baseGroupFactory), hub);
        vm.stopBroadcast();

        console2.log("KittyFactory deployed at:", address(factory));
        console2.log("  hub:               ", hub);
        console2.log("  baseGroupFactory:  ", baseGroupFactory);
    }
}
