import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("MilestoneEscrowFactory", function () {
    let factory: any;
    let client: any;
    let freelancer: any;
    let other: any;

    const TOTAL_MILESTONES = 3;
    const PAYMENT_PER_MILESTONE = ethers.parseEther("1.0");
    const TOTAL_PAYMENT = PAYMENT_PER_MILESTONE * BigInt(TOTAL_MILESTONES);

    beforeEach(async function () {
        [client, freelancer, other] = await ethers.getSigners();

        const MilestoneEscrowFactory = await ethers.getContractFactory("MilestoneEscrowFactory");
        factory = await MilestoneEscrowFactory.deploy();
    });

    describe("Escrow Creation", function () {
        it("Should create a new escrow contract", async function () {
            const tx = await factory.connect(client).createEscrow(
                freelancer.address,
                TOTAL_MILESTONES,
                PAYMENT_PER_MILESTONE
            );

            await expect(tx).to.emit(factory, "EscrowCreated");

            const escrows = await factory.getAllEscrows();
            expect(escrows.length).to.equal(1);
        });

        it("Should track escrows for both client and freelancer", async function () {
            await factory.connect(client).createEscrow(
                freelancer.address,
                TOTAL_MILESTONES,
                PAYMENT_PER_MILESTONE
            );

            const clientEscrows = await factory.getUserEscrows(client.address);
            const freelancerEscrows = await factory.getUserEscrows(freelancer.address);

            expect(clientEscrows.length).to.equal(1);
            expect(freelancerEscrows.length).to.equal(1);
            expect(clientEscrows[0]).to.equal(freelancerEscrows[0]);
        });

        it("Should verify escrow was created by factory", async function () {
            const tx = await factory.connect(client).createEscrow(
                freelancer.address,
                TOTAL_MILESTONES,
                PAYMENT_PER_MILESTONE
            );
            const receipt = await tx.wait();

            const event = receipt.logs.find((log: any) => {
                try {
                    return factory.interface.parseLog(log)?.name === "EscrowCreated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = factory.interface.parseLog(event);
            const escrowAddress = parsedEvent?.args[0];

            expect(await factory.verifyEscrow(escrowAddress)).to.equal(true);
            expect(await factory.verifyEscrow(other.address)).to.equal(false);
        });
    });

    describe("Create and Fund", function () {
        it("Should create and fund escrow in one transaction", async function () {
            const tx = await factory.connect(client).createAndFundEscrow(
                freelancer.address,
                TOTAL_MILESTONES,
                PAYMENT_PER_MILESTONE,
                { value: TOTAL_PAYMENT }
            );

            await expect(tx).to.emit(factory, "EscrowCreated");

            const escrows = await factory.getAllEscrows();
            const MilestoneEscrow = await ethers.getContractFactory("MilestoneEscrow");
            const escrow = MilestoneEscrow.attach(escrows[0]);

            expect(await escrow.isFunded()).to.equal(true);
        });

        it("Should reject incorrect funding amount", async function () {
            const incorrectAmount = PAYMENT_PER_MILESTONE * BigInt(2);
            await expect(
                factory.connect(client).createAndFundEscrow(
                    freelancer.address,
                    TOTAL_MILESTONES,
                    PAYMENT_PER_MILESTONE,
                    { value: incorrectAmount }
                )
            ).to.be.revertedWith("Incorrect funding amount");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            // Create multiple escrows
            await factory.connect(client).createEscrow(
                freelancer.address,
                TOTAL_MILESTONES,
                PAYMENT_PER_MILESTONE
            );
            await factory.connect(client).createEscrow(
                other.address,
                2,
                PAYMENT_PER_MILESTONE
            );
            await factory.connect(other).createEscrow(
                freelancer.address,
                1,
                PAYMENT_PER_MILESTONE
            );
        });

        it("Should return correct escrow count", async function () {
            expect(await factory.getEscrowCount()).to.equal(3);
        });

        it("Should return correct user escrow count", async function () {
            expect(await factory.getUserEscrowCount(client.address)).to.equal(2);
            expect(await factory.getUserEscrowCount(freelancer.address)).to.equal(2);
            expect(await factory.getUserEscrowCount(other.address)).to.equal(2);
        });

        it("Should return all escrows", async function () {
            const allEscrows = await factory.getAllEscrows();
            expect(allEscrows.length).to.equal(3);
        });

        it("Should return user-specific escrows", async function () {
            const clientEscrows = await factory.getUserEscrows(client.address);
            expect(clientEscrows.length).to.equal(2);

            const freelancerEscrows = await factory.getUserEscrows(freelancer.address);
            expect(freelancerEscrows.length).to.equal(2);
        });
    });
});
