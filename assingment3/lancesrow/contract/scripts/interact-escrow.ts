import { ethers } from "hardhat";

/**
 * Example script to interact with deployed MilestoneEscrow contracts
 * 
 * Usage:
 * 1. Deploy factory first
 * 2. Update FACTORY_ADDRESS below
 * 3. Run: npx hardhat run scripts/interact-escrow.ts --network localhost
 */

async function main() {
    // Get signers
    const [client, freelancer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("Milestone Escrow Interaction Script");
    console.log("=".repeat(60));
    console.log(`Client address: ${client.address}`);
    console.log(`Freelancer address: ${freelancer.address}`);
    console.log();

    // Deploy factory (or use existing address)
    console.log("📦 Deploying MilestoneEscrowFactory...");
    const MilestoneEscrowFactory = await ethers.getContractFactory("MilestoneEscrowFactory");
    const factory = await MilestoneEscrowFactory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`✅ Factory deployed at: ${factoryAddress}`);
    console.log();

    // Job parameters
    const TOTAL_MILESTONES = 3;
    const PAYMENT_PER_MILESTONE = ethers.parseEther("0.1"); // 0.1 ETH per milestone
    const TOTAL_PAYMENT = PAYMENT_PER_MILESTONE * BigInt(TOTAL_MILESTONES);

    console.log("📋 Job Parameters:");
    console.log(`   Total Milestones: ${TOTAL_MILESTONES}`);
    console.log(`   Payment per Milestone: ${ethers.formatEther(PAYMENT_PER_MILESTONE)} ETH`);
    console.log(`   Total Payment: ${ethers.formatEther(TOTAL_PAYMENT)} ETH`);
    console.log();

    // Create and fund escrow
    console.log("🏗️  Creating and funding escrow...");
    const tx = await factory.connect(client).createAndFundEscrow(
        freelancer.address,
        TOTAL_MILESTONES,
        PAYMENT_PER_MILESTONE,
        { value: TOTAL_PAYMENT }
    );
    const receipt = await tx.wait();

    // Get escrow address from event
    const event = receipt?.logs.find((log: any) => {
        try {
            return factory.interface.parseLog(log)?.name === "EscrowCreated";
        } catch {
            return false;
        }
    });
    const parsedEvent = factory.interface.parseLog(event!);
    const escrowAddress = parsedEvent?.args[0];

    console.log(`✅ Escrow created and funded at: ${escrowAddress}`);
    console.log();

    // Get escrow contract instance
    const MilestoneEscrow = await ethers.getContractFactory("MilestoneEscrow");
    const escrow = MilestoneEscrow.attach(escrowAddress);

    // Check escrow status
    console.log("📊 Escrow Status:");
    console.log(`   Funded: ${await escrow.isFunded()}`);
    console.log(`   Milestones Paid: ${await escrow.milestonesPaid()}/${await escrow.totalMilestones()}`);
    console.log(`   Balance: ${ethers.formatEther(await ethers.provider.getBalance(escrowAddress))} ETH`);
    console.log();

    // Milestone 1: Submit and Approve
    console.log("🎯 Milestone 1:");
    console.log("   Freelancer submitting milestone 0...");
    await escrow.connect(freelancer).submitMilestone(0);
    console.log("   ✅ Milestone 0 submitted");

    const freelancerBalanceBefore = await ethers.provider.getBalance(freelancer.address);
    console.log("   Client approving milestone 0...");
    await escrow.connect(client).approveMilestone(0);
    const freelancerBalanceAfter = await ethers.provider.getBalance(freelancer.address);
    const payment = freelancerBalanceAfter - freelancerBalanceBefore;
    console.log(`   ✅ Milestone 0 approved - Freelancer received ${ethers.formatEther(payment)} ETH`);
    console.log();

    // Milestone 2: Submit and Approve
    console.log("🎯 Milestone 2:");
    console.log("   Freelancer submitting milestone 1...");
    await escrow.connect(freelancer).submitMilestone(1);
    console.log("   ✅ Milestone 1 submitted");

    console.log("   Client approving milestone 1...");
    await escrow.connect(client).approveMilestone(1);
    console.log("   ✅ Milestone 1 approved");
    console.log();

    // Milestone 3: Submit and Approve
    console.log("🎯 Milestone 3 (Final):");
    console.log("   Freelancer submitting milestone 2...");
    await escrow.connect(freelancer).submitMilestone(2);
    console.log("   ✅ Milestone 2 submitted");

    console.log("   Client approving milestone 2...");
    await escrow.connect(client).approveMilestone(2);
    console.log("   ✅ Milestone 2 approved");
    console.log();

    // Final status
    console.log("🎉 Job Complete!");
    console.log("📊 Final Status:");
    console.log(`   Job Complete: ${await escrow.isJobComplete()}`);
    console.log(`   Milestones Paid: ${await escrow.milestonesPaid()}/${await escrow.totalMilestones()}`);
    console.log(`   Escrow Balance: ${ethers.formatEther(await ethers.provider.getBalance(escrowAddress))} ETH`);
    console.log();

    // Factory stats
    console.log("📈 Factory Statistics:");
    console.log(`   Total Escrows Created: ${await factory.getEscrowCount()}`);
    console.log(`   Client's Escrows: ${await factory.getUserEscrowCount(client.address)}`);
    console.log(`   Freelancer's Escrows: ${await factory.getUserEscrowCount(freelancer.address)}`);
    console.log();

    console.log("=".repeat(60));
    console.log("✅ All operations completed successfully!");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
