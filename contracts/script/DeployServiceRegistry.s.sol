// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";

/// @notice Deploys the singleton `ServiceRegistry` on Gnosis Chain.
///         Independent of `KittyFactory` so we can ship cycle 3 without
///         redeploying the kitty contracts.
///
/// Usage:
///   forge script script/DeployServiceRegistry.s.sol \
///     --rpc-url $GNOSIS_RPC \
///     --broadcast \
///     --verify
///
/// Env vars expected:
///   PRIVATE_KEY   deployer EOA key
contract DeployServiceRegistry is Script {
    function run() external returns (ServiceRegistry registry) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        registry = new ServiceRegistry();
        vm.stopBroadcast();

        console2.log("ServiceRegistry deployed at:", address(registry));
    }
}
