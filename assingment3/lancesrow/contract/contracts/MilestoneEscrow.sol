// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MilestoneEscrow
 * @notice Escrow contract for milestone-based payments between client and freelancer
 * @dev Each job is a separate contract instance created by the factory
 *
 * KEY FEATURES:
 * - Client funds contract upfront with total payment
 * - Freelancer marks milestones as complete
 * - Client approves milestones to release payment
 * - Dispute resolution via timeout mechanism
 * - Prevents double payments through milestone state tracking
 *
 * SECURITY CONSIDERATIONS:
 * - Reentrancy protection on payment releases
 * - State validation prevents double payments
 * - Timeout mechanism protects freelancer if client disappears
 * - Only authorized parties can perform actions
 */
contract MilestoneEscrow {
    // ============ State Variables ============

    /// @notice Address of the client who created and funded the job
    address public immutable client;

    /// @notice Address of the freelancer performing the work
    address public immutable freelancer;

    /// @notice Total number of milestones in this job
    uint256 public immutable totalMilestones;

    /// @notice Payment amount per milestone in wei
    uint256 public immutable paymentPerMilestone;

    /// @notice Number of milestones that have been paid out
    uint256 public milestonesPaid;

    /// @notice Timeout period (7 days) after which freelancer can claim if client doesn't respond
    uint256 public constant APPROVAL_TIMEOUT = 7 days;

    /// @notice Tracks if the contract has been properly funded
    bool public isFunded;

    /// @notice Tracks if the job has been cancelled
    bool public isCancelled;

    // ============ Enums ============

    /// @notice Possible states for each milestone
    enum MilestoneState {
        Pending, // Initial state, work not started
        Submitted, // Freelancer marked as complete, awaiting approval
        Approved, // Client approved, payment released
        Disputed // Currently unused, reserved for future dispute mechanism
    }

    // ============ Structs ============

    /// @notice Data structure for each milestone
    struct Milestone {
        MilestoneState state; // Current state of the milestone
        uint256 submittedAt; // Timestamp when freelancer submitted
        bool paid; // Prevents double payment
    }

    // ============ Mappings ============

    /// @notice Maps milestone index to its data
    /// @dev Index starts at 0, goes to totalMilestones - 1
    mapping(uint256 => Milestone) public milestones;

    // ============ Events ============

    /// @notice Emitted when contract is funded by client
    event ContractFunded(uint256 amount);

    /// @notice Emitted when freelancer submits a milestone
    event MilestoneSubmitted(uint256 indexed milestoneIndex, uint256 timestamp);

    /// @notice Emitted when client approves a milestone and payment is released
    event MilestoneApproved(uint256 indexed milestoneIndex, uint256 payment);

    /// @notice Emitted when freelancer claims payment after timeout
    event MilestoneClaimed(uint256 indexed milestoneIndex, uint256 payment);

    /// @notice Emitted when job is cancelled and funds returned
    event JobCancelled(uint256 refundAmount);

    /// @notice Emitted when all milestones are complete
    event JobCompleted();

    // ============ Errors ============

    error Unauthorized();
    error AlreadyFunded();
    error IncorrectFundingAmount();
    error NotFunded();
    error InvalidMilestone();
    error MilestoneNotSubmitted();
    error MilestoneAlreadyPaid();
    error TimeoutNotReached();
    error JobAlreadyCancelled();
    error CannotCancelWithPaidMilestones();
    error TransferFailed();
    error JobNotComplete();

    // ============ Modifiers ============

    modifier onlyClient() {
        if (msg.sender != client) revert Unauthorized();
        _;
    }

    modifier onlyFreelancer() {
        if (msg.sender != freelancer) revert Unauthorized();
        _;
    }

    modifier whenFunded() {
        if (!isFunded) revert NotFunded();
        _;
    }

    modifier whenNotCancelled() {
        if (isCancelled) revert JobAlreadyCancelled();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Creates a new milestone-based escrow contract
     * @param _client Address of the client
     * @param _freelancer Address of the freelancer
     * @param _totalMilestones Number of milestones for this job
     * @param _paymentPerMilestone Payment amount per milestone in wei
     */
    constructor(
        address _client,
        address _freelancer,
        uint256 _totalMilestones,
        uint256 _paymentPerMilestone
    ) {
        require(_client != address(0), "Invalid client address");
        require(_freelancer != address(0), "Invalid freelancer address");
        require(
            _client != _freelancer,
            "Client and freelancer must be different"
        );
        require(_totalMilestones > 0, "Must have at least one milestone");
        require(_paymentPerMilestone > 0, "Payment must be greater than zero");

        client = _client;
        freelancer = _freelancer;
        totalMilestones = _totalMilestones;
        paymentPerMilestone = _paymentPerMilestone;
    }

    // ============ External Functions ============

    /**
     * @notice Client funds the contract with total payment amount
     * @dev Must send exactly totalMilestones * paymentPerMilestone
     */
    function fundContract() external payable {
        // Allow both client and factory to fund (factory forwards from client)
        if (msg.sender != client && !_isContract(msg.sender))
            revert Unauthorized();
        if (isFunded) revert AlreadyFunded();

        uint256 requiredAmount = totalMilestones * paymentPerMilestone;
        if (msg.value != requiredAmount) revert IncorrectFundingAmount();

        isFunded = true;
        emit ContractFunded(msg.value);
    }

    /**
     * @notice Check if an address is a contract
     * @param addr Address to check
     * @return True if address is a contract
     */
    function _isContract(address addr) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    /**
     * @notice Freelancer marks a milestone as complete
     * @param milestoneIndex Index of the milestone (0-based)
     */
    function submitMilestone(
        uint256 milestoneIndex
    ) external onlyFreelancer whenFunded whenNotCancelled {
        if (milestoneIndex >= totalMilestones) revert InvalidMilestone();

        Milestone storage milestone = milestones[milestoneIndex];
        if (milestone.paid) revert MilestoneAlreadyPaid();

        milestone.state = MilestoneState.Submitted;
        milestone.submittedAt = block.timestamp;

        emit MilestoneSubmitted(milestoneIndex, block.timestamp);
    }

    /**
     * @notice Client approves a milestone and releases payment
     * @param milestoneIndex Index of the milestone to approve
     * @dev Prevents double payment through state checks
     */
    function approveMilestone(
        uint256 milestoneIndex
    ) external onlyClient whenFunded whenNotCancelled {
        if (milestoneIndex >= totalMilestones) revert InvalidMilestone();

        Milestone storage milestone = milestones[milestoneIndex];
        if (milestone.paid) revert MilestoneAlreadyPaid();
        if (milestone.state != MilestoneState.Submitted)
            revert MilestoneNotSubmitted();

        // Update state BEFORE transfer (reentrancy protection)
        milestone.state = MilestoneState.Approved;
        milestone.paid = true;
        milestonesPaid++;

        // Transfer payment to freelancer
        (bool success, ) = freelancer.call{value: paymentPerMilestone}("");
        if (!success) revert TransferFailed();

        emit MilestoneApproved(milestoneIndex, paymentPerMilestone);

        // Check if job is complete
        if (milestonesPaid == totalMilestones) {
            emit JobCompleted();
        }
    }

    /**
     * @notice Freelancer can claim payment if client doesn't respond within timeout
     * @param milestoneIndex Index of the milestone to claim
     * @dev Protects freelancer if client disappears after milestone submission
     */
    function claimMilestoneAfterTimeout(
        uint256 milestoneIndex
    ) external onlyFreelancer whenFunded whenNotCancelled {
        if (milestoneIndex >= totalMilestones) revert InvalidMilestone();

        Milestone storage milestone = milestones[milestoneIndex];
        if (milestone.state != MilestoneState.Submitted)
            revert MilestoneNotSubmitted();
        if (milestone.paid) revert MilestoneAlreadyPaid();
        if (block.timestamp < milestone.submittedAt + APPROVAL_TIMEOUT) {
            revert TimeoutNotReached();
        }

        // Update state BEFORE transfer (reentrancy protection)
        milestone.state = MilestoneState.Approved;
        milestone.paid = true;
        milestonesPaid++;

        // Transfer payment to freelancer
        (bool success, ) = freelancer.call{value: paymentPerMilestone}("");
        if (!success) revert TransferFailed();

        emit MilestoneClaimed(milestoneIndex, paymentPerMilestone);

        // Check if job is complete
        if (milestonesPaid == totalMilestones) {
            emit JobCompleted();
        }
    }

    /**
     * @notice Cancel the job and refund remaining funds to client
     * @dev Can only cancel if no milestones have been paid yet
     * @dev Both client and freelancer can cancel before any payments
     */
    function cancelJob() external whenFunded whenNotCancelled {
        if (msg.sender != client && msg.sender != freelancer)
            revert Unauthorized();
        if (milestonesPaid > 0) revert CannotCancelWithPaidMilestones();

        isCancelled = true;
        uint256 refundAmount = address(this).balance;

        // Transfer remaining funds back to client
        (bool success, ) = client.call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit JobCancelled(refundAmount);
    }

    // ============ View Functions ============

    /**
     * @notice Get the state of a specific milestone
     * @param milestoneIndex Index of the milestone
     * @return state Current state of the milestone
     * @return submittedAt Timestamp when submitted (0 if not submitted)
     * @return paid Whether payment has been released
     */
    function getMilestone(
        uint256 milestoneIndex
    )
        external
        view
        returns (MilestoneState state, uint256 submittedAt, bool paid)
    {
        if (milestoneIndex >= totalMilestones) revert InvalidMilestone();
        Milestone memory milestone = milestones[milestoneIndex];
        return (milestone.state, milestone.submittedAt, milestone.paid);
    }

    /**
     * @notice Check if the job is complete (all milestones paid)
     * @return True if all milestones have been paid
     */
    function isJobComplete() external view returns (bool) {
        return milestonesPaid == totalMilestones;
    }

    /**
     * @notice Get the total amount required to fund the contract
     * @return Total funding amount in wei
     */
    function getTotalFundingRequired() external view returns (uint256) {
        return totalMilestones * paymentPerMilestone;
    }

    /**
     * @notice Get remaining balance in the contract
     * @return Contract balance in wei
     */
    function getRemainingBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
