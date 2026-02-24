# Milestone Escrow - Quick Deployment Guide

## ⚡ 5-Minute Deployment

### Prerequisites
- Node.js installed
- Hardhat project set up (already done ✅)
- ETH for gas (testnet or mainnet)

### Step 1: Compile Contracts (30 seconds)
```bash
npx hardhat compile
```

### Step 2: Run Tests (1 minute)
```bash
npx hardhat test
```

Expected output: **28 passing tests** ✅

### Step 3: Deploy to Local Network (1 minute)

**Terminal 1 - Start local node:**
```bash
npx hardhat node
```

**Terminal 2 - Deploy factory:**
```bash
npx hardhat ignition deploy ignition/modules/MilestoneEscrowFactory.ts --network localhost
```

Save the factory address from the output!

### Step 4: Deploy to Sepolia Testnet (2 minutes)

**Set environment variables:**
```bash
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
export SEPOLIA_PRIVATE_KEY="your_private_key_here"
```

**Deploy:**
```bash
npx hardhat ignition deploy ignition/modules/MilestoneEscrowFactory.ts --network sepolia
```

---

## 📝 Using the Deployed Contracts

### Create a Job (Client)

```javascript
// Connect to factory
const factory = await ethers.getContractAt(
  "MilestoneEscrowFactory",
  "FACTORY_ADDRESS_HERE"
);

// Create and fund escrow in one transaction
const tx = await factory.createAndFundEscrow(
  "0xFreelancerAddress",  // freelancer address
  3,                       // number of milestones
  ethers.parseEther("1"),  // 1 ETH per milestone
  { value: ethers.parseEther("3") } // total: 3 ETH
);

const receipt = await tx.wait();
console.log("Escrow created at:", receipt.logs[0].args.escrowAddress);
```

### Submit Milestone (Freelancer)

```javascript
const escrow = await ethers.getContractAt(
  "MilestoneEscrow",
  "ESCROW_ADDRESS_HERE"
);

await escrow.submitMilestone(0); // Submit milestone 0
```

### Approve Milestone (Client)

```javascript
await escrow.approveMilestone(0); // Approve and release payment
```

---

## 🔍 Verify Contracts on Etherscan

After deployment to testnet/mainnet:

```bash
npx hardhat verify --network sepolia FACTORY_ADDRESS
```

---

## 📊 Contract Addresses

After deployment, save these addresses:

| Network | Factory Address | Block Explorer |
|---------|----------------|----------------|
| Localhost | `0x...` | N/A |
| Sepolia | `0x...` | https://sepolia.etherscan.io |
| Mainnet | `0x...` | https://etherscan.io |

---

## 🎯 Quick Reference

### Factory Functions
- `createEscrow(freelancer, milestones, payment)` - Create escrow (fund separately)
- `createAndFundEscrow(...)` - Create and fund in one tx
- `getAllEscrows()` - Get all escrows
- `getUserEscrows(address)` - Get user's escrows

### Escrow Functions
- `fundContract()` - Client funds the escrow
- `submitMilestone(index)` - Freelancer marks complete
- `approveMilestone(index)` - Client approves and pays
- `claimMilestoneAfterTimeout(index)` - Freelancer claims after 7 days
- `cancelJob()` - Cancel before payments start

---

## ⚠️ Important Notes

1. **Gas Costs**: Deployment costs ~2M gas. Budget accordingly.
2. **Testnet First**: Always test on Sepolia before mainnet.
3. **Security**: This is demo code. Get audited before production use.
4. **Timeout**: 7-day approval timeout is hardcoded.

---

## 🐛 Troubleshooting

**"Insufficient funds"**
- Ensure wallet has enough ETH for gas + contract funding

**"Unauthorized" error**
- Check you're calling from the correct address (client or freelancer)

**"IncorrectFundingAmount"**
- Verify: `msg.value === totalMilestones * paymentPerMilestone`

**Tests failing**
- Run `npx hardhat clean` then `npx hardhat compile`

---

## 📚 Next Steps

1. ✅ Deploy factory
2. ✅ Create test escrow
3. ✅ Test full workflow
4. ✅ Verify on Etherscan
5. ✅ Build frontend (optional)

**Ready to deploy? Let's go! 🚀**
