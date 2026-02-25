import { expect } from 'chai';
import { BigNumberish, Contract } from 'ethers';
import { network } from 'hardhat';

const { ethers, networkHelpers } = await network.connect();
let TimelockV1: any;
let addr1: any;
let addr2: any;

// util functions //
const toWei = (amount: string) => ethers.parseEther(amount); // parse number to 18es

const fromWei = (amount: BigNumberish) => ethers.formatEther(amount) // format 18es to human-readable version

export const setTime = async (hours: number = 0) => await networkHelpers.time.latest() + (hours * 60 * 60)

export const setHour = async () => await networkHelpers.time.latest() + (60 * 60)

export const increaseBlockTimestamp = async (hours: number) => {
  const provider = ethers.provider
  await provider.send("evm_increaseTime", [hours * 3600]);
  await provider.send("evm_mine", []);
};

describe('TimelockV1 Test Suite', () => {
  beforeEach(async () => {
    TimelockV1 = await ethers.deployContract('TimeLockV1');
    [addr1, addr2] = await ethers.getSigners();
  });

  describe('Deployment', () => {
    it('should set default  storage values', async () => {
      let vaults = await TimelockV1.getAllVaults(addr1);
      // assert that there are no vaults
      expect(vaults.length).to.be.eq(0);

      // assert that attempt to access non-existent ID reverts
      await expect(TimelockV1.getVault(addr1, 0)).to.be.revertedWith(
        'Invalid vault ID'
      );

      // assert that attempt to access non-existent ID reverts
      await expect(TimelockV1.getVault(addr2, 0)).to.be.revertedWith(
        'Invalid vault ID'
      );
    });
  });

  describe('Transactions', () => {
    describe('Deposit Transction', () => {
      describe('Validations', () => {
        it.only('should revert attempt to deposit 0 ETH to the vault', async () => {
          let amount = '0';

          const toWeiAmount = toWei("1")
          console.log("toweii_____", toWeiAmount)

          console.log("from wei_____", fromWei(toWeiAmount))
          await expect(
            TimelockV1.connect(addr1).deposit(0, { value: toWei(amount)})
          ).to.be.revertedWith('Deposit must be greater than zero');
        });

        it('should revert attempt to set unlock time that is past', async () => {
          let amount = '2';
          let pastTime = 1771933663
          await expect(
            TimelockV1.connect(addr1).deposit(pastTime, { value: toWei(amount)})
          ).to.be.revertedWith('Deposit must be greater than zero');
        });
      });

      
    });
  });
});
