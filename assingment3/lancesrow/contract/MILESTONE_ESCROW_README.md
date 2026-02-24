# Milestone Payment Contract (Escrow v2)

A secure, milestone-based payment system for freelance work built on Ethereum. This system uses a factory pattern to create individual escrow contracts for each job.

## 📋 Overview

### The Problem
Traditional escrow systems release all funds at once, creating risk for both parties. Clients want assurance work is completed before paying, while freelancers need protection against non-payment.

### The Solution
**Milestone-based payments** where:
- Client funds the full amount upfront (held in escrow)
- Work is divided into milestones
- Payment is released incrementally as each milestone is completed and approved
- Built-in timeout protection if client becomes unresponsive

---

## 🏗️ Architecture

### Factory Pattern
The system uses two contracts:

1. **MilestoneEscrowFactory** (deployed once)
   - Creates new escrow contracts
   - Tracks all escrows
   - Provides discovery functions

2. **MilestoneEscrow** (one per job)
   - Manages a single job's milestones
   - Holds funds in escrow
   - Releases payments upon approval

### Why Factory Pattern?

✅ **Centralized Tracking**: All jobs registered in one place  
✅ **Easy Discovery**: Find all your jobs (client or freelancer)  
✅ **Gas Efficiency**: Reuse deployment logic  
✅ **Scalability**: Create unlimited escrows  
✅ **Analytics**: Track total jobs, volume, etc.

---

## 🔑 Key Features

### 1. Milestone-Based Payments
- Divide work into discrete milestones
- Each milestone has equal payment
- Incremental fund release reduces risk

### 2. Dispute Resolution via Timeout
**Problem**: What if client disappears after milestone submission?  
**Solution**: 7-day automatic approval timeout
- Freelancer submits milestone
- Client has 7 days to approve/reject
- After 7 days, freelancer can claim payment automatically

### 3. Double Payment Prevention
- State machine tracking (Pending → Submitted → Approved)
- Boolean `paid` flag per milestone
- Checks before every payment release

### 4. Cancellation Protection
- Either party can cancel BEFORE any payments
- Cannot cancel after first milestone is paid
- Remaining funds returned to client on cancellation

---

## 📝 Contract Details

### MilestoneEscrow.sol

**State Variables:**
```solidity
address public immutable client;           // Who pays
address public immutable freelancer;       // Who works
uint256 public immutable totalMilestones;  // Number of milestones
uint256 public immutable paymentPerMilestone; // ETH per milestone
uint256 public milestonesPaid;             // Counter
bool public isFunded;                      // Funding status
bool public isCancelled;                   // Cancellation status
```

**Key Functions:**

| Function | Who Can Call | Purpose |
|----------|-------------|---------|
| `fundContract()` | Client | Fund escrow with total payment |
| `submitMilestone(index)` | Freelancer | Mark milestone complete |
| `approveMilestone(index)` | Client | Approve and release payment |
| `claimMilestoneAfterTimeout(index)` | Freelancer | Claim after 7 days |
| `cancelJob()` | Both | Cancel before payments start |

**Milestone States:**
- `Pending` (0): Initial state
- `Submitted` (1): Freelancer marked complete
- `Approved` (2): Client approved, payment released
- `Disputed` (3): Reserved for future use

### MilestoneEscrowFactory.sol

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `createEscrow(...)` | Create new escrow (client funds separately) |
| `createAndFundEscrow(...)` | Create and fund in one transaction |
| `getAllEscrows()` | Get all created escrows |
| `getUserEscrows(address)` | Get escrows for specific user |
| `verifyEscrow(address)` | Check if escrow is from this factory |

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Compile Contracts
```bash
npx hardhat compile
```

### 3. Run Tests
```bash
npx hardhat test
```

### 4. Deploy to Local Network
```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy factory
npx hardhat ignition deploy ignition/modules/MilestoneEscrowFactory.ts --network localhost
```

### 5. Deploy to Testnet (Sepolia)
```bash
# Set environment variables
export SEPOLIA_RPC_URL="your-rpc-url"
export SEPOLIA_PRIVATE_KEY="your-private-key"

# Deploy
npx hardhat ignition deploy ignition/modules/MilestoneEscrowFactory.ts --network sepolia
```

---

## 💡 Usage Example

### Scenario
- **Client**: Alice wants a website built
- **Freelancer**: Bob will build it
- **Agreement**: 3 milestones, 1 ETH each (3 ETH total)

### Step-by-Step Flow

```javascript
// 1. Alice creates and funds escrow
const tx = await factory.connect(alice).createAndFundEscrow(
  bob.address,           // freelancer
  3,                     // totalMilestones
  ethers.parseEther("1"), // paymentPerMilestone
  { value: ethers.parseEther("3") } // total funding
);

// Get escrow address from event
const receipt = await tx.wait();
const escrowAddress = receipt.logs[0].args.escrowAddress;
const escrow = await ethers.getContractAt("MilestoneEscrow", escrowAddress);

// 2. Bob completes milestone 1 and submits
await escrow.connect(bob).submitMilestone(0);

// 3. Alice reviews and approves
await escrow.connect(alice).approveMilestone(0);
// Bob receives 1 ETH

// 4. Bob completes milestone 2 and submits
await escrow.connect(bob).submitMilestone(1);

// 5. Alice doesn't respond... Bob waits 7 days
await time.increase(7 * 24 * 60 * 60);

// 6. Bob claims payment after timeout
await escrow.connect(bob).claimMilestoneAfterTimeout(1);
// Bob receives 1 ETH

// 7. Bob completes final milestone
await escrow.connect(bob).submitMilestone(2);
await escrow.connect(alice).approveMilestone(2);
// Bob receives 1 ETH
// Job complete! 🎉
```

---

## 🛡️ Security Features

### 1. Reentrancy Protection
- State updates BEFORE external calls
- Follows checks-effects-interactions pattern

### 2. Access Control
- `onlyClient` and `onlyFreelancer` modifiers
- Immutable addresses (cannot be changed)

### 3. Double Payment Prevention
```solidity
if (milestone.paid) revert MilestoneAlreadyPaid();
milestone.paid = true; // Set BEFORE transfer
```

### 4. Input Validation
- Milestone index bounds checking
- State validation before actions
- Funding amount verification

---

## ❓ Thought Questions Answered

### Q1: What happens if the client disappears?
**Answer**: Timeout mechanism protects freelancer
- After submitting milestone, freelancer waits 7 days
- If client doesn't respond, freelancer can claim payment automatically
- Uses `claimMilestoneAfterTimeout()` function

### Q2: Should the freelancer be able to cancel?
**Answer**: Yes, but with restrictions
- Both parties can cancel BEFORE any payments
- Cannot cancel after first milestone is paid
- Protects both parties from commitment issues early on
- Prevents client from canceling after work is done

### Q3: How do you prevent double payments?
**Answer**: Multiple safeguards
1. **State Machine**: Milestone must be in `Submitted` state
2. **Boolean Flag**: `milestone.paid` must be false
3. **Counter**: `milestonesPaid` tracks total paid
4. **State Update First**: Set `paid = true` BEFORE transfer

```solidity
// All these checks prevent double payment
if (milestone.state != MilestoneState.Submitted) revert;
if (milestone.paid) revert MilestoneAlreadyPaid();

milestone.paid = true;  // Update state FIRST
milestonesPaid++;       // Increment counter

// THEN transfer
(bool success, ) = freelancer.call{value: paymentPerMilestone}("");
```

---

## 🧪 Testing

### Test Coverage
- ✅ Deployment and initialization
- ✅ Funding (correct/incorrect amounts, authorization)
- ✅ Milestone submission (authorization, validation)
- ✅ Milestone approval (payment release, double payment prevention)
- ✅ Timeout mechanism (claim after 7 days)
- ✅ Cancellation (before/after payments)
- ✅ Factory creation and tracking
- ✅ Job completion detection

### Run Tests
```bash
# All tests
npx hardhat test

# Specific test file
npx hardhat test test/MilestoneEscrow.ts

# With gas reporting
REPORT_GAS=true npx hardhat test
```

---

## 📊 Gas Estimates

Approximate gas costs (will vary by network):

| Operation | Gas Cost |
|-----------|----------|
| Deploy Factory | ~1,200,000 |
| Create Escrow | ~800,000 |
| Fund Contract | ~50,000 |
| Submit Milestone | ~60,000 |
| Approve Milestone | ~80,000 |
| Cancel Job | ~50,000 |

---

## 🔮 Future Enhancements

Potential improvements for v3:

1. **Dispute Resolution**
   - Add arbitrator role
   - Implement dispute state
   - Multi-sig approval option

2. **Flexible Payments**
   - Variable payment per milestone
   - Partial payments
   - Bonus milestones

3. **ERC20 Support**
   - Accept stablecoins (USDC, DAI)
   - Multi-token payments

4. **Reputation System**
   - Track completion rates
   - Rating system
   - On-chain reviews

5. **Advanced Features**
   - Milestone descriptions (IPFS)
   - Deadline enforcement
   - Automatic penalties

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

---

## 📞 Support

For questions or issues:
- Open a GitHub issue
- Review the test files for usage examples
- Check contract comments for detailed documentation

---

## ⚠️ Disclaimer

This is educational/demonstration code. Before using in production:
- Complete professional security audit
- Add comprehensive error handling
- Implement additional safeguards
- Test extensively on testnets
- Consider legal implications in your jurisdiction

---

**Built with ❤️ for secure freelance payments**
