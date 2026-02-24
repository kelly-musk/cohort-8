// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MilestoneEscrow.sol";

/**
 * @title MilestoneEscrowFactory
 * @notice Factory contract for creating and tracking MilestoneEscrow contracts
 * @dev Implements the factory pattern to deploy individual escrow contracts
 *
 * WHY USE A FACTORY?
 * 1. Centralized tracking: All escrow contracts are registered in one place
 * 2. Easy discovery: Users can find all their jobs (as client or freelancer)
 * 3. Gas efficiency: Deployment logic is reused
 * 4. Upgradability: Can deploy new versions while keeping old contracts
 * 5. Analytics: Can track total jobs, volume, etc.
 *
 * USAGE FLOW:
 * 1. Client calls createEscrow() with job parameters
 * 2. Factory deploys new MilestoneEscrow contract
 * 3. Client funds the newly created escrow
 * 4. Freelancer and client interact with the escrow directly
 * 5. Anyone can query factory to find escrows by address
 */
contract MilestoneEscrowFactory {
    // ============ State Variables ============

    /// @notice Array of all created escrow contracts
    address[] public allEscrows;

    /// @notice Maps user address to array of escrows they're involved in
    mapping(address => address[]) public userEscrows;

    /// @notice Maps escrow address to whether it was created by this factory
    mapping(address => bool) public isEscrowFromFactory;

    // ============ Events ============

    /// @notice Emitted when a new escrow contract is created
    event EscrowCreated(
        address indexed escrowAddress,
        address indexed client,
        address indexed freelancer,
        uint256 totalMilestones,
        uint256 paymentPerMilestone,
        uint256 totalValue
    );

    // ============ External Functions ============

    /**
     * @notice Creates a new MilestoneEscrow contract
     * @param freelancer Address of the freelancer
     * @param totalMilestones Number of milestones for the job
     * @param paymentPerMilestone Payment amount per milestone in wei
     * @return escrowAddress Address of the newly created escrow contract
     *
     * @dev The caller becomes the client
     * @dev Client must fund the escrow separately after creation
     */
    function createEscrow(
        address freelancer,
        uint256 totalMilestones,
        uint256 paymentPerMilestone
    ) public returns (address escrowAddress) {
        return
            _createEscrow(
                msg.sender,
                freelancer,
                totalMilestones,
                paymentPerMilestone
            );
    }

    /**
     * @notice Creates and funds an escrow in one transaction
     * @param freelancer Address of the freelancer
     * @param totalMilestones Number of milestones for the job
     * @param paymentPerMilestone Payment amount per milestone in wei
     * @return escrowAddress Address of the newly created and funded escrow
     *
     * @dev Convenience function that creates and funds in one call
     * @dev msg.value must equal totalMilestones * paymentPerMilestone
     */
    function createAndFundEscrow(
        address freelancer,
        uint256 totalMilestones,
        uint256 paymentPerMilestone
    ) external payable returns (address escrowAddress) {
        // Verify correct funding amount
        uint256 requiredAmount = totalMilestones * paymentPerMilestone;
        require(msg.value == requiredAmount, "Incorrect funding amount");

        // Create the escrow
        escrowAddress = _createEscrow(
            msg.sender,
            freelancer,
            totalMilestones,
            paymentPerMilestone
        );

        // Fund the escrow by forwarding ETH with low-level call
        (bool success, ) = escrowAddress.call{value: msg.value}(
            abi.encodeWithSignature("fundContract()")
        );
        require(success, "Funding failed");

        return escrowAddress;
    }

    // ============ Internal Functions ============

    /**
     * @notice Internal function to create a new MilestoneEscrow contract
     * @param client Address of the client
     * @param freelancer Address of the freelancer
     * @param totalMilestones Number of milestones for the job
     * @param paymentPerMilestone Payment amount per milestone in wei
     * @return escrowAddress Address of the newly created escrow contract
     */
    function _createEscrow(
        address client,
        address freelancer,
        uint256 totalMilestones,
        uint256 paymentPerMilestone
    ) internal returns (address escrowAddress) {
        // Deploy new escrow contract
        MilestoneEscrow escrow = new MilestoneEscrow(
            client,
            freelancer,
            totalMilestones,
            paymentPerMilestone
        );

        escrowAddress = address(escrow);

        // Track the escrow
        allEscrows.push(escrowAddress);
        userEscrows[client].push(escrowAddress);
        userEscrows[freelancer].push(escrowAddress);
        isEscrowFromFactory[escrowAddress] = true;

        // Emit event
        emit EscrowCreated(
            escrowAddress,
            client,
            freelancer,
            totalMilestones,
            paymentPerMilestone,
            totalMilestones * paymentPerMilestone
        );

        return escrowAddress;
    }

    // ============ View Functions ============

    /**
     * @notice Get all escrows created by this factory
     * @return Array of all escrow contract addresses
     */
    function getAllEscrows() external view returns (address[] memory) {
        return allEscrows;
    }

    /**
     * @notice Get all escrows involving a specific user (as client or freelancer)
     * @param user Address to query
     * @return Array of escrow addresses involving the user
     */
    function getUserEscrows(
        address user
    ) external view returns (address[] memory) {
        return userEscrows[user];
    }

    /**
     * @notice Get the total number of escrows created
     * @return Total count of escrows
     */
    function getEscrowCount() external view returns (uint256) {
        return allEscrows.length;
    }

    /**
     * @notice Get the number of escrows for a specific user
     * @param user Address to query
     * @return Count of escrows involving the user
     */
    function getUserEscrowCount(address user) external view returns (uint256) {
        return userEscrows[user].length;
    }

    /**
     * @notice Verify if an address is an escrow created by this factory
     * @param escrowAddress Address to check
     * @return True if the address is a factory-created escrow
     */
    function verifyEscrow(address escrowAddress) external view returns (bool) {
        return isEscrowFromFactory[escrowAddress];
    }
}
