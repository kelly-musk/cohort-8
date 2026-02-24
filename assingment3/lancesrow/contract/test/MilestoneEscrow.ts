import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("MilestoneEscrow", function () {
    let escrowFactory: any;
    let escrow: any;
    let client: any;
    let freelancer: any;
    let other: any;

    const TOTAL_MILESTONES = 3;
    const PAYMENT_PER_MILESTONE = ethers.parseEther("1.0"); // 1 ETH per milestone
    const TOTAL_PAYMENT = PAYMENT_PER_MILESTONE * BigInt(TOTAL_MILESTONES);

    beforeEach(async function () {
        [client, freelancer, other] = await ethers.getSigners();

        // Deploy factory
        const MilestoneEscrowFactory = await ethers.getContractFactory("MilestoneEscrowFactory");
        escrowFactory = await MilestoneEscrowFactory.deploy();

        // Create escrow through factory
        const tx = await escrowFactory.connect(client).createEscrow(
            freelancer.address,
            TOTAL_MILESTONES,
            PAYMENT_PER_MILESTONE
        );
        const receipt = await tx.wait();

        // Get escrow address from event
        const event = receipt.logs.find((log: any) => {
            try {
                return escrowFactory.interface.parseLog(log)?.name === "EscrowCreated";
            } catch {
                return false;
            }
        });
        const parsedEvent = escrowFactory.interface.parseLog(event);
        const escrowAddress = parsedEvent?.args[0];

        // Get escrow contract instance
        const MilestoneEscrow = await ethers.getContractFactory("MilestoneEscrow");
        escrow = MilestoneEscrow.attach(escrowAddress);
    });

    describe("Deployment", function () {
        it("Should set the correct client and freelancer", async function () {
            expect(await escrow.client()).to.equal(client.address);
            expect(await escrow.freelancer()).to.equal(freelancer.address);
        });

        it("Should set the correct milestone parameters", async function () {
            expect(await escrow.totalMilestones()).to.equal(TOTAL_MILESTONES);
            expect(await escrow.paymentPerMilestone()).to.equal(PAYMENT_PER_MILESTONE);
        });

        it("Should start unfunded", async function () {
            expect(await escrow.isFunded()).to.equal(false);
        });
    });

    describe("Funding", function () {
        it("Should allow client to fund with correct amount", async function () {
            await expect(
                escrow.connect(client).fundContract({ value: TOTAL_PAYMENT })
            ).to.emit(escrow, "ContractFunded").withArgs(TOTAL_PAYMENT);

            expect(await escrow.isFunded()).to.equal(true);
        });

        it("Should reject funding from non-client", async function () {
            await expect(
                escrow.connect(freelancer).fundContract({ value: TOTAL_PAYMENT })
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        it("Should reject incorrect funding amount", async function () {
            const incorrectAmount = PAYMENT_PER_MILESTONE * BigInt(2); // Only 2 milestones worth
            await expect(
                escrow.connect(client).fundContract({ value: incorrectAmount })
            ).to.be.revertedWithCustomError(escrow, "IncorrectFundingAmount");
        });

        it("Should reject double funding", async function () {
            await escrow.connect(client).fundContract({ value: TOTAL_PAYMENT });
            await expect(
                escrow.connect(client).fundContract({ value: TOTAL_PAYMENT })
            ).to.be.revertedWithCustomError(escrow, "AlreadyFunded");
        });
    });

    describe("Milestone Submission", function () {
        beforeEach(async function () {
            await escrow.connect(client).fundContract({ value: TOTAL_PAYMENT });
        });

        it("Should allow freelancer to submit milestone", async function () {
            await expect(
                escrow.connect(freelancer).submitMilestone(0)
            ).to.emit(escrow, "MilestoneSubmitted");

            const milestone = await escrow.getMilestone(0);
            expect(milestone.state).to.equal(1); // Submitted state
        });

        it("Should reject submission from non-freelancer", async function () {
            await expect(
                escrow.connect(client).submitMilestone(0)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        it("Should reject invalid milestone index", async function () {
            await expect(
                escrow.connect(freelancer).submitMilestone(99)
            ).to.be.revertedWithCustomError(escrow, "InvalidMilestone");
        });
    });

    describe("Milestone Approval", function () {
        beforeEach(async function () {
            await escrow.connect(client).fundContract({ value: TOTAL_PAYMENT });
            await escrow.connect(freelancer).submitMilestone(0);
        });

        it("Should allow client to approve milestone and release payment", async function () {
            const freelancerBalanceBefore = await ethers.provider.getBalance(freelancer.address);

            await expect(
                escrow.connect(client).approveMilestone(0)
            ).to.emit(escrow, "MilestoneApproved").withArgs(0, PAYMENT_PER_MILESTONE);

            const freelancerBalanceAfter = await ethers.provider.getBalance(freelancer.address);
            expect(freelancerBalanceAfter - freelancerBalanceBefore).to.equal(PAYMENT_PER_MILESTONE);

            const milestone = await escrow.getMilestone(0);
            expect(milestone.paid).to.equal(true);
            expect(await escrow.milestonesPaid()).to.equal(1);
        });

        it("Should emit JobCompleted when all milestones are paid", async function () {
            await escrow.connect(client).approveMilestone(0);
            await escrow.connect(freelancer).submitMilestone(1);
            await escrow.connect(client).approveMilestone(1);
            await escrow.connect(freelancer).submitMilestone(2);

            await expect(
                escrow.connect(client).approveMilestone(2)
            ).to.emit(escrow, "JobCompleted");

            expect(await escrow.isJobComplete()).to.equal(true);
        });

        it("Should prevent double payment", async function () {
            await escrow.connect(client).approveMilestone(0);
            await expect(
                escrow.connect(client).approveMilestone(0)
            ).to.be.revertedWithCustomError(escrow, "MilestoneAlreadyPaid");
        });

        it("Should reject approval from non-client", async function () {
            await expect(
                escrow.connect(freelancer).approveMilestone(0)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });
    });

    describe("Timeout Mechanism", function () {
        beforeEach(async function () {
            await escrow.connect(client).fundContract({ value: TOTAL_PAYMENT });
            await escrow.connect(freelancer).submitMilestone(0);
        });

        it("Should allow freelancer to claim after timeout", async function () {
            // Fast forward 7 days (604800 seconds)
            await ethers.provider.send("evm_increaseTime", [604800]);
            await ethers.provider.send("evm_mine", []);

            const freelancerBalanceBefore = await ethers.provider.getBalance(freelancer.address);

            const tx = await escrow.connect(freelancer).claimMilestoneAfterTimeout(0);
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const freelancerBalanceAfter = await ethers.provider.getBalance(freelancer.address);
            expect(freelancerBalanceAfter - freelancerBalanceBefore + gasUsed).to.equal(PAYMENT_PER_MILESTONE);
        });

        it("Should reject claim before timeout", async function () {
            await expect(
                escrow.connect(freelancer).claimMilestoneAfterTimeout(0)
            ).to.be.revertedWithCustomError(escrow, "TimeoutNotReached");
        });
    });

    describe("Cancellation", function () {
        beforeEach(async function () {
            await escrow.connect(client).fundContract({ value: TOTAL_PAYMENT });
        });

        it("Should allow client to cancel before any payments", async function () {
            const clientBalanceBefore = await ethers.provider.getBalance(client.address);

            const tx = await escrow.connect(client).cancelJob();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const clientBalanceAfter = await ethers.provider.getBalance(client.address);
            expect(clientBalanceAfter - clientBalanceBefore + gasUsed).to.equal(TOTAL_PAYMENT);
            expect(await escrow.isCancelled()).to.equal(true);
        });

        it("Should allow freelancer to cancel before any payments", async function () {
            await expect(
                escrow.connect(freelancer).cancelJob()
            ).to.emit(escrow, "JobCancelled");
        });

        it("Should reject cancellation after milestone payment", async function () {
            await escrow.connect(freelancer).submitMilestone(0);
            await escrow.connect(client).approveMilestone(0);

            await expect(
                escrow.connect(client).cancelJob()
            ).to.be.revertedWithCustomError(escrow, "CannotCancelWithPaidMilestones");
        });
    });
});
