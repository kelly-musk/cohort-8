import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deployment module for MilestoneEscrowFactory
 * 
 * This deploys only the factory contract. Individual escrow contracts
 * are created through the factory's createEscrow() function.
 * 
 * Usage:
 * npx hardhat ignition deploy ignition/modules/MilestoneEscrowFactory.ts --network <network-name>
 */
const MilestoneEscrowFactoryModule = buildModule("MilestoneEscrowFactoryModule", (m) => {
    // Deploy the factory contract
    const factory = m.contract("MilestoneEscrowFactory");

    return { factory };
});

export default MilestoneEscrowFactoryModule;
